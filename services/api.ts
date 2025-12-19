
/**
 * DOCUMENTATION SQL DE MAINTENANCE - UNICONNECT
 * 
 * 1. FONCTIONS DE SÉCURITÉ (Optimisées pour éviter la récursion et les failles de search_path) :
 * -----------------------------------------------------------------------------------------
 * -- Note: L'utilisation de 'SET search_path = public' est critique pour la sécurité (évite le détournement de schéma).
 * 
 * CREATE OR REPLACE FUNCTION public.check_is_admin()
 * RETURNS boolean AS $$
 * BEGIN
 *   RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
 * 
 * CREATE OR REPLACE FUNCTION public.check_is_delegate()
 * RETURNS boolean AS $$
 * BEGIN
 *   RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'delegate');
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
 * 
 * 2. RÉÉCRITURE RLS TABLE PROFILES :
 * ----------------------------------
 * ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 * 
 * DROP POLICY IF EXISTS "Profiles_Read_All" ON profiles;
 * DROP POLICY IF EXISTS "Profiles_Insert" ON profiles;
 * DROP POLICY IF EXISTS "Profiles_Update" ON profiles;
 * DROP POLICY IF EXISTS "Profiles_Delete" ON profiles;
 * 
 * -- Tout le monde peut voir les profils (pour les noms d'auteurs et avatars)
 * CREATE POLICY "Profiles_Read_All" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
 * 
 * -- Création autorisée par l'utilisateur lui-même ou un admin
 * CREATE POLICY "Profiles_Insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.check_is_admin());
 * 
 * -- Modification par soi-même ou un admin
 * CREATE POLICY "Profiles_Update" ON profiles FOR UPDATE USING (auth.uid() = id OR public.check_is_admin());
 * 
 * -- Suppression réservée aux administrateurs
 * CREATE POLICY "Profiles_Delete" ON profiles FOR DELETE USING (public.check_is_admin());
 * 
 * 3. STOCKAGE - BUCKETS ET POLITIQUES :
 * -------------------------------------
 * INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
 * INSERT INTO storage.buckets (id, name, public) VALUES ('schedules', 'schedules', true) ON CONFLICT DO NOTHING;
 * INSERT INTO storage.buckets (id, name, public) VALUES ('announcements', 'announcements', true) ON CONFLICT DO NOTHING;
 * 
 * CREATE POLICY "Lecture publique fichiers" ON storage.objects FOR SELECT USING (true);
 * CREATE POLICY "Upload Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
 * CREATE POLICY "Gestion Fichiers Admin/Delegue" ON storage.objects FOR ALL 
 * USING (bucket_id IN ('schedules', 'announcements') AND (public.check_is_admin() OR public.check_is_delegate()));
 */

import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseKey } from './supabaseClient';
import { User, UserRole, Announcement, Exam, ClassGroup, ActivityLog, AppNotification, Poll, MeetLink, ScheduleFile } from '../types';

const getInitialsAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}&backgroundColor=0ea5e9,0284c7,0369a1,075985,38bdf8`;

// Cache ultra-rapide pour éviter les requêtes inutiles
const CACHE: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60 * 1000; 

const getCached = (key: string) => {
    const entry = CACHE[key];
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
    return null;
};

const setCache = (key: string, data: any) => {
    CACHE[key] = { data, timestamp: Date.now() };
};

const invalidateCache = (prefix: string) => {
    Object.keys(CACHE).forEach(key => {
        if (key.startsWith(prefix)) delete CACHE[key];
    });
};

const mapProfileToUser = (p: any): User => ({
  id: p.id,
  name: p.full_name || 'Utilisateur',
  email: p.email || '',
  role: (p.role ? p.role.toUpperCase() : UserRole.STUDENT) as UserRole,
  className: p.classname || '', 
  schoolName: p.school_name || 'ESP Dakar',
  avatar: p.avatar_url || getInitialsAvatar(p.full_name || 'User'),
  isActive: p.is_active !== false
});

const mapAnnouncement = (a: any): Announcement => {
  const priority = a.priority || 'normal';
  return {
    id: a.id,
    title: a.title,
    content: a.content || '',
    author: a.author_name || 'Anonyme',
    date: a.created_at || new Date().toISOString(),
    className: a.classname || 'Général',
    priority: priority as any,
    isImportant: priority === 'important' || priority === 'urgent',
    links: [] 
  };
};

export const API = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const cleanEmail = email.trim().toLowerCase();
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email: cleanEmail, 
        password 
      });
      
      if (authError) {
        throw authError;
      }
      
      const { data: profile, error: fetchError } = await supabase.from('profiles')
        .select('id, full_name, email, role, classname, school_name, avatar_url, is_active')
        .eq('id', authData.user?.id).maybeSingle();
        
      if (fetchError) throw fetchError;
      if (!profile) throw new Error("Profil non trouvé. Contactez l'administrateur.");
      if (profile.is_active === false) throw new Error("Votre compte a été désactivé.");
      
      return mapProfileToUser(profile);
    },

    getSession: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        const { data: profile } = await supabase.from('profiles')
          .select('id, full_name, email, role, classname, school_name, avatar_url, is_active')
          .eq('id', session.user.id).maybeSingle();
        return profile ? mapProfileToUser(profile) : null;
      } catch (e) { return null; }
    },

    getUsers: async (): Promise<User[]> => {
      const cached = getCached('users_list');
      if (cached) return cached;
      const { data, error } = await supabase.from('profiles')
        .select('id, full_name, email, role, classname, school_name, avatar_url, is_active')
        .order('full_name').limit(100);
      if (error) return [];
      const users = (data || []).map(mapProfileToUser);
      setCache('users_list', users);
      return users;
    },

    updateProfile: async (id: string, updates: Partial<User>) => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.full_name = updates.name;
      if (updates.role) dbUpdates.role = updates.role.toLowerCase();
      if (updates.className !== undefined) dbUpdates.classname = updates.className;
      if (updates.schoolName !== undefined) dbUpdates.school_name = updates.schoolName;
      if (updates.avatar) dbUpdates.avatar_url = updates.avatar;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error) throw error;
      invalidateCache('users_list');
      return data ? mapProfileToUser(data) : null;
    },

    createUser: async (user: any) => {
      const tempClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      const { data, error } = await tempClient.auth.signUp({ 
        email: user.email.trim().toLowerCase(), 
        password: 'passer25',
        options: { data: { full_name: user.name, role: user.role.toLowerCase() } }
      });
      if (error) throw error;
      if (data.user) {
          await supabase.from('profiles').upsert({
              id: data.user.id, full_name: user.name, email: user.email.trim().toLowerCase(),
              role: user.role.toLowerCase(), classname: user.className || '',
              is_active: true, avatar_url: getInitialsAvatar(user.name)
          });
          invalidateCache('users_list');
      }
      return data;
    },
    logout: async () => { await supabase.auth.signOut(); },
    updatePassword: async (id: string, pass: string) => {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
    },
    toggleUserStatus: async (userId: string) => {
      const { data: p } = await supabase.from('profiles').select('is_active').eq('id', userId).single();
      const { error } = await supabase.from('profiles').update({ is_active: !p?.is_active }).eq('id', userId);
      if (error) throw error;
      invalidateCache('users_list');
    },
    deleteUser: async (userId: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      invalidateCache('users_list');
    }
  },

  announcements: {
    list: async (limit = 20): Promise<Announcement[]> => {
      const selectStr = 'id, title, content, author_name, created_at, classname, priority';
      const { data, error } = await supabase.from('announcements')
        .select(selectStr)
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      
      if (error && error.code === '42703') { 
        const { data: fallbackData } = await supabase.from('announcements').select(selectStr).limit(limit);
        return (fallbackData || []).map(mapAnnouncement);
      }
      
      return (data || []).map(mapAnnouncement);
    },
    create: async (ann: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();
      const { data, error } = await supabase.from('announcements').insert({
        title: ann.title, content: ann.content, priority: ann.priority,
        classname: ann.className || 'Général', author_id: user?.id, author_name: profile?.full_name || 'Admin'
      }).select().single();
      if (error) throw error;
      return mapAnnouncement(data);
    },
    update: async (id: string, ann: any) => {
      const { data, error } = await supabase.from('announcements').update({
        title: ann.title, content: ann.content, priority: ann.priority, classname: ann.className
      }).eq('id', id).select().single();
      if (error) throw error;
      return mapAnnouncement(data);
    },
    delete: async (id: string) => { await supabase.from('announcements').delete().eq('id', id); }
  },

  polls: {
    list: async (limit = 10): Promise<Poll[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      const selectStr = 'id, question, classname, is_active, start_time, end_time, created_at, poll_options(id, label, votes)';
      
      let { data: polls, error } = await supabase.from('polls')
        .select(selectStr)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error && error.code === '42703') {
        const { data: fallbackData } = await supabase.from('polls').select(selectStr).limit(limit);
        polls = fallbackData;
      }
      
      if (!polls) return [];
      
      let userVotes: any[] = [];
      if (user) {
        const { data } = await supabase.from('poll_votes').select('poll_id, option_id').eq('user_id', user.id);
        userVotes = data || [];
      }
      return (polls || []).map(p => {
        const options = (p.poll_options || []).map((o: any) => ({ id: o.id, label: o.label, votes: o.votes || 0 }));
        const userVote = userVotes.find(v => v.poll_id === p.id);
        return {
          id: p.id, question: p.question, className: p.classname, isActive: p.is_active,
          options, totalVotes: options.reduce((acc: number, o: any) => acc + o.votes, 0),
          hasVoted: !!userVote, userVoteOptionId: userVote?.option_id,
          startTime: p.start_time, endTime: p.end_time
        };
      });
    },
    vote: async (pollId: string, optionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('poll_votes').upsert({ poll_id: pollId, user_id: user?.id, option_id: optionId }, { onConflict: 'poll_id,user_id' });
      const { data: opt } = await supabase.from('poll_options').select('votes').eq('id', optionId).single();
      await supabase.from('poll_options').update({ votes: (opt?.votes || 0) + 1 }).eq('id', optionId);
    },
    toggleStatus: async (id: string) => {
      const { data: p } = await supabase.from('polls').select('is_active').eq('id', id).single();
      await supabase.from('polls').update({ is_active: !p?.is_active }).eq('id', id);
    },
    delete: async (id: string) => { await supabase.from('polls').delete().eq('id', id); },
    update: async (id: string, p: any) => {
      await supabase.from('polls').update({ question: p.question, start_time: p.startTime, end_time: p.endTime }).eq('id', id);
    },
    create: async (p: any) => {
      const { data: poll, error: pollErr } = await supabase.from('polls').insert({
        question: p.question, classname: p.className, is_active: true, start_time: p.startTime, end_time: p.endTime
      }).select().single();
      if (pollErr) throw pollErr;
      const options = p.options.map((o: any) => ({ poll_id: poll.id, label: o.label, votes: 0 }));
      await supabase.from('poll_options').insert(options);
      return poll;
    }
  },

  exams: {
    list: async (limit = 20): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams')
        .select('id, subject, exam_date, duration, room, notes, classname')
        .order('exam_date', { ascending: true })
        .limit(limit);
      if (error) return [];
      return (data || []).map(e => ({
        id: e.id, subject: e.subject, date: e.exam_date, duration: e.duration, room: e.room, notes: e.notes, className: e.classname || ''
      }));
    },
    create: async (exam: any) => {
      const { data, error } = await supabase.from('exams').insert({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes, classname: exam.className
      }).select().single();
      if (error) throw error;
      return { ...exam, id: data.id };
    },
    update: async (id: string, exam: any) => {
      const { data, error } = await supabase.from('exams').update({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes
      }).eq('id', id).select().single();
      if (error) throw error;
      return { ...exam, id: data.id };
    },
    delete: async (id: string) => { await supabase.from('exams').delete().eq('id', id); }
  },

  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const cached = getCached('classes_list');
      if (cached) return cached;
      const { data, error } = await supabase.from('classes').select('id, name, email').order('name');
      if (error) return [];
      const classes = (data || []).map(c => ({ id: c.id, name: c.name, email: c.email || '', studentCount: 0 }));
      setCache('classes_list', classes);
      return classes;
    },
    update: async (id: string, cls: any) => {
      await supabase.from('classes').update({ name: cls.name, email: cls.email }).eq('id', id);
      invalidateCache('classes_list');
    },
    create: async (name: string, email: string) => {
      await supabase.from('classes').insert({ name, email });
      invalidateCache('classes_list');
    },
    delete: async (id: string) => {
      await supabase.from('classes').delete().eq('id', id);
      invalidateCache('classes_list');
    }
  },

  notifications: {
    list: async (limit = 20): Promise<AppNotification[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const selectStr = 'id, title, message, type, created_at, is_read';
      
      let { data, error } = await supabase.from('notifications')
        .select(selectStr)
        .or(`user_id.eq.${user.id},target_class.eq.Général`)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error && error.code === '42703') {
        const { data: fallbackData } = await supabase.from('notifications')
            .select(selectStr)
            .or(`user_id.eq.${user.id},target_class.eq.Général`)
            .limit(limit);
        data = fallbackData;
      }
      
      if (!data) return [];
      return (data || []).map(n => ({ id: n.id, title: n.title, message: n.message, type: n.type as any, timestamp: n.created_at, isRead: n.is_read }));
    },
    markRead: async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); },
    add: async (notif: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('notifications').insert({
        title: notif.title, message: notif.message, type: notif.type,
        user_id: user?.id, target_class: notif.targetClass || 'Général', is_read: false
      });
    },
    markAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
    },
    clear: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('notifications').delete().eq('user_id', user?.id);
    }
  },

  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('id, title, platform, url, time, classname');
      if (error) return [];
      return (data || []).map(m => ({ id: m.id, title: m.title, platform: m.platform as any, url: m.url, time: m.time, className: m.classname }));
    },
    create: async (m: any) => {
      const { data, error } = await supabase.from('meet_links').insert({
        title: m.title, platform: m.platform, url: m.url, time: m.time, classname: m.className
      }).select().single();
      if (error) throw error;
      return { id: data.id, title: data.title, platform: data.platform as any, url: data.url, time: data.time, className: data.classname };
    },
    update: async (id: string, m: any) => {
      const { data, error } = await supabase.from('meet_links').update({
        title: m.title, platform: m.platform, url: m.url, time: m.time
      }).eq('id', id).select().single();
      if (error) throw error;
      return { id: data.id, title: data.title, platform: data.platform as any, url: data.url, time: data.time, className: data.classname };
    },
    delete: async (id: string) => { await supabase.from('meet_links').delete().eq('id', id); }
  },

  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('id, version, upload_date, url, classname').order('upload_date', { ascending: false }).limit(5);
      if (error) return [];
      return (data || []).map(s => ({ id: s.id, version: s.version, uploadDate: s.upload_date, url: s.url, className: s.classname }));
    },
    create: async (sch: any) => {
      const { data, error } = await supabase.from('schedules').insert({
        version: sch.version, url: sch.url, classname: sch.className
      }).select().single();
      if (error) throw error;
      return { id: data.id, version: data.version, uploadDate: data.upload_date, url: data.url, className: data.classname };
    },
    delete: async (id: string) => { await supabase.from('schedules').delete().eq('id', id); }
  },

  logs: {
    list: async (limit = 50): Promise<ActivityLog[]> => {
      const selectStr = 'id, actor, action, target, type, created_at';
      let { data, error } = await supabase.from('activity_logs')
        .select(selectStr)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error && error.code === '42703') {
        const { data: fallbackData } = await supabase.from('activity_logs').select(selectStr).limit(limit);
        data = fallbackData;
      }
      
      if (!data) return [];
      return (data || []).map(l => ({ id: l.id, actor: l.actor, action: l.action, target: l.target, type: l.type as any, timestamp: l.created_at }));
    },
    add: async (actor: string, action: string, target: string, type: string) => {
      await supabase.from('activity_logs').insert({ actor, action, target, type });
    }
  }
};

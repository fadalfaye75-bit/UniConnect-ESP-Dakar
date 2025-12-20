
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseKey } from './supabaseClient';
import { User, UserRole, Announcement, Exam, ClassGroup, ActivityLog, AppNotification, Poll, MeetLink, ScheduleFile } from '../types';

const getInitialsAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}&backgroundColor=0ea5e9,0284c7,0369a1,075985,38bdf8`;

// Cache avec TTL différencié
const CACHE: Record<string, { data: any, timestamp: number, ttl: number }> = {};
const DEFAULT_TTL = 30 * 1000; // 30 secondes par défaut
const LONG_TTL = 10 * 60 * 1000; // 10 minutes pour les données quasi-statiques (classes)

const getCached = (key: string) => {
    const entry = CACHE[key];
    if (entry && Date.now() - entry.timestamp < entry.ttl) return entry.data;
    return null;
};

const setCache = (key: string, data: any, ttl = DEFAULT_TTL) => {
    CACHE[key] = { data, timestamp: Date.now(), ttl };
};

export const invalidateCache = (prefix?: string) => {
    if (!prefix) {
        Object.keys(CACHE).forEach(key => delete CACHE[key]);
    } else {
        Object.keys(CACHE).forEach(key => {
            if (key.startsWith(prefix)) delete CACHE[key];
        });
    }
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
    attachments: a.attachments || [],
    links: [] 
  };
};

export const API = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const cleanEmail = email.trim().toLowerCase();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (authError) throw authError;
      
      const { data: profile, error: fetchError } = await supabase.from('profiles')
        .select('id, full_name, email, role, classname, school_name, avatar_url, is_active')
        .eq('id', authData.user?.id).maybeSingle();
        
      if (fetchError) throw fetchError;
      if (!profile) throw new Error("Profil non trouvé.");
      
      invalidateCache();
      return mapProfileToUser(profile);
    },

    getSession: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        
        const cacheKey = `profile_${session.user.id}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        const { data: profile } = await supabase.from('profiles')
          .select('id, full_name, email, role, classname, school_name, avatar_url, is_active')
          .eq('id', session.user.id).maybeSingle();
        
        const user = profile ? mapProfileToUser(profile) : null;
        if (user) setCache(cacheKey, user, DEFAULT_TTL);
        return user;
      } catch (e) { return null; }
    },

    getUsers: async (): Promise<User[]> => {
      const cached = getCached('users_list');
      if (cached) return cached;
      const { data, error } = await supabase.from('profiles').select('*').order('full_name').limit(200);
      if (error) return [];
      const users = (data || []).map(mapProfileToUser);
      setCache('users_list', users, DEFAULT_TTL);
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
      invalidateCache(`profile_${id}`);
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
    logout: async () => { 
        invalidateCache();
        await supabase.signOut(); 
    },
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
    list: async (limit = 50): Promise<Announcement[]> => {
      const cacheKey = `announcements_${limit}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase.from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      const res = (data || []).map(mapAnnouncement);
      if (!error) setCache(cacheKey, res, DEFAULT_TTL);
      return res;
    },
    create: async (ann: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();
      const { data, error } = await supabase.from('announcements').insert({
        title: ann.title, 
        content: ann.content, 
        priority: ann.priority,
        classname: ann.className || 'Général', 
        author_id: user?.id, 
        author_name: profile?.full_name || 'Admin',
        attachments: ann.attachments || []
      }).select().single();
      if (error) throw error;
      invalidateCache('announcements_');
      return mapAnnouncement(data);
    },
    update: async (id: string, ann: any) => {
      const { data, error } = await supabase.from('announcements').update({
        title: ann.title, 
        content: ann.content, 
        priority: ann.priority,
        classname: ann.className,
        attachments: ann.attachments || []
      }).eq('id', id).select().single();
      if (error) throw error;
      invalidateCache('announcements_');
      return mapAnnouncement(data);
    },
    delete: async (id: string) => { 
        await supabase.from('announcements').delete().eq('id', id);
        invalidateCache('announcements_');
    }
  },

  polls: {
    list: async (): Promise<Poll[]> => {
      const cached = getCached('polls_list');
      if (cached) return cached;

      const { data: { user } } = await supabase.auth.getUser();
      const { data: polls, error } = await supabase.from('polls')
        .select('id, question, classname, is_active, start_time, end_time, created_at, poll_options(id, label, votes)')
        .order('created_at', { ascending: false });
      
      if (!polls) return [];
      
      let userVotes: any[] = [];
      if (user) {
        const { data } = await supabase.from('poll_votes').select('poll_id, option_id').eq('user_id', user.id);
        userVotes = data || [];
      }
      const res = (polls || []).map(p => {
        const options = (p.poll_options || []).map((o: any) => ({ id: o.id, label: o.label, votes: o.votes || 0 }));
        const userVote = userVotes.find(v => v.poll_id === p.id);
        return {
          id: p.id, question: p.question, className: p.classname, isActive: p.is_active,
          options, totalVotes: options.reduce((acc: number, o: any) => acc + o.votes, 0),
          hasVoted: !!userVote, userVoteOptionId: userVote?.option_id,
          startTime: p.start_time, endTime: p.end_time
        };
      });
      if (!error) setCache('polls_list', res, DEFAULT_TTL);
      return res;
    },
    vote: async (pollId: string, optionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Appel de la fonction SQL RPC pour garantir l'intégrité
      const { error } = await supabase.rpc('vote_for_option', {
        p_poll_id: pollId,
        p_option_id: optionId,
        p_user_id: user.id
      });
      if (error) {
          // Fallback si la fonction RPC n'est pas encore créée
          await supabase.from('poll_votes').upsert({ poll_id: pollId, user_id: user.id, option_id: optionId }, { onConflict: 'poll_id,user_id' });
      }
      invalidateCache('polls_list');
    },
    create: async (p: any) => {
      const { data: poll, error: pollErr } = await supabase.from('polls').insert({
        question: p.question, classname: p.className || 'Général', is_active: true, start_time: p.startTime, end_time: p.endTime
      }).select().single();
      if (pollErr) throw pollErr;
      const options = p.options.map((o: any) => ({ poll_id: poll.id, label: o.label, votes: 0 }));
      await supabase.from('poll_options').insert(options);
      invalidateCache('polls_list');
      return poll;
    },
    update: async (id: string, p: any) => {
      const { data, error } = await supabase.from('polls').update({
        question: p.question, start_time: p.startTime, end_time: p.endTime
      }).eq('id', id).select().single();
      if (error) throw error;
      invalidateCache('polls_list');
      return data;
    },
    toggleStatus: async (id: string) => {
        const { data: p } = await supabase.from('polls').select('is_active').eq('id', id).single();
        await supabase.from('polls').update({ is_active: !p?.is_active }).eq('id', id);
        invalidateCache('polls_list');
    },
    delete: async (id: string) => {
        await supabase.from('polls').delete().eq('id', id);
        invalidateCache('polls_list');
    }
  },

  exams: {
    list: async (): Promise<Exam[]> => {
      const cached = getCached('exams_list');
      if (cached) return cached;
      const { data, error } = await supabase.from('exams').select('*').order('exam_date', { ascending: true });
      if (error) return [];
      const res = (data || []).map(e => ({
        id: e.id, subject: e.subject, date: e.exam_date, duration: e.duration, room: e.room, notes: e.notes, className: e.classname || ''
      }));
      setCache('exams_list', res, DEFAULT_TTL);
      return res;
    },
    create: async (exam: any) => {
      const { data, error } = await supabase.from('exams').insert({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes, classname: exam.className || 'Général'
      }).select().single();
      if (error) throw error;
      invalidateCache('exams_list');
      return { ...exam, id: data.id };
    },
    update: async (id: string, exam: any) => {
      const { data, error } = await supabase.from('exams').update({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes
      }).eq('id', id).select().single();
      if (error) throw error;
      invalidateCache('exams_list');
      return { id: data.id, subject: data.subject, date: data.exam_date, duration: data.duration, room: data.room, notes: data.notes, className: data.classname || '' };
    },
    delete: async (id: string) => { 
        await supabase.from('exams').delete().eq('id', id);
        invalidateCache('exams_list');
    }
  },

  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const cached = getCached('classes_list');
      if (cached) return cached;
      const { data, error } = await supabase.from('classes').select('id, name, email').order('name');
      if (error) return [];
      const classes = (data || []).map(c => ({ id: c.id, name: c.name, email: c.email || '', studentCount: 0 }));
      setCache('classes_list', classes, LONG_TTL); // Cache long car peu de changements
      return classes;
    },
    create: async (name: string, email: string) => {
      await supabase.from('classes').insert({ name, email });
      invalidateCache('classes_list');
    },
    update: async (id: string, cls: { name: string, email: string }) => {
      await supabase.from('classes').update({ name: cls.name, email: cls.email }).eq('id', id);
      invalidateCache('classes_list');
    },
    delete: async (id: string) => {
      await supabase.from('classes').delete().eq('id', id);
      invalidateCache('classes_list');
    }
  },

  notifications: {
    list: async (limit = 20): Promise<AppNotification[]> => {
      const { data: { user } } = await supabase.auth.getSession();
      if (!user) return [];
      
      const { data: profile } = await supabase.from('profiles').select('role, classname').eq('id', user.id).single();
      const role = profile?.role?.toUpperCase();
      const className = profile?.classname;

      let orFilter = `user_id.eq.${user.id},target_class.eq.Général`;
      if (role === 'ADMIN') orFilter += `,target_role.eq.ADMIN`;
      else if (role === 'DELEGATE') orFilter += `,target_role.eq.DELEGATE`;

      const { data } = await supabase.from('notifications')
        .select('*')
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      let filtered = data || [];
      if (role === 'DELEGATE') {
        filtered = filtered.filter(n => n.target_class === 'Général' || n.target_class === className || n.user_id === user.id);
      }

      return filtered.map(n => ({ 
        id: n.id, title: n.title, message: n.message, type: n.type as any, timestamp: n.created_at, isRead: n.is_read, link: n.link 
      }));
    },
    markRead: async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); },
    add: async (notif: Partial<AppNotification> & { targetRole?: string, targetClass?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('notifications').insert({
        title: notif.title, message: notif.message, type: notif.type || 'info', user_id: user?.id, 
        target_class: notif.targetClass || 'Général', target_role: notif.targetRole, link: notif.link, is_read: false
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
      const cached = getCached('meet_list');
      if (cached) return cached;
      const { data, error } = await supabase.from('meet_links').select('*');
      if (error) return [];
      const res = (data || []).map(m => ({ id: m.id, title: m.title, platform: m.platform as any, url: m.url, time: m.time, className: m.classname }));
      setCache('meet_list', res, DEFAULT_TTL);
      return res;
    },
    create: async (m: any) => {
      const { data, error } = await supabase.from('meet_links').insert({
        title: m.title, platform: m.platform, url: m.url, time: m.time, classname: m.className || 'Général'
      }).select().single();
      if (error) throw error;
      invalidateCache('meet_list');
      return { id: data.id, title: data.title, platform: data.platform as any, url: data.url, time: data.time, className: data.classname };
    },
    update: async (id: string, m: any) => {
      const { data, error } = await supabase.from('meet_links').update({
        title: m.title, platform: m.platform, url: m.url, time: m.time
      }).eq('id', id).select().single();
      if (error) throw error;
      invalidateCache('meet_list');
      return { id: data.id, title: data.title, platform: data.platform as any, url: data.url, time: data.time, className: data.classname };
    },
    delete: async (id: string) => { 
        await supabase.from('meet_links').delete().eq('id', id);
        invalidateCache('meet_list');
    }
  },

  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const cached = getCached('schedules_list');
      if (cached) return cached;
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false }).limit(10);
      if (error) return [];
      const res = (data || []).map(s => ({ id: s.id, version: s.version, uploadDate: s.upload_date, url: s.url, className: s.classname }));
      setCache('schedules_list', res, DEFAULT_TTL);
      return res;
    },
    create: async (sch: any) => {
      const { data, error } = await supabase.from('schedules').insert({
        version: sch.version, url: sch.url, classname: sch.className || 'Général'
      }).select().single();
      if (error) throw error;
      invalidateCache('schedules_list');
      return { id: data.id, version: data.version, uploadDate: data.upload_date, url: data.url, className: data.classname };
    },
    delete: async (id: string) => { 
        await supabase.from('schedules').delete().eq('id', id);
        invalidateCache('schedules_list');
    }
  },

  logs: {
    list: async (limit = 100): Promise<ActivityLog[]> => {
      const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      return (data || []).map(l => ({ id: l.id, actor: l.actor, action: l.action, target: l.target, type: l.type as any, timestamp: l.created_at }));
    },
    add: async (actor: string, action: string, target: string, type: string) => {
      await supabase.from('activity_logs').insert({ actor, action, target, type });
    }
  }
};

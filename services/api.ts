
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseKey } from './supabaseClient';
import { User, UserRole, Announcement, Exam, ClassGroup, ActivityLog, AppNotification, Poll, MeetLink, ScheduleFile } from '../types';

const getInitialsAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}&backgroundColor=0ea5e9,0284c7,0369a1,075985,38bdf8`;

// Cache intelligent avec invalidation ciblée
const CACHE: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

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
    date: a.created_at,
    className: a.classname || 'Général',
    priority: priority as any,
    isImportant: priority === 'important' || priority === 'urgent',
    links: [] 
  };
};

const handleError = (error: any) => {
  if (!error) return;
  console.error("--- SUPABASE ERROR DETAILS ---", error);
  throw new Error(error.message || "Erreur de connexion serveur.");
};

export const API = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) handleError(authError);
      
      const { data: profile, error: fetchError } = await supabase.from('profiles')
        .select('id, full_name, email, role, classname, school_name, avatar_url, is_active')
        .eq('id', authData.user?.id).maybeSingle();
      if (fetchError) handleError(fetchError);
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

    updateProfile: async (id: string, updates: Partial<User>, adminName?: string) => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.full_name = updates.name;
      if (updates.role) dbUpdates.role = updates.role.toLowerCase();
      if (updates.className !== undefined) dbUpdates.classname = updates.className;
      if (updates.schoolName !== undefined) dbUpdates.school_name = updates.schoolName;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error) handleError(error);
      invalidateCache('users_list');
      return data ? mapProfileToUser(data) : null;
    },

    createUser: async (user: any, adminName: string) => {
      const tempClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      const { data, error } = await tempClient.auth.signUp({ 
        email: user.email.trim(), 
        password: 'passer25',
        options: { data: { full_name: user.name, role: user.role.toLowerCase() } }
      });
      if (error) handleError(error);
      if (data.user) {
          await supabase.from('profiles').upsert({
              id: data.user.id, full_name: user.name, email: user.email.trim(),
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
      if (error) handleError(error);
    },

    toggleUserStatus: async (adminName: string, userId: string) => {
      const { data: p } = await supabase.from('profiles').select('is_active').eq('id', userId).single();
      const { error } = await supabase.from('profiles').update({ is_active: !p?.is_active }).eq('id', userId);
      if (error) handleError(error);
      invalidateCache('users_list');
    },

    deleteUser: async (userId: string, adminName?: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) handleError(error);
      invalidateCache('users_list');
    }
  },

  announcements: {
    list: async (limit = 20): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements')
        .select('id, title, content, author_name, created_at, classname, priority')
        .order('created_at', { ascending: false }) // Aligné sur idx_announcements_created_at
        .limit(limit);
      if (error) return [];
      return (data || []).map(mapAnnouncement);
    },
    create: async (ann: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();
      const { data, error } = await supabase.from('announcements').insert({
        title: ann.title, content: ann.content, priority: ann.priority,
        classname: ann.className || 'Général', author_id: user?.id, author_name: profile?.full_name || 'Admin'
      }).select().single();
      if (error) handleError(error);
      return mapAnnouncement(data);
    },
    update: async (id: string, ann: any) => {
      const { data, error } = await supabase.from('announcements').update({
        title: ann.title, content: ann.content, priority: ann.priority, classname: ann.className
      }).eq('id', id).select().single();
      if (error) handleError(error);
      return mapAnnouncement(data);
    },
    delete: async (id: string) => { await supabase.from('announcements').delete().eq('id', id); }
  },

  polls: {
    list: async (): Promise<Poll[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: polls, error } = await supabase.from('polls')
        .select('id, question, classname, is_active, start_time, end_time, poll_options(id, label, votes)')
        .order('created_at', { ascending: false }) // Aligné sur idx_polls_created_at
        .limit(15);
      if (error) return [];
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
      const { error } = await supabase.from('polls').update({
        question: p.question, start_time: p.startTime, end_time: p.endTime
      }).eq('id', id);
      if (error) handleError(error);
    },
    create: async (p: any) => {
      const { data: poll, error: pollErr } = await supabase.from('polls').insert({
        question: p.question, classname: p.className, is_active: true, start_time: p.startTime, end_time: p.endTime
      }).select().single();
      if (pollErr) handleError(pollErr);
      const options = p.options.map((o: any) => ({ poll_id: poll.id, label: o.label, votes: 0 }));
      const { error: optErr } = await supabase.from('poll_options').insert(options);
      if (optErr) handleError(optErr);
      return poll;
    }
  },

  exams: {
    list: async (limit = 20): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams')
        .select('id, subject, exam_date, duration, room, notes, classname')
        .order('exam_date', { ascending: true }) // Aligné sur idx_exams_exam_date
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
      if (error) handleError(error);
      return { ...exam, id: data.id };
    },
    update: async (id: string, exam: any) => {
      const { data, error } = await supabase.from('exams').update({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes
      }).eq('id', id).select().single();
      if (error) handleError(error);
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
    update: async (id: string, cls: any, adminName: string) => {
      const { error } = await supabase.from('classes').update({ name: cls.name, email: cls.email }).eq('id', id);
      if (error) handleError(error);
      invalidateCache('classes_list');
    },
    create: async (name: string, email: string, adminName: string) => {
      const { error } = await supabase.from('classes').insert({ name, email });
      if (error) handleError(error);
      invalidateCache('classes_list');
    },
    delete: async (id: string, adminName: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) handleError(error);
      invalidateCache('classes_list');
    }
  },

  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from('notifications')
        .select('id, title, message, type, created_at, is_read')
        .or(`user_id.eq.${user.id},target_class.eq.Général`)
        .order('created_at', { ascending: false }) // Aligné sur idx_notifications_created_at
        .limit(20);
      if (error) return [];
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
      const { data, error } = await supabase.from('meet_links').select('id, title, platform, url, time, classname').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(m => ({ id: m.id, title: m.title, platform: m.platform as any, url: m.url, time: m.time, className: m.classname }));
    },
    create: async (m: any) => {
      const { data, error } = await supabase.from('meet_links').insert({
        title: m.title, platform: m.platform, url: m.url, time: m.time, classname: m.className
      }).select().single();
      if (error) handleError(error);
      return { id: data.id, title: data.title, platform: data.platform as any, url: data.url, time: data.time, className: data.classname };
    },
    update: async (id: string, m: any) => {
      const { data, error } = await supabase.from('meet_links').update({
        title: m.title, platform: m.platform, url: m.url, time: m.time
      }).eq('id', id).select().single();
      if (error) handleError(error);
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
      if (error) handleError(error);
      return { id: data.id, version: data.version, uploadDate: data.upload_date, url: data.url, className: data.classname };
    },
    delete: async (id: string) => { await supabase.from('schedules').delete().eq('id', id); }
  },

  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data, error } = await supabase.from('activity_logs').select('id, actor, action, target, type, created_at').order('created_at', { ascending: false }).limit(50);
      if (error) return [];
      return (data || []).map(l => ({ id: l.id, actor: l.actor, action: l.action, target: l.target, type: l.type as any, timestamp: l.created_at }));
    },
    add: async (actor: string, action: string, target: string, type: string) => {
      await supabase.from('activity_logs').insert({ actor, action, target, type });
    }
  }
};

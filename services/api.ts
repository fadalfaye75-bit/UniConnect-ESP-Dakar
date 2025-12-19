
import { supabase } from './supabaseClient';
import { User, UserRole, Announcement, Exam, ClassGroup, ActivityLog, AppNotification, Poll, MeetLink, ScheduleFile } from '../types';

const getInitialsAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}&backgroundColor=0ea5e9,0284c7,0369a1,075985,38bdf8`;

const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.full_name || 'Utilisateur',
  email: profile.email || '',
  role: (profile.role ? profile.role.toUpperCase() : UserRole.STUDENT) as UserRole,
  className: profile.class_name || '', 
  schoolName: profile.school_name || 'ESP Dakar',
  avatar: profile.avatar_url || getInitialsAvatar(profile.full_name || 'User'),
  isActive: profile.is_active !== false
});

const handleError = (error: any) => {
  if (!error) return;
  console.error("Erreur Supabase brute:", error);
  const message = error.message || error.details || error.hint || JSON.stringify(error);
  throw new Error(`Erreur Serveur: ${message}`);
};

export const API = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) handleError(authError);
      const { data: profile, error: fetchError } = await supabase.from('profiles').select('*').eq('id', authData.user?.id).maybeSingle();
      if (fetchError) handleError(fetchError);
      if (!profile) throw new Error("Profil introuvable.");
      return mapProfileToUser(profile);
    },
    getSession: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        return profile ? mapProfileToUser(profile) : null;
    },
    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) return [];
      return (data || []).map(mapProfileToUser);
    },
    // Fix: Added adminName as optional 3rd argument for logging
    updateProfile: async (id: string, updates: Partial<User>, adminName?: string) => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.full_name = updates.name;
      if (updates.role) dbUpdates.role = updates.role.toLowerCase();
      if (updates.className !== undefined) dbUpdates.class_name = updates.className;
      if (updates.schoolName) dbUpdates.school_name = updates.schoolName;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error) handleError(error);
      
      if (adminName) {
        await API.logs.add(adminName, 'Mise à jour Profil', updates.email || id, 'update');
      }
      
      return data ? mapProfileToUser(data) : null;
    },
    // Fix: Added missing updatePassword method
    updatePassword: async (userId: string, password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) handleError(error);
    },
    // Fix: Added missing toggleUserStatus method
    toggleUserStatus: async (adminName: string, userId: string) => {
      const { data: current } = await supabase.from('profiles').select('is_active').eq('id', userId).single();
      const nextStatus = !current?.is_active;
      const { error } = await supabase.from('profiles').update({ is_active: nextStatus }).eq('id', userId);
      if (error) handleError(error);
      await API.logs.add(adminName, nextStatus ? 'Activation Utilisateur' : 'Désactivation Utilisateur', userId, 'security');
    },
    // Fix: Added missing deleteUser method
    deleteUser: async (userId: string, adminName?: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) handleError(error);
      if (adminName) await API.logs.add(adminName, 'Suppression Utilisateur', userId, 'delete');
    },
    createUser: async (user: any, adminName: string) => {
      const { data, error } = await supabase.auth.signUp({ email: user.email.trim(), password: 'passer25' });
      if (error) handleError(error);
      if (data.user) {
          await supabase.from('profiles').insert({
              id: data.user.id,
              full_name: user.name,
              email: user.email.trim(),
              role: user.role.toLowerCase(),
              class_name: user.className,
              avatar_url: getInitialsAvatar(user.name)
          });
          await API.logs.add(adminName, 'Création Utilisateur', user.email, 'create');
      }
      return data;
    },
    logout: async () => { await supabase.auth.signOut(); }
  },

  announcements: {
    list: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(a => ({
        id: a.id, title: a.title, content: a.content, author: a.author_name || 'Admin',
        date: a.created_at, className: a.class_name || 'Général',
        priority: a.priority as any, links: a.links || []
      }));
    },
    create: async (ann: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();
      
      const payload = {
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        class_name: ann.className || 'Général',
        author_id: user?.id,
        author_name: profile?.full_name || 'Admin',
        links: ann.links || []
      };
      const { data, error } = await supabase.from('announcements').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    },
    // Fix: Added missing update method for announcements
    update: async (id: string, ann: any) => {
      const { data, error } = await supabase.from('announcements').update({
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        links: ann.links
      }).eq('id', id).select().single();
      if (error) handleError(error);
      return {
        id: data.id, title: data.title, content: data.content, author: data.author_name || 'Admin',
        date: data.created_at, className: data.class_name || 'Général',
        priority: data.priority as any, links: data.links || []
      };
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) handleError(error);
    }
  },

  polls: {
    list: async (): Promise<Poll[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: polls, error } = await supabase.from('polls').select('*, poll_options(*)').order('created_at', { ascending: false });
      if (error) return [];
      let userVotes: any[] = [];
      if (user) {
        const { data } = await supabase.from('poll_votes').select('*').eq('user_id', user.id);
        userVotes = data || [];
      }
      return (polls || []).map(p => {
        const options = (p.poll_options || []).map((o: any) => ({ id: o.id, label: o.label, votes: o.votes || 0 }));
        const userVote = userVotes.find(v => v.poll_id === p.id);
        return {
          id: p.id, question: p.question, className: p.class_name, isActive: p.is_active,
          options, totalVotes: options.reduce((acc: number, o: any) => acc + o.votes, 0),
          hasVoted: !!userVote, userVoteOptionId: userVote?.option_id,
          startTime: p.start_time, endTime: p.end_time
        };
      });
    },
    create: async (poll: any) => {
      const { data: newPoll, error: pError } = await supabase.from('polls').insert({
        question: poll.question, 
        class_name: poll.className, 
        is_active: true,
        start_time: poll.startTime,
        end_time: poll.endTime
      }).select().single();
      if (pError) handleError(pError);
      if (poll.options?.length > 0) {
        const opts = poll.options.map((o: any) => ({ poll_id: newPoll.id, label: o.label }));
        await supabase.from('poll_options').insert(opts);
      }
      return newPoll;
    },
    // Fix: Added missing update method for polls
    update: async (id: string, poll: any) => {
      const { data, error } = await supabase.from('polls').update({
        question: poll.question,
        start_time: poll.startTime,
        end_time: poll.endTime
      }).eq('id', id).select().single();
      if (error) handleError(error);
      return data;
    },
    // Fix: Added missing delete method for polls
    delete: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) handleError(error);
    },
    // Fix: Added missing toggleStatus method for polls
    toggleStatus: async (id: string) => {
      const { data: current } = await supabase.from('polls').select('is_active').eq('id', id).single();
      const { error } = await supabase.from('polls').update({ is_active: !current?.is_active }).eq('id', id);
      if (error) handleError(error);
    },
    vote: async (pollId: string, optionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Veuillez vous connecter.");
      const { error } = await supabase.from('poll_votes').upsert({ poll_id: pollId, user_id: user.id, option_id: optionId }, { onConflict: 'poll_id,user_id' });
      if (error) handleError(error);
    }
  },

  exams: {
    list: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams').select('*').order('exam_date', { ascending: true });
      if (error) return [];
      return (data || []).map(e => ({
        id: e.id, subject: e.subject, date: e.exam_date, duration: e.duration, room: e.room, notes: e.notes, className: e.class_name || ''
      }));
    },
    create: async (exam: any) => {
      const { data, error } = await supabase.from('exams').insert({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes, class_name: exam.className
      }).select().single();
      if (error) handleError(error);
      return {
        id: data.id, subject: data.subject, date: data.exam_date, duration: data.duration, room: data.room, notes: data.notes, className: data.class_name || ''
      };
    },
    // Fix: Added missing update method for exams
    update: async (id: string, exam: any) => {
      const { data, error } = await supabase.from('exams').update({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes
      }).eq('id', id).select().single();
      if (error) handleError(error);
      return {
        id: data.id, subject: data.subject, date: data.exam_date, duration: data.duration, room: data.room, notes: data.notes, className: data.class_name || ''
      };
    },
    // Fix: Added missing delete method for exams
    delete: async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) handleError(error);
    }
  },

  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) return [];
      return (data || []).map(c => ({ id: c.id, name: c.name, email: c.email || '', studentCount: 0 }));
    },
    // Fix: Added adminName as optional 3rd argument
    create: async (name: string, email: string, adminName?: string) => {
      const { error } = await supabase.from('classes').insert({ name, email });
      if (error) handleError(error);
      if (adminName) await API.logs.add(adminName, 'Création Classe', name, 'create');
    },
    // Fix: Added missing update method for classes
    update: async (id: string, data: any, adminName?: string) => {
      const { error } = await supabase.from('classes').update({ name: data.name, email: data.email }).eq('id', id);
      if (error) handleError(error);
      if (adminName) await API.logs.add(adminName, 'Mise à jour Classe', data.name, 'update');
    },
    // Fix: Added missing delete method for classes
    delete: async (id: string, adminName?: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) handleError(error);
      if (adminName) await API.logs.add(adminName, 'Suppression Classe', id, 'delete');
    }
  },

  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(l => ({ id: l.id, actor: l.actor, action: l.action, target: l.target, type: l.type as any, timestamp: l.created_at }));
    },
    add: async (actor: string, action: string, target: string, type: string) => {
      await supabase.from('activity_logs').insert({ actor, action, target, type });
    }
  },

  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from('notifications').select('*').or(`user_id.eq.${user.id},target_class.eq.Général`).order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(n => ({ id: n.id, title: n.title, message: n.message, type: n.type as any, timestamp: n.created_at, isRead: n.is_read }));
    },
    add: async (notif: any) => { await supabase.from('notifications').insert(notif); },
    markRead: async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); },
    // Fix: Added missing markAllRead method for notifications
    markAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
        if (error) handleError(error);
      }
    },
    clear: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('notifications').delete().eq('user_id', user.id);
    }
  },

  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*').order('created_at', { ascending: false });
      return (data || []).map(m => ({ id: m.id, title: m.title, platform: m.platform as any, url: m.url, time: m.time, className: m.class_name }));
    },
    create: async (meet: any) => {
      const { data, error } = await supabase.from('meet_links').insert({ ...meet, class_name: meet.className }).select().single();
      if (error) handleError(error);
      return { id: data.id, title: data.title, platform: data.platform as any, url: data.url, time: data.time, className: data.class_name };
    },
    // Fix: Added missing update method for meet_links
    update: async (id: string, meet: any) => {
      const { data, error } = await supabase.from('meet_links').update({
        title: meet.title,
        platform: meet.platform,
        url: meet.url,
        time: meet.time
      }).eq('id', id).select().single();
      if (error) handleError(error);
      return { id: data.id, title: data.title, platform: data.platform as any, url: data.url, time: data.time, className: data.class_name };
    },
    delete: async (id: string) => { await supabase.from('meet_links').delete().eq('id', id); }
  },

  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false });
      return (data || []).map(s => ({ id: s.id, version: s.version, uploadDate: s.upload_date, url: s.url, className: s.class_name }));
    },
    create: async (sch: any) => {
      const { data, error } = await supabase.from('schedules').insert({ version: sch.version, url: sch.url, class_name: sch.className }).select().single();
      if (error) handleError(error);
      return data;
    },
    delete: async (id: string) => { await supabase.from('schedules').delete().eq('id', id); }
  }
};

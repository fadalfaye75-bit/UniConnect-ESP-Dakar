
import { supabase } from './supabaseClient';
import { User, UserRole, Announcement, Exam, ClassGroup, ActivityLog, AppNotification, Poll, MeetLink, ScheduleFile } from '../types';

const getInitialsAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}&backgroundColor=0ea5e9,0284c7,0369a1,075985,38bdf8`;

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

const mapAnnouncement = (a: any): Announcement => ({
  id: a.id,
  title: a.title,
  content: a.content,
  author: a.author_name || 'Anonyme',
  date: a.created_at,
  className: a.classname || 'Général',
  priority: a.priority as any,
  links: [] // Fix: La colonne links n'existe pas en DB, on retourne un tableau vide
});

const handleError = (error: any) => {
  if (!error) return;
  console.error("--- SUPABASE ERROR DETAILS ---", error);
  
  let msg = "Une erreur est survenue lors de l'opération.";
  
  if (typeof error === 'string') {
    msg = error;
  } else if (error.message) {
    msg = error.message;
  } else if (error.error_description) {
    msg = error.error_description;
  } else {
    msg = JSON.stringify(error);
  }

  if (msg.includes("row-level security") || msg.includes("RLS")) {
    msg = "Accès refusé : vous n'avez pas les permissions nécessaires pour cette action.";
  } else if (msg.includes("column \"links\" of relation \"announcements\" does not exist")) {
    msg = "Erreur de schéma : La colonne 'links' est manquante. Les liens ont été désactivés temporairement.";
  } else if (msg.includes("Failed to fetch")) {
    msg = "Connexion réseau impossible.";
  }
  
  throw new Error(msg);
};

export const API = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) handleError(authError);
      
      const { data: profile, error: fetchError } = await supabase.from('profiles').select('*').eq('id', authData.user?.id).maybeSingle();
      if (fetchError) handleError(fetchError);
      if (!profile) throw new Error("Profil utilisateur introuvable.");
      
      return mapProfileToUser(profile);
    },

    getSession: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        return profile ? mapProfileToUser(profile) : null;
      } catch (e) {
        return null;
      }
    },

    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) return [];
      return (data || []).map(mapProfileToUser);
    },

    updateProfile: async (id: string, updates: Partial<User>, adminName?: string) => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.full_name = updates.name;
      if (updates.role) dbUpdates.role = updates.role.toLowerCase();
      if (updates.className !== undefined) dbUpdates.classname = updates.className;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error) handleError(error);
      
      if (adminName && updates.email) await API.logs.add(adminName, 'Mise à jour profil', updates.email, 'update');
      return data ? mapProfileToUser(data) : null;
    },

    toggleUserStatus: async (adminName: string, userId: string) => {
      const { data: current } = await supabase.from('profiles').select('is_active, email').eq('id', userId).single();
      const { error } = await supabase.from('profiles').update({ is_active: !current?.is_active }).eq('id', userId);
      if (error) handleError(error);
      await API.logs.add(adminName, 'Changement statut', current?.email || userId, 'security');
    },

    deleteUser: async (userId: string, adminName?: string) => {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) handleError(error);
      if (adminName) await API.logs.add(adminName, 'Suppression utilisateur', profile?.email || userId, 'delete');
    },

    createUser: async (user: any, adminName: string) => {
      const { data, error } = await supabase.auth.signUp({ email: user.email.trim(), password: 'passer25' });
      if (error) handleError(error);
      if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
              id: data.user.id,
              full_name: user.name,
              email: user.email.trim(),
              role: user.role.toLowerCase(),
              classname: user.className,
              is_active: true,
              avatar_url: getInitialsAvatar(user.name)
          });
          if (profileError) handleError(profileError);
          await API.logs.add(adminName, 'Création utilisateur', user.email, 'create');
      }
      return data;
    },

    updatePassword: async (userId: string, password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) handleError(error);
    },

    logout: async () => { await supabase.auth.signOut(); }
  },

  announcements: {
    list: async (): Promise<Announcement[]> => {
      // On retire 'links' du select car la colonne est absente
      const { data, error } = await supabase.from('announcements').select('id, title, content, author_name, created_at, classname, priority').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(mapAnnouncement);
    },

    create: async (ann: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).maybeSingle();
      
      const payload: any = {
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        classname: ann.className || 'Général',
        author_id: user?.id,
        author_name: profile?.full_name || 'Admin'
      };
      
      const { data, error } = await supabase.from('announcements').insert(payload).select('id, title, content, author_name, created_at, classname, priority').single();
      if (error) handleError(error);
      return mapAnnouncement(data);
    },

    update: async (id: string, ann: any) => {
      const { data, error } = await supabase.from('announcements').update({
        title: ann.title, content: ann.content, priority: ann.priority
      }).eq('id', id).select('id, title, content, author_name, created_at, classname, priority').single();
      if (error) handleError(error);
      return mapAnnouncement(data);
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
          id: p.id, question: p.question, className: p.classname, isActive: p.is_active,
          options, totalVotes: options.reduce((acc: number, o: any) => acc + o.votes, 0),
          hasVoted: !!userVote, userVoteOptionId: userVote?.option_id,
          startTime: p.start_time, endTime: p.end_time
        };
      });
    },

    create: async (poll: any) => {
      const { data: newPoll, error: pError } = await supabase.from('polls').insert({
        question: poll.question, classname: poll.className, is_active: true,
        start_time: poll.startTime, end_time: poll.endTime
      }).select().single();
      if (pError) handleError(pError);
      if (poll.options?.length > 0) {
        const opts = poll.options.map((o: any) => ({ poll_id: newPoll.id, label: o.label }));
        await supabase.from('poll_options').insert(opts);
      }
      return newPoll;
    },

    update: async (id: string, poll: any) => {
      const { error } = await supabase.from('polls').update({
        question: poll.question, start_time: poll.startTime, end_time: poll.endTime
      }).eq('id', id);
      if (error) handleError(error);
    },

    delete: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) handleError(error);
    },

    toggleStatus: async (id: string) => {
      const { data: current } = await supabase.from('polls').select('is_active').eq('id', id).single();
      const { error } = await supabase.from('polls').update({ is_active: !current?.is_active }).eq('id', id);
      if (error) handleError(error);
    },

    vote: async (pollId: string, optionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Veuillez vous connecter pour voter.");
      const { error } = await supabase.from('poll_votes').upsert({ poll_id: pollId, user_id: user.id, option_id: optionId }, { onConflict: 'poll_id,user_id' });
      if (error) handleError(error);
      const { data: opt } = await supabase.from('poll_options').select('votes').eq('id', optionId).single();
      await supabase.from('poll_options').update({ votes: (opt?.votes || 0) + 1 }).eq('id', optionId);
    }
  },

  exams: {
    list: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams').select('*').order('exam_date', { ascending: true });
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
      return { id: data.id, subject: data.subject, date: data.exam_date, duration: data.duration, room: data.room, notes: data.notes, className: data.classname || '' };
    },

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

    create: async (name: string, email: string, adminName?: string) => {
      const { error } = await supabase.from('classes').insert({ name, email });
      if (error) handleError(error);
      if (adminName) await API.logs.add(adminName, 'Création classe', name, 'create');
    },

    update: async (id: string, cls: any, adminName?: string) => {
      const { error } = await supabase.from('classes').update({ name: cls.name, email: cls.email }).eq('id', id);
      if (error) handleError(error);
      if (adminName) await API.logs.add(adminName, 'Mise à jour classe', cls.name, 'update');
    },

    delete: async (id: string, adminName?: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) handleError(error);
      if (adminName) await API.logs.add(adminName, 'Suppression classe', id, 'delete');
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
    markAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    },
    clear: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('notifications').delete().eq('user_id', user.id);
    }
  },

  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(m => ({ id: m.id, title: m.title, platform: m.platform as any, url: m.url, time: m.time, className: m.classname }));
    },

    create: async (meet: any) => {
      const { data, error } = await supabase.from('meet_links').insert({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time, classname: meet.className }).select().single();
      if (error) handleError(error);
      return { ...meet, id: data.id };
    },

    update: async (id: string, meet: any) => {
      const { data, error } = await supabase.from('meet_links').update({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time }).eq('id', id).select().single();
      if (error) handleError(error);
      return { id: data.id, title: data.title, platform: data.platform as any, url: data.url, time: data.time, className: data.classname };
    },

    delete: async (id: string) => { 
      const { error } = await supabase.from('meet_links').delete().eq('id', id);
      if (error) handleError(error);
    }
  },

  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false });
      if (error) return [];
      return (data || []).map(s => ({ id: s.id, version: s.version, uploadDate: s.upload_date, url: s.url, className: s.classname }));
    },

    create: async (sch: any) => {
      const { data, error } = await supabase.from('schedules').insert({ version: sch.version, url: sch.url, classname: sch.className }).select().single();
      if (error) handleError(error);
      return { ...sch, id: data.id, uploadDate: data.upload_date };
    },

    delete: async (id: string) => { 
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) handleError(error);
    }
  }
};

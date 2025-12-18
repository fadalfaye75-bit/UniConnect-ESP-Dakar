
import { supabase } from './supabaseClient';
import { User, UserRole, Announcement, Exam, ClassGroup, ActivityLog, AppNotification, Poll, MeetLink, ScheduleFile } from '../types';

/**
 * Génère une URL d'avatar basée sur les initiales du nom
 */
const getInitialsAvatar = (name: string) => {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}&backgroundColor=0ea5e9,0284c7,0369a1,075985,38bdf8&fontFamily=Inter,sans-serif&fontWeight=700`;
};

/**
 * Mappe les données de la table 'profiles' (snake_case) vers l'interface 'User' (camelCase)
 */
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

/**
 * Gère les erreurs de Supabase pour éviter le bug [object Object] dans l'UI
 */
const handleError = (error: any) => {
  if (!error) return;
  
  console.error("Supabase Error Details:", error);

  // 1. Déjà une string
  if (typeof error === 'string') throw new Error(error);

  // 2. Erreur Supabase avec message
  if (error.message) {
    // Cas spécifique Email Invalid
    if (error.message.includes("Email address") && error.message.includes("is invalid")) {
      throw new Error("L'email est rejeté par Supabase. Allez dans Authentication > Settings et autorisez le domaine 'esp.sn' ou désactivez la confirmation d'email.");
    }
    // Cas RLS
    if (error.message.includes("row-level security policy")) {
      throw new Error("Accès refusé (RLS). Assurez-vous d'avoir exécuté le script SQL avec la fonction is_admin().");
    }
    throw new Error(error.message);
  }

  // 3. Fallback
  try {
    const detail = error.error_description || error.error || JSON.stringify(error);
    if (detail !== '{}') throw new Error(`Détail : ${detail}`);
  } catch (e) {}

  throw new Error("Une erreur inattendue est survenue.");
};

export const API = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) handleError(authError);
      if (!authData.user) throw new Error("Compte utilisateur introuvable.");

      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (fetchError) handleError(fetchError);
      if (!profile) throw new Error("Profil non trouvé.");
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        throw new Error("Votre compte est suspendu.");
      }

      return mapProfileToUser(profile);
    },

    getSession: async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) return null;
        if (!session || !session.user) return null;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        return profile ? mapProfileToUser(profile) : null;
    },

    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) return [];
      return (data || []).map(mapProfileToUser);
    },
    
    updateProfile: async (id: string, updates: Partial<User>, adminName?: string) => {
      const dbUpdates: any = {};
      if (updates.name) {
        dbUpdates.full_name = updates.name;
        dbUpdates.avatar_url = getInitialsAvatar(updates.name);
      }
      if (updates.role) dbUpdates.role = updates.role.toLowerCase();
      if (updates.className !== undefined) dbUpdates.class_name = updates.className;
      if (updates.schoolName) dbUpdates.school_name = updates.schoolName;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().single();
      if (error) handleError(error);

      if (adminName) {
        await API.logs.add(adminName, 'Mise à jour Profil', updates.name || id, 'update');
      }

      return mapProfileToUser(data);
    },

    createUser: async (user: any, adminName: string) => {
      // 1. Création Auth
      const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: 'passer25',
        options: { 
          data: { 
            full_name: user.name, 
            role: user.role.toLowerCase(),
            class_name: user.className
          } 
        }
      });
      
      if (error) handleError(error);
      
      // 2. Création Profil forcée
      if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
              id: data.user.id,
              full_name: user.name,
              email: user.email,
              role: user.role.toLowerCase(),
              class_name: user.className,
              is_active: true,
              avatar_url: getInitialsAvatar(user.name)
          });
          
          if (profileError) {
              console.warn("Profil Error (peut-être déjà créé par trigger):", profileError.message);
          }
          
          await API.logs.add(adminName, 'Création Utilisateur', user.email, 'create');
      }
      return data;
    },

    toggleUserStatus: async (adminName: string, userId: string) => {
      const { data: current } = await supabase.from('profiles').select('is_active').eq('id', userId).single();
      const { error } = await supabase.from('profiles').update({ is_active: !current?.is_active }).eq('id', userId);
      if (error) handleError(error);
      await API.logs.add(adminName, 'Modif Statut', userId, 'update');
    },

    resetUserPassword: async (adminName: string, userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
      if (profile?.email) {
        const { error } = await supabase.auth.resetPasswordForEmail(profile.email);
        if (error) handleError(error);
        await API.logs.add(adminName, 'Reset Password', userId, 'security');
      }
    },

    updatePassword: async (userId: string, pass: string) => {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) handleError(error);
    },

    deleteUser: async (id: string, adminName: string = 'System') => {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) handleError(error);
      await API.logs.add(adminName, 'Suppression Profil', id, 'delete');
    },

    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn("Logout error:", error.message);
    }
  },

  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) return [];
      return (data || []).map(c => ({ id: c.id, name: c.name, email: c.email || '', studentCount: 0 }));
    },
    create: async (name: string, email: string, adminName: string) => {
      const { error } = await supabase.from('classes').insert({ name, email });
      if (error) handleError(error);
      await API.logs.add(adminName, 'Création Classe', name, 'create');
    },
    update: async (id: string, updates: any, adminName: string) => {
      const { data, error } = await supabase.from('classes').update(updates).eq('id', id).select().single();
      if (error) handleError(error);
      await API.logs.add(adminName, 'Modification Classe', updates.name || id, 'update');
      return data;
    },
    delete: async (id: string, adminName: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) handleError(error);
      await API.logs.add(adminName, 'Suppression Classe', id, 'delete');
    }
  },

  announcements: {
    list: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        author: a.author_name || 'Administration',
        date: a.created_at,
        className: a.className || 'Général',
        priority: a.priority as any,
        isImportant: a.priority !== 'normal',
        links: a.links || []
      }));
    },
    create: async (ann: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        className: ann.className,
        author_id: user?.id,
        author_name: user?.user_metadata.full_name || 'Admin',
        links: ann.links || []
      };
      const { data, error } = await supabase.from('announcements').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    },
    update: async (id: string, ann: any) => {
      const { data, error } = await supabase.from('announcements').update(ann).eq('id', id).select().single();
      if (error) handleError(error);
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) handleError(error);
    }
  },

  exams: {
    list: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams').select('*').order('exam_date', { ascending: true });
      if (error) return [];
      return (data || []).map(e => ({
        id: e.id,
        subject: e.subject,
        date: e.exam_date,
        duration: e.duration,
        room: e.room,
        notes: e.notes,
        className: e.className || ''
      }));
    },
    create: async (exam: any) => {
      const payload = {
        subject: exam.subject,
        exam_date: exam.date,
        duration: exam.duration,
        room: exam.room,
        notes: exam.notes,
        className: exam.className
      };
      const { data, error } = await supabase.from('exams').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    },
    update: async (id: string, exam: any) => {
      const payload = {
        subject: exam.subject,
        exam_date: exam.date,
        duration: exam.duration,
        room: exam.room,
        notes: exam.notes,
        className: exam.className
      };
      const { data, error } = await supabase.from('exams').update(payload).eq('id', id).select().single();
      if (error) handleError(error);
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) handleError(error);
    }
  },

  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false });
      if (error) return [];
      return (data || []).map(s => ({
        id: s.id,
        version: s.version,
        url: s.url,
        className: s.className,
        uploadDate: s.upload_date
      }));
    },
    create: async (sch: any) => {
      const payload = {
        version: sch.version,
        url: sch.url,
        className: sch.className
      };
      const { data, error } = await supabase.from('schedules').insert(payload).select().single();
      if (error) handleError(error);
      return {
        id: data.id,
        version: data.version,
        url: data.url,
        className: data.className,
        uploadDate: data.upload_date
      };
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) handleError(error);
    }
  },

  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*').order('time', { ascending: true });
      if (error) return [];
      return (data || []).map(m => ({
        id: m.id,
        title: m.title,
        platform: m.platform,
        url: m.url,
        time: m.time,
        className: m.className
      }));
    },
    create: async (meet: any) => {
      const payload = {
        title: meet.title,
        platform: meet.platform,
        url: meet.url,
        time: meet.time,
        className: meet.className
      };
      const { data, error } = await supabase.from('meet_links').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    },
    update: async (id: string, updates: any) => {
      const { data, error } = await supabase.from('meet_links').update(updates).eq('id', id).select().single();
      if (error) handleError(error);
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('meet_links').delete().eq('id', id);
      if (error) handleError(error);
    }
  },

  polls: {
    list: async (): Promise<Poll[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: polls, error: pollsError } = await supabase.from('polls').select('*, poll_options(*)').order('created_at', { ascending: false });
      if (pollsError) return [];

      let userVotes: any[] = [];
      if (user) {
        const { data } = await supabase.from('poll_votes').select('*').eq('user_id', user.id);
        userVotes = data || [];
      }

      return (polls || []).map(p => {
        const options = (p.poll_options || []).map((o: any) => ({
          id: o.id,
          label: o.label,
          votes: o.votes || 0
        }));
        const totalVotes = options.reduce((acc: number, o: any) => acc + o.votes, 0);
        const userVote = userVotes.find(v => v.poll_id === p.id);

        return {
          id: p.id,
          question: p.question,
          className: p.className,
          isActive: p.is_active,
          startTime: p.start_time,
          endTime: p.end_time,
          options,
          totalVotes,
          hasVoted: !!userVote,
          userVoteOptionId: userVote?.option_id
        };
      });
    },
    create: async (poll: any) => {
      const { data: newPoll, error: pollError } = await supabase.from('polls').insert({
        question: poll.question,
        className: poll.className,
        start_time: poll.startTime,
        end_time: poll.endTime,
        is_active: true
      }).select().single();
      if (pollError) handleError(pollError);

      if (poll.options && poll.options.length > 0) {
        const optionsPayload = poll.options.map((o: any) => ({
          poll_id: newPoll.id,
          label: o.label,
          votes: 0
        }));
        const { error: optionsError } = await supabase.from('poll_options').insert(optionsPayload);
        if (optionsError) handleError(optionsError);
      }
      return newPoll;
    },
    update: async (id: string, updates: any) => {
      const { data, error } = await supabase.from('polls').update({
        question: updates.question,
        start_time: updates.startTime,
        end_time: updates.endTime
      }).eq('id', id).select().single();
      if (error) handleError(error);
      return data;
    },
    vote: async (pollId: string, optionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: existingVote, error: voteFetchError } = await supabase.from('poll_votes').select('*').eq('poll_id', pollId).eq('user_id', user.id).maybeSingle();
      if (voteFetchError) handleError(voteFetchError);

      if (existingVote) {
        if (existingVote.option_id === optionId) return;
        const { data: oldOpt } = await supabase.from('poll_options').select('votes').eq('id', existingVote.option_id).single();
        await supabase.from('poll_options').update({ votes: Math.max(0, (oldOpt?.votes || 0) - 1) }).eq('id', existingVote.option_id);
        const { error: voteUpdateError } = await supabase.from('poll_votes').update({ option_id: optionId }).eq('id', existingVote.id);
        if (voteUpdateError) handleError(voteUpdateError);
      } else {
        const { error: voteInsertError } = await supabase.from('poll_votes').insert({ poll_id: pollId, user_id: user.id, option_id: optionId });
        if (voteInsertError) handleError(voteInsertError);
      }
      const { data: newOpt } = await supabase.from('poll_options').select('votes').eq('id', optionId).single();
      await supabase.from('poll_options').update({ votes: (newOpt?.votes || 0) + 1 }).eq('id', optionId);
    },
    toggleStatus: async (id: string) => {
      const { data } = await supabase.from('polls').select('is_active').eq('id', id).single();
      const { error } = await supabase.from('polls').update({ is_active: !data?.is_active }).eq('id', id);
      if (error) handleError(error);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) handleError(error);
    }
  },
  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data: profile } = await supabase.from('profiles').select('role, class_name').eq('id', user.id).maybeSingle();
      const role = profile?.role || '';
      const className = profile?.class_name || '';
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},target_role.eq.${role.toUpperCase()},target_class.eq.${className},target_class.eq.Général`)
        .order('created_at', { ascending: false });
        
      if (error) return [];
      return (data || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        isRead: n.is_read,
        link: n.link,
        targetRole: n.target_role,
        targetClass: n.target_class
      }));
    },
    add: async (notif: any) => {
      const { error } = await supabase.from('notifications').insert({
        title: notif.title,
        message: notif.message,
        type: notif.type || 'info',
        link: notif.link,
        target_role: notif.targetRole,
        target_class: notif.targetClass,
        user_id: notif.userId || null,
        is_read: false
      });
      if (error) handleError(error);
    },
    markRead: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) handleError(error);
    },
    markAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
        if (error) handleError(error);
      }
    },
    clear: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
        if (error) handleError(error);
      }
    }
  },
  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(l => ({
        id: l.id,
        actor: l.actor,
        action: l.action,
        target: l.target,
        type: l.type,
        timestamp: l.created_at
      }));
    },
    add: async (actor: string, action: string, target: string, type: string) => {
      const { error } = await supabase.from('activity_logs').insert({ actor, action, target, type });
      if (error) console.warn("Log error:", error.message);
    }
  }
};

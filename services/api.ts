
import { supabase } from './supabaseClient';
import { User, UserRole, Announcement, Exam, ClassGroup, ActivityLog, AppNotification, Poll, MeetLink, ScheduleFile } from '../types';

/**
 * Génère une URL d'avatar basée sur les initiales du nom
 */
const getInitialsAvatar = (name: string) => {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0ea5e9,0284c7,0369a1,075985,38bdf8&fontFamily=Inter,sans-serif&fontWeight=700`;
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

export const API = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (authError) {
        throw new Error(authError.message || "Identifiants incorrects.");
      }
      
      if (!authData.user) throw new Error("Compte utilisateur introuvable.");

      const userId = authData.user.id;

      try {
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (!profile) {
          const userEmail = authData.user.email?.toLowerCase() || '';
          const isAdmin = userEmail === 'faye@esp.sn';
          const fullName = authData.user.user_metadata?.full_name || userEmail.split('@')[0];
          
          const profileData = {
              id: userId,
              full_name: fullName,
              email: userEmail,
              role: isAdmin ? 'admin' : 'student',
              school_name: 'ESP Dakar',
              is_active: true,
              avatar_url: getInitialsAvatar(fullName)
          };

          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert(profileData)
            .select()
            .single();

          if (insertError) throw new Error(insertError.message);
          return mapProfileToUser(newProfile);
        }

        if (profile.is_active === false) {
          await supabase.auth.signOut();
          throw new Error("Votre compte est suspendu.");
        }

        return mapProfileToUser(profile);

      } catch (err: any) {
        throw new Error(err.message || "Erreur de connexion.");
      }
    },

    getSession: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) return null;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        return profile ? mapProfileToUser(profile) : null;
    },

    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) return [];
      return (data || []).map(mapProfileToUser);
    },
    
    updateProfile: async (id: string, updates: Partial<User>) => {
      const dbUpdates: any = {};
      if (updates.name) {
        dbUpdates.full_name = updates.name;
        // Si le nom change, on peut aussi régénérer l'avatar si aucun n'est fixé
        dbUpdates.avatar_url = getInitialsAvatar(updates.name);
      }
      if (updates.avatar) dbUpdates.avatar_url = updates.avatar;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().single();
      if (error) throw error;
      return mapProfileToUser(data);
    },

    createUser: async (user: any, adminName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: 'temporary-password-123',
        options: { data: { full_name: user.name, role: user.role.toLowerCase() } }
      });
      if (error) throw error;
      
      if (data.user) {
          await supabase.from('profiles').insert({
              id: data.user.id,
              full_name: user.name,
              email: user.email,
              role: user.role.toLowerCase(),
              class_name: user.className,
              is_active: true,
              school_name: 'ESP Dakar',
              avatar_url: getInitialsAvatar(user.name)
          });
          await API.logs.add(adminName, 'Création Utilisateur', user.email, 'create');
      }
      return data;
    },

    toggleUserStatus: async (adminName: string, userId: string) => {
      const { data: current } = await supabase.from('profiles').select('is_active').eq('id', userId).single();
      const { error } = await supabase.from('profiles').update({ is_active: !current?.is_active }).eq('id', userId);
      if (error) throw error;
      await API.logs.add(adminName, 'Modif Statut', userId, 'update');
    },

    resetUserPassword: async (adminName: string, userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
      if (profile?.email) {
        await supabase.auth.resetPasswordForEmail(profile.email);
        await API.logs.add(adminName, 'Reset Password', userId, 'security');
      }
    },

    updatePassword: async (userId: string, pass: string) => {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
    },

    deleteUser: async (id: string, adminName: string = 'System') => {
      await supabase.from('profiles').delete().eq('id', id);
      await API.logs.add(adminName, 'Suppression Profil', id, 'delete');
    },

    logout: async () => {
      await supabase.auth.signOut();
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
      if (error) throw error;
      await API.logs.add(adminName, 'Création Classe', name, 'create');
    },
    update: async (id: string, updates: any, adminName: string) => {
      const { data, error } = await supabase.from('classes').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await API.logs.add(adminName, 'Modification Classe', updates.name || id, 'update');
      return data;
    },
    delete: async (id: string, adminName: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
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
      if (error) throw error;
      return data;
    },
    update: async (id: string, ann: any) => {
      const { data, error } = await supabase.from('announcements').update(ann).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
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
      if (error) throw error;
      return data;
    },
    update: async (id: string, exam: any) => {
      const payload = {
        subject: exam.subject,
        exam_date: exam.date,
        duration: exam.duration,
        room: exam.room,
        notes: exam.notes
      };
      const { data, error } = await supabase.from('exams').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) throw error;
    }
  },

  polls: {
    list: async (): Promise<Poll[]> => {
      const { data, error } = await supabase.from('polls').select('*, poll_options(*)');
      if (error) return [];
      return (data || []).map(p => ({
        id: p.id,
        question: p.question,
        options: (p.poll_options || []).map((o: any) => ({ id: o.id, label: o.label, votes: o.votes_count })),
        className: p.className,
        isActive: p.is_active,
        startTime: p.startTime,
        endTime: p.endTime,
        hasVoted: false,
        totalVotes: (p.poll_options || []).reduce((acc: number, o: any) => acc + o.votes_count, 0)
      }));
    },
    vote: async (pollId: string, optionId: string) => {
        const { error } = await supabase.rpc('increment_vote', { option_id: optionId });
        if (error) throw error;
    },
    create: async (poll: any) => {
      const { data: p, error: pe } = await supabase.from('polls').insert({ 
        question: poll.question, 
        className: poll.className,
        startTime: poll.startTime,
        endTime: poll.endTime
      }).select().single();
      if (pe) throw pe;
      if (poll.options && p) {
        const { error: oe } = await supabase.from('poll_options').insert(poll.options.map((o: any) => ({ poll_id: p.id, label: o.label })));
        if (oe) throw oe;
      }
      return p;
    },
    toggleStatus: async (id: string) => {
      const { data: current } = await supabase.from('polls').select('is_active').eq('id', id).single();
      const { error } = await supabase.from('polls').update({ is_active: !current?.is_active }).eq('id', id);
      if (error) throw error;
    },
    update: async (id: string, poll: any) => {
      const { data, error } = await supabase.from('polls').update({
        question: poll.question,
        startTime: poll.startTime,
        endTime: poll.endTime
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) throw error;
    }
  },

  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type as any,
        timestamp: n.created_at,
        isRead: n.is_read
      }));
    },
    add: async (notif: any) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from('notifications').insert({ 
            ...notif, 
            user_id: user.id 
          });
          if (error) console.warn("RLS Violation on Notifications:", error.message);
        }
      } catch (e) {
        console.error("Critical notification error:", e);
      }
    },
    markRead: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) console.error("mark notification error:", error.message);
    },
    markAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
        if (error) console.error("mark all notification error:", error.message);
      }
    },
    clear: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
        if (error) console.error("clear notifications error:", error.message);
      }
    }
  },

  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data, error } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(100);
      if (error) return [];
      return data || [];
    },
    add: async (actor: string, action: string, target: string, type: string) => {
      try {
        const { error } = await supabase.from('activity_logs').insert({ 
          actor, 
          action, 
          target, 
          type
        });
        if (error) console.warn("RLS Violation on Activity Logs:", error.message);
      } catch (e) {
        console.error("Critical log error:", e);
      }
    }
  },

  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*').order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    create: async (meet: any) => {
      const { data, error } = await supabase.from('meet_links').insert(meet).select().single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, meet: any) => {
      const { data, error } = await supabase.from('meet_links').update(meet).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('meet_links').delete().eq('id', id);
      if (error) throw error;
    }
  },

  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false });
      if (error) return [];
      return (data || []).map(s => ({
          id: s.id,
          version: s.version,
          uploadDate: s.upload_date,
          url: s.url,
          className: s.className
      }));
    },
    create: async (sch: any) => {
      const { data, error } = await supabase.from('schedules').insert(sch).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
    }
  }
};

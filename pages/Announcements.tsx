
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, Search, Filter, ChevronDown, Sparkles, FilterX, Send, Shield
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE = 15;

export default function Announcements() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newAnn, setNewAnn] = useState({ title: '', content: '', priority: 'normal' as AnnouncementPriority, className: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);

  const canCreate = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const fetchAnnouncements = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) {
          setLoading(true);
          setPage(0);
      } else {
          setLoadingMore(true);
      }
      const data = await API.announcements.list(pageNum, PAGE_SIZE);
      if (isRefresh) setAnnouncements(data);
      else setAnnouncements(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchAnnouncements(0, true);
    API.classes.list().then(setClasses);
    const subscription = API.announcements.subscribe(() => fetchAnnouncements(0, true));
    if (user) {
        const storedReads = localStorage.getItem(`uniconnect_read_anns_${user.id}`);
        if (storedReads) try { setReadIds(JSON.parse(storedReads)); } catch(e) {}
    }
    return () => subscription.unsubscribe();
  }, [user, adminViewClass, fetchAnnouncements]);

  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => setIsFiltering(false), 400);
    return () => clearTimeout(timer);
  }, [searchTerm, priorityFilter, classFilter]);

  const handleOpenCreate = () => {
    setNewAnn({
      title: '',
      content: '',
      priority: 'normal',
      className: user?.role === UserRole.DELEGATE ? user.className : 'Général'
    });
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.announcements.create(newAnn);
      setIsModalOpen(false);
      addNotification({ title: 'Publié', message: 'L\'annonce est en ligne.', type: 'success' });
      fetchAnnouncements(0, true);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de publication.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const displayedAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const targetClass = ann.className || 'Général';
      const canSee = user?.role === UserRole.ADMIN ? true : (targetClass === user?.className || targetClass === 'Général');
      if (!canSee) return false;
      const matchesSearch = ann.title.toLowerCase().includes(searchTerm.toLowerCase()) || ann.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;
      const matchesClassFilter = classFilter === 'all' || targetClass === classFilter;
      return matchesSearch && matchesPriority && matchesClassFilter;
    });
  }, [user, announcements, searchTerm, priorityFilter, classFilter]);

  const handleMarkAsRead = (id: string) => {
    if (user?.role === UserRole.STUDENT && !readIds.includes(id)) {
        const next = [...readIds, id];
        setReadIds(next);
        localStorage.setItem(`uniconnect_read_anns_${user.id}`, JSON.stringify(next));
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Indexation des avis...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-950/95 py-6 backdrop-blur-md gap-6 border-b border-gray-100 dark:border-gray-800">
        <div>
           <h2 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 italic">
             <Megaphone className="text-primary-500" size={32} /> Le Mur d'Avis
           </h2>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 ml-11">Flux centralisé de l'ESP</p>
        </div>
        
        <div className="flex flex-col md:flex-row flex-1 items-center gap-3 max-w-2xl">
           <div className="relative flex-1 w-full group">
             <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
             <input 
                type="text" placeholder="Chercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 transition-all"
             />
           </div>
           {canCreate && (
              <button onClick={handleOpenCreate} className="flex items-center gap-2 bg-primary-500 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
                 <Plus size={18} /> Publier
              </button>
           )}
        </div>
      </div>

      <div className={`grid gap-6 transition-all duration-500 ${isFiltering ? 'opacity-40 translate-y-2' : 'opacity-100'}`}>
        {displayedAnnouncements.map((ann, index) => {
          const isUnread = user?.role === UserRole.STUDENT && !readIds.includes(ann.id);
          return (
            <div 
              key={ann.id} 
              onClick={() => handleMarkAsRead(ann.id)}
              className={`group relative rounded-[2.5rem] border p-8 transition-all duration-500 flex flex-col md:flex-row gap-8 hover:-translate-y-1 hover:shadow-2xl animate-fade-in ${
                isUnread ? 'bg-white border-primary-200 shadow-xl' : 'bg-gray-50/50 border-gray-100 dark:border-gray-800'
              }`}
              style={{ animationDelay: `${Math.min(index % PAGE_SIZE, 10) * 60}ms`, animationFillMode: 'backwards' }}
            >
              {isUnread && (
                  <div className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1 bg-primary-500 text-white text-[9px] font-black uppercase rounded-full shadow-lg shadow-primary-500/20">
                      <Sparkles size={12} /> Nouveau
                  </div>
              )}
              <div className="flex flex-col items-center justify-center w-20 h-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 flex-shrink-0 shadow-sm transition-transform group-hover:scale-105">
                  <span className="text-[9px] font-black text-gray-400 uppercase">{new Date(ann.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">{new Date(ann.date).getDate()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest ${
                    ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100' : 
                    ann.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-primary-50 text-primary-600 border-primary-100'
                  }`}>
                    {ann.priority}
                  </span>
                  <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-400 tracking-widest">
                    {ann.className || 'Général'}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter italic leading-tight group-hover:text-primary-600 transition-colors">
                  {ann.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium italic opacity-90">{ann.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Diffuser une annonce">
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Sujet</label>
            <input required type="text" value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold outline-none" placeholder="Titre de l'avis..." />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Contenu</label>
            <textarea required rows={5} value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold outline-none italic" placeholder="Détails du message..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Priorité</label>
                <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as any})} className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs font-black uppercase">
                   <option value="normal">Normal</option>
                   <option value="important">Important</option>
                   <option value="urgent">Urgent</option>
                </select>
             </div>
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Cible</label>
                {user?.role === UserRole.ADMIN ? (
                   <select value={newAnn.className} onChange={e => setNewAnn({...newAnn, className: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs font-black uppercase">
                      <option value="Général">Général</option>
                      {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                   </select>
                ) : (
                   <div className="w-full px-5 py-3 rounded-2xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800 flex items-center gap-2">
                      <Shield size={14} className="text-primary-500" />
                      <span className="text-[10px] font-black text-primary-600 uppercase">{user?.className}</span>
                   </div>
                )}
             </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all flex justify-center items-center gap-2 uppercase tracking-widest">
            {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            {submitting ? 'Diffusion...' : 'Envoyer l\'annonce'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

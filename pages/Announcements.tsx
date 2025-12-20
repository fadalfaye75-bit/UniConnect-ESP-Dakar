
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, Search, Filter, ChevronDown, Sparkles, FilterX
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [readIds, setReadIds] = useState<string[]>([]);

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

  const loadMore = () => {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchAnnouncements(nextPage);
  };

  const displayedAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const targetClass = ann.className || 'Général';
      
      // Visibilité de base : Admin voit tout, Étudiant voit sa classe + Général
      const canSee = user?.role === UserRole.ADMIN 
        ? true 
        : (targetClass === user?.className || targetClass === 'Général');
      
      if (!canSee) return false;

      const matchesSearch = ann.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ann.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;
      
      const matchesClassFilter = classFilter === 'all' || targetClass === classFilter;

      return matchesSearch && matchesPriority && matchesClassFilter;
    });
  }, [user, announcements, searchTerm, priorityFilter, classFilter]);

  const handleMarkAsRead = (id: string) => {
    if (user?.role === UserRole.STUDENT && !readIds.includes(id)) {
        const newIds = [...readIds, id];
        setReadIds(newIds);
        localStorage.setItem(`uniconnect_read_anns_${user.id}`, JSON.stringify(newIds));
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
                type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 focus:border-primary-300 transition-all font-medium"
             />
           </div>
           
           <div className="flex items-center gap-2 w-full md:w-auto">
               <select 
                 value={classFilter} onChange={e => setClassFilter(e.target.value)}
                 className="flex-1 md:flex-none px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-black text-gray-600 dark:text-gray-300 outline-none uppercase tracking-widest"
               >
                  <option value="all">Classe (Toutes)</option>
                  <option value="Général">Général</option>
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
               </select>

               <select 
                 value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                 className="flex-1 md:flex-none px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-black text-gray-600 dark:text-gray-300 outline-none uppercase tracking-widest"
               >
                  <option value="all">Priorité</option>
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
               </select>
           </div>
        </div>
      </div>

      <div className="grid gap-6">
        {displayedAnnouncements.map((ann) => {
          const isUnread = user?.role === UserRole.STUDENT && !readIds.includes(ann.id);
          const dateStr = new Date(ann.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
          
          return (
            <div 
              key={ann.id} onClick={() => handleMarkAsRead(ann.id)}
              className={`group relative rounded-[2.5rem] border p-8 transition-all duration-300 flex flex-col md:flex-row gap-8 hover:-translate-y-1 hover:shadow-2xl ${
                isUnread 
                  ? 'bg-white dark:bg-gray-900 border-primary-200 shadow-xl' 
                  : 'bg-gray-50/50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800'
              }`}
            >
              {isUnread && (
                  <div className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1 bg-primary-500 text-white text-[9px] font-black uppercase rounded-full shadow-lg shadow-primary-500/20">
                      <Sparkles size={12} /> Nouveau
                  </div>
              )}

              <div className="flex flex-col items-center justify-center w-20 h-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 flex-shrink-0 shadow-sm">
                  <span className="text-[9px] font-black text-gray-400 uppercase">{new Date(ann.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">{new Date(ann.date).getDate()}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest ${
                    ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30' : 
                    ann.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-primary-50 text-primary-600 border-primary-100'
                  }`}>
                    {ann.priority}
                  </span>
                  <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-400 tracking-widest">
                    {ann.className || 'Général'}
                  </span>
                  <span className="text-[8px] font-black uppercase text-gray-300 ml-auto flex items-center gap-1"><Sparkles size={10}/> Posté par {ann.author}</span>
                </div>
                
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter italic leading-tight group-hover:text-primary-600 transition-colors">
                  {ann.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium italic opacity-90 line-clamp-4">
                  {ann.content}
                </p>
              </div>
            </div>
          );
        })}
        
        {displayedAnnouncements.length === 0 && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <FilterX size={64} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucun avis ne correspond à vos filtres</p>
           </div>
        )}
      </div>

      {hasMore && (
          <div className="flex justify-center pt-8">
              <button 
                onClick={loadMore} disabled={loadingMore}
                className="flex items-center gap-3 px-10 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black rounded-[2rem] shadow-2xl transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-[0.2em]"
              >
                {loadingMore ? <Loader2 className="animate-spin" size={18} /> : <ChevronDown size={18} />}
                {loadingMore ? 'Chargement...' : 'Afficher plus d\'avis'}
              </button>
          </div>
      )}
    </div>
  );
}

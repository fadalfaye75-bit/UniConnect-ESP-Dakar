
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, Search, Filter, ChevronDown, Sparkles
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE = 15;

export default function Announcements() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
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
      
      if (isRefresh) {
          setAnnouncements(data);
      } else {
          setAnnouncements(prev => [...prev, ...data]);
      }
      
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
    
    const subscription = API.announcements.subscribe(() => {
        fetchAnnouncements(0, true);
    });

    if (user) {
        const storedReads = localStorage.getItem(`uniconnect_read_anns_${user.id}`);
        if (storedReads) {
            try { setReadIds(JSON.parse(storedReads)); } catch(e) {}
        }
    }

    return () => {
        subscription.unsubscribe();
    };
  }, [user, adminViewClass, fetchAnnouncements]);

  const loadMore = () => {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchAnnouncements(nextPage);
  };

  const displayedAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? (ann.className === adminViewClass || ann.className === 'Général') : true)
        : (ann.className === user?.className || ann.className === 'Général');
      
      const matchesSearch = ann.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ann.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;

      return matchesClass && matchesSearch && matchesPriority;
    });
  }, [user, adminViewClass, announcements, searchTerm, priorityFilter]);

  const handleMarkAsRead = (id: string) => {
    if (user?.role === UserRole.STUDENT && !readIds.includes(id)) {
        const newIds = [...readIds, id];
        setReadIds(newIds);
        localStorage.setItem(`uniconnect_read_anns_${user.id}`, JSON.stringify(newIds));
    }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 py-4 backdrop-blur-sm gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Megaphone className="text-primary-500" size={24} /> Avis & Annonces
        </h2>
        
        <div className="flex flex-1 items-center gap-2 max-w-xl">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
             <input 
                type="text" 
                placeholder="Chercher une annonce..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all"
             />
           </div>
           <select 
             value={priorityFilter}
             onChange={e => setPriorityFilter(e.target.value)}
             className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 outline-none"
           >
              <option value="all">Priorité (Toutes)</option>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
           </select>
        </div>
      </div>

      <div className="space-y-4">
        {displayedAnnouncements.map((ann) => {
          const isUnread = user?.role === UserRole.STUDENT && !readIds.includes(ann.id);
          return (
            <div 
              key={ann.id} 
              onClick={() => handleMarkAsRead(ann.id)}
              className={`relative rounded-2xl border shadow-sm p-6 transition-all duration-300 ${isUnread ? 'bg-white dark:bg-gray-800 border-primary-400 shadow-md' : 'bg-gray-50/50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}
            >
              {isUnread && (
                  <div className="absolute -top-2 -right-2 bg-primary-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-lg shadow-lg flex items-center gap-1">
                      <Sparkles size={10} /> Nouveau
                  </div>
              )}
              <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{ann.author}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[10px] text-gray-400 font-bold">{new Date(ann.date).toLocaleDateString()}</span>
                 </div>
                 <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                    ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30' : 
                    ann.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-gray-50 text-gray-400'
                 }`}>
                    {ann.priority}
                 </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{ann.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
            </div>
          );
        })}
      </div>

      {hasMore && (
          <div className="flex justify-center pt-8">
              <button 
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-8 py-3 bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 font-bold rounded-2xl border border-primary-100 dark:border-primary-800 shadow-soft hover:shadow-xl transition-all disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="animate-spin" size={20} /> : <ChevronDown size={20} />}
                {loadingMore ? 'Chargement...' : 'Charger plus d\'annonces'}
              </button>
          </div>
      )}
    </div>
  );
}


import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Megaphone, Calendar, GraduationCap, Video, 
  BarChart2, Search, LogOut, Menu, X, Moon, Sun, 
  ShieldCheck, UserCircle, Bell, Check, Trash2, Info, AlertTriangle, CheckCircle, AlertCircle, Settings, Loader2, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { AppNotification } from '../types';

interface SearchResult {
  id: string;
  type: 'Annonce' | 'Examen' | 'Visio' | 'Sondage' | 'Fichier';
  title: string;
  subtitle?: string;
  link: string;
  date?: string;
}

export default function Layout() {
  const { user, logout, toggleTheme, isDarkMode, adminViewClass, setAdminViewClass } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications, requestPermission, permission } = useNotification();
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  
  const [classesList, setClassesList] = useState<{id: string, name: string}[]>([]);
  
  // Cache local pour la recherche pour éviter de requêter l'API à chaque lettre
  const [fullData, setFullData] = useState<{
    anns: any[],
    exams: any[],
    meets: any[],
    polls: any[]
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
      if (user?.role === 'ADMIN') {
          API.classes.list().then(data => setClassesList(data));
      }
  }, [user]);

  // Pré-chargement des données de recherche quand le modal s'ouvre
  useEffect(() => {
    if (isSearchOpen && !fullData) {
      const loadSearchData = async () => {
        const [anns, exams, meets, polls] = await Promise.all([
          API.announcements.list(100),
          API.exams.list(),
          API.meet.list(),
          API.polls.list()
        ]);
        setFullData({ anns, exams, meets, polls });
      };
      loadSearchData();
    }
  }, [isSearchOpen, fullData]);

  // Filtrage local performant des résultats de recherche
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !fullData) return [];
    
    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    fullData.anns.forEach(a => {
      if (a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query)) {
        results.push({ id: a.id, type: 'Annonce', title: a.title, subtitle: a.author, link: '/announcements', date: a.date });
      }
    });

    fullData.exams.forEach(e => {
      if (e.subject.toLowerCase().includes(query) || e.room.toLowerCase().includes(query)) {
        results.push({ id: e.id, type: 'Examen', title: e.subject, subtitle: `Salle ${e.room}`, link: '/exams', date: e.date });
      }
    });

    fullData.meets.forEach(m => {
      if (m.title.toLowerCase().includes(query)) {
        results.push({ id: m.id, type: 'Visio', title: m.title, subtitle: m.platform, link: '/meet' });
      }
    });

    fullData.polls.forEach(p => {
        if (p.question.toLowerCase().includes(query)) {
            results.push({ id: p.id, type: 'Sondage', title: p.question, link: '/polls' });
        }
    });

    return results.slice(0, 10);
  }, [searchQuery, fullData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      const isRecent = new Date().getTime() - new Date(latest.timestamp).getTime() < 5000;
      if (isRecent && !latest.isRead) {
        setActiveToast(latest);
        const timer = setTimeout(() => setActiveToast(null), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [notifications]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Tableau de Bord' },
    { to: '/announcements', icon: Megaphone, label: 'Annonces' },
    { to: '/schedule', icon: Calendar, label: 'Emploi du Temps' },
    { to: '/exams', icon: GraduationCap, label: 'Examens' },
    { to: '/meet', icon: Video, label: 'Visioconférence' },
    { to: '/polls', icon: BarChart2, label: 'Consultations' },
    { to: '/profile', icon: Settings, label: 'Mon Profil' },
  ];

  if (user?.role === 'ADMIN') {
    navItems.push({ to: '/admin', icon: ShieldCheck, label: 'Administration' });
  }

  const handleResultClick = (link: string) => {
    setSearchOpen(false);
    navigate(link);
  };

  const handleNotifClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
      setNotifOpen(false);
    }
  };

  const getNotifIcon = (type: string) => {
    switch(type) {
      case 'warning': return <AlertTriangle size={16} className="text-orange-500" />;
      case 'success': return <CheckCircle size={16} className="text-primary-500" />;
      case 'alert': return <AlertCircle size={16} className="text-red-500" />;
      default: return <Info size={16} className="text-primary-400" />;
    }
  };

  const handleLogout = () => {
    if (window.confirm("Se déconnecter de la plateforme ?")) {
      logout();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 transition-colors font-sans">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-800/60 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-lg md:shadow-none flex flex-col`}>
        <div className="flex items-center justify-between p-6 h-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center text-primary-500 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">UniConnect</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <NavLink to="/profile" className="flex items-center gap-3 mb-8 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
             <div className="relative">
                <img src={user?.avatar} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-primary-100 dark:border-gray-600" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-bold truncate text-gray-800 dark:text-white">{user?.name}</p>
               <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium">{user?.role === 'ADMIN' ? 'Admin' : user?.className}</p>
             </div>
          </NavLink>

          {user?.role === 'ADMIN' && (
            <div className="mb-6 px-1">
               <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider ml-2 mb-2 block">Vue Administrative</label>
               <select 
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-primary-300 transition-all"
                value={adminViewClass || ''}
                onChange={(e) => setAdminViewClass(e.target.value || null)}
               >
                 <option value="">Toutes les classes</option>
                 {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
               </select>
            </div>
          )}

          <nav className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider ml-2 mb-2 block">Menu Principal</label>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 
                  ${isActive 
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300 shadow-sm border border-primary-100 dark:border-primary-800/30' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                <item.icon size={18} className="text-current opacity-70" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 m-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden bg-gray-50/50 dark:bg-gray-900">
        <header className="h-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 flex items-center justify-between px-6 z-20 sticky top-0">
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
              <Menu size={24} />
            </button>
            <span className="font-bold text-lg text-gray-800 dark:text-white">UniConnect</span>
          </div>

          <div className="hidden md:flex flex-1 max-w-md">
             <div 
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-white hover:shadow-sm hover:ring-2 hover:ring-primary-100 border border-gray-100 dark:border-gray-600 transition-all cursor-text group"
             >
               <Search size={18} className="group-hover:text-primary-500 transition-colors" />
               <span>Rechercher... (Ctrl + K)</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <button onClick={() => setSearchOpen(true)} className="md:hidden p-2 text-gray-600 dark:text-gray-300">
                <Search size={20} />
             </button>
             
             <div className="relative" ref={notifRef}>
                <button onClick={() => setNotifOpen(!isNotifOpen)} className={`p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl relative transition-colors`}>
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-primary-500 rounded-full ring-2 ring-white dark:ring-gray-800"></span>
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 mt-4 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                     <div className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800">
                       <h3 className="font-bold text-sm text-gray-800 dark:text-white">Notifications</h3>
                       <div className="flex gap-1">
                         <button onClick={markAllAsRead} className="p-1.5 text-primary-600 hover:bg-primary-50 dark:text-primary-400 rounded-lg"><Check size={16} /></button>
                         <button onClick={() => { if(window.confirm('Effacer tout?')) clearNotifications(); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={16} /></button>
                       </div>
                     </div>
                     
                     <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                            <Bell size={24} className="opacity-20 mb-2" />
                            <span className="text-sm">Aucune notification</span>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div key={notif.id} onClick={() => handleNotifClick(notif)} className={`p-4 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-primary-50/20' : ''}`}>
                              <div className="flex gap-3">
                                <div className="mt-0.5">{getNotifIcon(notif.type)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className={`text-sm truncate ${!notif.isRead ? 'font-bold' : 'text-gray-600'}`}>{notif.title}</h4>
                                    <span className="text-[10px] text-gray-400">{new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 line-clamp-2">{notif.message}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                     </div>
                  </div>
                )}
             </div>

             <button onClick={toggleTheme} className="p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
               {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             
             <div className="hidden sm:flex items-center gap-2">
                <span className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    user?.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                    user?.role === 'DELEGATE' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                }`}>
                  {user?.role === 'DELEGATE' ? 'Délégué' : user?.role === 'ADMIN' ? 'Admin' : 'Étudiant'}
                </span>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 md:pb-8 bg-gray-50/50 dark:bg-gray-900 custom-scrollbar">
          <Outlet />
        </main>

        <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around py-3 z-30 shadow-soft">
          <NavLink to="/" className={({isActive}) => `p-2 rounded-xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-gray-700' : 'text-gray-400'}`}>
            <LayoutDashboard size={24} />
          </NavLink>
          <NavLink to="/announcements" className={({isActive}) => `p-2 rounded-xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-gray-700' : 'text-gray-400'}`}>
            <Megaphone size={24} />
          </NavLink>
          <NavLink to="/exams" className={({isActive}) => `p-2 rounded-xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-gray-700' : 'text-gray-400'}`}>
            <GraduationCap size={24} />
          </NavLink>
          <NavLink to="/profile" className={({isActive}) => `p-2 rounded-xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-gray-700' : 'text-gray-400'}`}>
             <UserCircle size={24} />
          </NavLink>
        </nav>
      </div>

      {activeToast && (
        <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-100 dark:border-gray-700 animate-in slide-in-from-right-10 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500"></div>
          <div className="p-4 flex gap-3">
             <div className="mt-0.5">{getNotifIcon(activeToast.type)}</div>
             <div className="flex-1">
               <h4 className="text-sm font-bold truncate">{activeToast.title}</h4>
               <p className="text-xs text-gray-500 line-clamp-2">{activeToast.message}</p>
             </div>
             <button onClick={() => setActiveToast(null)} className="text-gray-300 hover:text-gray-500"><X size={16} /></button>
          </div>
        </div>
      )}

      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
           <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[70vh] border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
             <div className="relative border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <Search className="absolute left-5 top-5 text-gray-400" size={20} />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Rechercher partout... (Java, Examen, Salle 102...)"
                  className="w-full py-5 pl-14 pr-4 bg-transparent text-lg text-gray-800 dark:text-white outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             
             <div className="flex-1 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900/20 custom-scrollbar">
               {!fullData ? (
                   <div className="py-12 flex flex-col items-center text-gray-400">
                       <Loader2 size={32} className="animate-spin mb-2 text-primary-500" />
                       <span className="text-sm font-medium">Initialisation des données...</span>
                   </div>
               ) : searchResults.length > 0 ? (
                  <div className="space-y-1">
                     <h3 className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Résultats suggérés</h3>
                     {searchResults.map((result) => (
                        <button key={`${result.type}-${result.id}`} onClick={() => handleResultClick(result.link)} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white dark:hover:bg-gray-700 transition-all group text-left">
                           <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                              ${result.type === 'Annonce' ? 'bg-blue-100 text-blue-600' : 
                                result.type === 'Examen' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}
                           `}>
                              {result.type === 'Annonce' ? <Megaphone size={18} /> : 
                               result.type === 'Examen' ? <GraduationCap size={18} /> : <Search size={18} />}
                           </div>
                           <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-800 dark:text-white truncate group-hover:text-primary-600">{result.title}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                 <span className="font-bold uppercase text-[9px]">{result.type}</span>
                                 {result.subtitle && <span className="truncate opacity-60">• {result.subtitle}</span>}
                              </div>
                           </div>
                           <ArrowRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                     ))}
                  </div>
               ) : searchQuery.length > 1 ? (
                  <div className="py-12 text-center text-gray-400">
                     <Search size={32} className="mx-auto mb-2 opacity-20" />
                     <p className="text-sm">Aucun résultat pour "{searchQuery}"</p>
                  </div>
               ) : (
                 <div className="p-4 space-y-4">
                   <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Navigation Rapide</h3>
                   <div className="grid grid-cols-2 gap-3">
                     <button onClick={() => handleResultClick('/schedule')} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-sm font-bold hover:shadow-md transition-all">
                        <Calendar size={18} className="text-green-500" /> Planning
                     </button>
                     <button onClick={() => handleResultClick('/polls')} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-sm font-bold hover:shadow-md transition-all">
                        <BarChart2 size={18} className="text-purple-500" /> Sondages
                     </button>
                   </div>
                 </div>
               )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

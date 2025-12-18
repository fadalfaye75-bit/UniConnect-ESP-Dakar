
import React, { useState, useEffect, useRef } from 'react';
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  
  // State for Classes Dropdown (Fetched from API now)
  const [classesList, setClassesList] = useState<{id: string, name: string}[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Fetch classes for Admin filter
  useEffect(() => {
      if (user?.role === 'ADMIN') {
          API.classes.list().then(data => setClassesList(data));
      }
  }, [user]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isSearchOpen) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isSearchOpen]);

  // Global Search Logic
  useEffect(() => {
    if (!isSearchOpen || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const query = searchQuery.toLowerCase();
        const results: SearchResult[] = [];

        // Fetch all data (Simulated)
        const [anns, exams, meets, polls] = await Promise.all([
          API.announcements.list(),
          API.exams.list(),
          API.meet.list(),
          API.polls.list()
        ]);

        // Filter Announcements
        anns.forEach(a => {
          if (a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query)) {
            results.push({ id: a.id, type: 'Annonce', title: a.title, subtitle: a.author, link: '/announcements', date: a.date });
          }
        });

        // Filter Exams
        exams.forEach(e => {
          if (e.subject.toLowerCase().includes(query) || e.room.toLowerCase().includes(query)) {
            results.push({ id: e.id, type: 'Examen', title: e.subject, subtitle: `Salle ${e.room}`, link: '/exams', date: e.date });
          }
        });

        // Filter Meets
        meets.forEach(m => {
          if (m.title.toLowerCase().includes(query)) {
            results.push({ id: m.id, type: 'Visio', title: m.title, subtitle: m.platform, link: '/meet', date: undefined });
          }
        });

        // Filter Polls
        polls.forEach(p => {
            if (p.question.toLowerCase().includes(query)) {
                results.push({ id: p.id, type: 'Sondage', title: p.question, link: '/polls' });
            }
        });

        setSearchResults(results.slice(0, 10)); // Limit to 10 results
      } catch (e) {
        console.error("Search error", e);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchOpen]);

  // Global Search Shortcut (Ctrl + K)
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

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for new notifications to show toast
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

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
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
      case 'success': return <CheckCircle size={16} className="text-primary-500" />; // Sky Blue for success
      case 'alert': return <AlertCircle size={16} className="text-red-500" />;
      default: return <Info size={16} className="text-primary-400" />;
    }
  };

  const handleClearNotifications = () => {
    if (notifications.length === 0) return;
    if (window.confirm('Voulez-vous vraiment effacer toutes les notifications ?')) {
      clearNotifications();
    }
  };

  const handleLogout = () => {
    if (window.confirm("Voulez-vous vraiment vous déconnecter de la plateforme ?")) {
      logout();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 transition-colors font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-800/60 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-lg md:shadow-none flex flex-col`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 h-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center text-primary-300 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
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

        {/* Sidebar Content */}
        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* User Mini Profile */}
          <NavLink to="/profile" className="flex items-center gap-3 mb-8 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
             <div className="relative">
                <img 
                 src={user?.avatar} 
                 alt="Profile" 
                 className="w-10 h-10 rounded-full object-cover border-2 border-primary-100 dark:border-gray-600" 
               />
               <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-bold truncate text-gray-800 dark:text-white">{user?.name}</p>
               <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium">
                 {user?.role === 'ADMIN' ? 'Admin' : user?.className}
               </p>
             </div>
          </NavLink>

          {user?.role === 'ADMIN' && (
            <div className="mb-6 px-1">
               <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider ml-2 mb-2 block">Vue Administrative</label>
               <select 
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none text-gray-600 font-medium"
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
                {({ isActive }) => (
                  <>
                    <item.icon size={18} className={isActive ? 'text-primary-500' : 'text-gray-400'} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 m-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden bg-gray-50/50 dark:bg-gray-900">
        
        {/* Top Header */}
        <header className="h-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 flex items-center justify-between px-6 z-20 sticky top-0">
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
              <Menu size={24} />
            </button>
            <span className="font-bold text-lg text-gray-800 dark:text-white">UniConnect</span>
          </div>

          {/* Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md">
             <div 
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-white hover:shadow-sm hover:ring-2 hover:ring-primary-100 border border-gray-100 hover:border-primary-200 dark:border-gray-600 dark:hover:border-gray-500 transition-all cursor-text group"
             >
               <Search size={18} className="group-hover:text-primary-400 transition-colors" />
               <span>Rechercher... (Ctrl + K)</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <button onClick={() => setSearchOpen(true)} className="md:hidden p-2 text-gray-600 dark:text-gray-300">
                <Search size={20} />
             </button>
             
             {/* Notification Bell */}
             <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setNotifOpen(!isNotifOpen)}
                  className={`p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl relative transition-colors ${unreadCount > 0 ? 'animate-pulse-slow' : ''}`}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white dark:ring-gray-800"></span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {isNotifOpen && (
                  <div className="absolute right-0 mt-4 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                     <div className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800">
                       <h3 className="font-bold text-sm text-gray-800 dark:text-white">Notifications</h3>
                       <div className="flex gap-1">
                         {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="p-1.5 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20 rounded-lg transition-colors" title="Tout marquer comme lu">
                              <Check size={16} />
                            </button>
                         )}
                         <button onClick={handleClearNotifications} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Effacer tout">
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </div>
                     
                     <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {permission === 'default' && (
                            <div className="p-4 mx-4 mt-4 mb-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2 font-medium">Activez les notifications pour ne rien rater des examens et annonces.</p>
                                <button onClick={requestPermission} className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm">
                                    Activer les notifications
                                </button>
                            </div>
                        )}

                        {notifications.length === 0 ? (
                          <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400">
                            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                                <Bell size={20} className="opacity-50" />
                            </div>
                            <span className="text-sm font-medium">Vous êtes à jour !</span>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div 
                              key={notif.id} 
                              onClick={() => handleNotifClick(notif)}
                              className={`p-4 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                            >
                              <div className="flex gap-3">
                                <div className={`mt-0.5 flex-shrink-0 ${!notif.isRead ? 'text-primary-500' : 'text-gray-400'}`}>
                                   {getNotifIcon(notif.type)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className={`text-sm ${!notif.isRead ? 'font-bold text-gray-800 dark:text-white' : 'font-medium text-gray-600 dark:text-gray-300'}`}>
                                      {notif.title}
                                    </h4>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                      {new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                    {notif.message}
                                  </p>
                                </div>
                                {!notif.isRead && (
                                  <div className="flex-shrink-0 self-center">
                                    <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                     </div>
                     <div className="p-3 border-t border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 text-center">
                        <NavLink to="/announcements" onClick={() => setNotifOpen(false)} className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 uppercase tracking-wide">
                          Voir toutes les annonces
                        </NavLink>
                     </div>
                  </div>
                )}
             </div>

             <button onClick={toggleTheme} className="p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
               {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             
             <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block"></div>
             
             {/* User Badge */}
             <div className="hidden sm:flex items-center gap-2">
                <span className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    user?.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                    user?.role === 'DELEGATE' ? 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
                    'bg-primary-50 text-primary-700 border border-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800'
                }`}>
                  {user?.role === 'DELEGATE' ? 'Délégué' : user?.role === 'ADMIN' ? 'Admin' : 'Étudiant'}
                </span>
             </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 md:pb-8 bg-gray-50/50 dark:bg-gray-900 relative">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around py-3 pb-safe z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <NavLink to="/" className={({isActive}) => `p-2 rounded-xl transition-colors ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-gray-700 dark:text-white' : 'text-gray-400'}`}>
            <LayoutDashboard size={24} />
          </NavLink>
          <NavLink to="/announcements" className={({isActive}) => `p-2 rounded-xl transition-colors ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-gray-700 dark:text-white' : 'text-gray-400'}`}>
            <Megaphone size={24} />
          </NavLink>
          <NavLink to="/exams" className={({isActive}) => `p-2 rounded-xl transition-colors ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-gray-700 dark:text-white' : 'text-gray-400'}`}>
            <GraduationCap size={24} />
          </NavLink>
          <NavLink to="/profile" className={({isActive}) => `p-2 rounded-xl transition-colors ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-gray-700 dark:text-white' : 'text-gray-400'}`}>
             <UserCircle size={24} />
          </NavLink>
        </nav>
      </div>

      {/* Toast Notification */}
      {activeToast && (
        <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-100 dark:border-gray-700 animate-[slide-in-right_0.4s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-400"></div>
          <div className="p-4 pl-5 flex gap-3">
             <div className="mt-0.5 text-primary-500">{getNotifIcon(activeToast.type)}</div>
             <div className="flex-1">
               <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{activeToast.title}</h4>
               <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{activeToast.message}</p>
             </div>
             <button onClick={() => setActiveToast(null)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-200 transition-colors">
               <X size={16} />
             </button>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 px-4 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSearchOpen(false)}>
           <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-down border border-gray-100 dark:border-gray-700 flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
             <div className="relative border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <Search className="absolute left-5 top-5 text-primary-300 pointer-events-none" size={20} />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Rechercher un cours, un examen, un fichier..."
                  className="w-full py-5 pl-14 pr-4 bg-transparent text-lg text-gray-800 dark:text-white outline-none placeholder-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="absolute right-4 top-5 px-2 py-1 text-xs font-bold text-gray-400 border border-gray-200 rounded dark:text-gray-500 dark:border-gray-600 hover:bg-gray-50 transition-colors">
                  ESC
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900/50">
               {isSearching ? (
                  <div className="py-12 flex flex-col items-center text-gray-400">
                     <Loader2 size={24} className="animate-spin mb-2 text-primary-500" />
                     <span className="text-sm">Recherche en cours...</span>
                  </div>
               ) : searchResults.length > 0 ? (
                  <div className="space-y-1">
                     <h3 className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50 dark:bg-gray-900/90 backdrop-blur-sm z-10">Résultats ({searchResults.length})</h3>
                     {searchResults.map((result) => (
                        <button 
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleResultClick(result.link)}
                          className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all group text-left"
                        >
                           <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold
                              ${result.type === 'Annonce' ? 'bg-blue-100 text-blue-600' : 
                                result.type === 'Examen' ? 'bg-orange-100 text-orange-600' :
                                result.type === 'Visio' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}
                           `}>
                              {result.type === 'Annonce' ? <Megaphone size={18} /> : 
                               result.type === 'Examen' ? <GraduationCap size={18} /> :
                               result.type === 'Visio' ? <Video size={18} /> : <Search size={18} />}
                           </div>
                           <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-800 dark:text-white truncate group-hover:text-primary-600 transition-colors">{result.title}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                 <span className="font-medium bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">{result.type}</span>
                                 {result.subtitle && <span className="truncate">• {result.subtitle}</span>}
                                 {result.date && <span>• {new Date(result.date).toLocaleDateString()}</span>}
                              </div>
                           </div>
                           <ArrowRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
                        </button>
                     ))}
                  </div>
               ) : searchQuery.length > 1 ? (
                  <div className="py-12 text-center text-gray-400">
                     <Search size={32} className="mx-auto mb-2 opacity-50" />
                     <p className="text-sm">Aucun résultat pour "{searchQuery}"</p>
                  </div>
               ) : (
                 <div className="space-y-3 p-4">
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Raccourcis Rapides</h3>
                   <button onClick={() => handleResultClick('/schedule')} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors w-full p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg">
                      <Calendar size={16} /> Emploi du temps
                   </button>
                   <button onClick={() => handleResultClick('/exams')} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors w-full p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg">
                      <GraduationCap size={16} /> Examens à venir
                   </button>
                 </div>
               )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

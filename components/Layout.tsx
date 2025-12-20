
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Megaphone, Calendar, GraduationCap, Video, 
  BarChart2, Search, LogOut, Menu, X, Moon, Sun, 
  ShieldCheck, UserCircle, Bell, Check, Trash2, Info, AlertTriangle, Settings, Loader2, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

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
  const { notifications, unreadCount } = useNotification();
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [classesList, setClassesList] = useState<{id: string, name: string}[]>([]);
  const [fullData, setFullData] = useState<{
    anns: any[],
    exams: any[],
    meets: any[],
    polls: any[]
  } | null>(null);

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

  useEffect(() => {
    if (isSearchOpen && !fullData) {
      const loadSearchData = async () => {
        try {
          const [anns, exams, meets, polls] = await Promise.all([
            API.announcements.list(100),
            API.exams.list(),
            API.meet.list(),
            API.polls.list()
          ]);
          setFullData({ anns, exams, meets, polls });
        } catch (e) {
          console.error("Search data load error", e);
        }
      };
      loadSearchData();
    }
  }, [isSearchOpen, fullData]);

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const navItems = useMemo(() => {
    const items = [
      { to: '/', icon: LayoutDashboard, label: 'Tableau de Bord', end: true },
      { to: '/announcements', icon: Megaphone, label: 'Annonces' },
      { to: '/schedule', icon: Calendar, label: 'Emploi du Temps' },
      { to: '/exams', icon: GraduationCap, label: 'Examens' },
      { to: '/meet', icon: Video, label: 'Visioconférence' },
      { to: '/polls', icon: BarChart2, label: 'Consultations' },
      { to: '/profile', icon: UserCircle, label: 'Mon Profil' },
    ];
    if (user?.role === 'ADMIN') items.push({ to: '/admin', icon: ShieldCheck, label: 'Administration' } as any);
    return items;
  }, [user?.role]);

  const handleLogout = async () => {
    if (window.confirm("Se déconnecter de la plateforme ?")) {
      await logout();
      navigate('/login');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors font-sans overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/60 md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl md:shadow-none flex flex-col`}>
        <div className="flex items-center justify-between p-6 h-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center text-primary-500 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
               < GraduationCap size={24} />
            </div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic">UniConnect</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <NavLink 
            to="/profile" 
            className={({ isActive }) => `flex items-center gap-3 mb-8 p-3 rounded-xl transition-all group border ${isActive ? 'bg-primary-50/80 border-primary-100 dark:bg-primary-900/20 dark:border-primary-800/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'}`}
          >
             <div className="relative flex-shrink-0">
                <img src={user?.avatar} alt="Profile" className="w-14 h-14 rounded-full object-cover border-[4px] border-primary-500 dark:border-primary-400 shadow-xl shadow-primary-500/20 ring-2 ring-white dark:ring-gray-900 transition-all group-hover:scale-110" />
                <div className="absolute bottom-1 right-0.5 w-4 h-4 bg-green-500 border-[3px] border-white dark:border-gray-900 rounded-full shadow-md"></div>
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-black truncate text-gray-900 dark:text-white">{user?.name.split(' ')[0]}</p>
               <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-black uppercase tracking-widest">{user?.role === 'ADMIN' ? 'Admin' : user?.className}</p>
             </div>
          </NavLink>

          <nav className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em] ml-2 mb-2 block">Menu Principal</label>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400'
                  }`}
              >
                <item.icon size={20} className="transition-transform group-hover:scale-110" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 m-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-all">
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 z-20 sticky top-0 transition-all">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <Menu size={24} />
          </button>

          <div className="hidden md:flex flex-1 max-w-md">
             <div onClick={() => setSearchOpen(true)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 transition-all cursor-text group">
               <Search size={18} className="group-hover:text-primary-500 transition-colors" />
               <span className="font-medium">Rechercher... <kbd className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-black border border-gray-200 dark:border-gray-600 rounded">CTRL K</kbd></span>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <button onClick={() => setNotifOpen(!isNotifOpen)} className={`p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl relative transition-all active:scale-95`}>
               <Bell size={22} />
               {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse"></span>}
             </button>

             <button onClick={toggleTheme} className="p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
               {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 bg-gray-50/50 dark:bg-gray-950 custom-scrollbar animate-fade-in">
          <Outlet />
        </main>

        <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800 flex justify-around py-3.5 z-40 rounded-[2rem] shadow-2xl">
          <NavLink to="/" end className={({ isActive }) => `p-3 rounded-2xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'text-gray-400'}`}><LayoutDashboard size={24} /></NavLink>
          <NavLink to="/announcements" className={({ isActive }) => `p-3 rounded-2xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'text-gray-400'}`}><Megaphone size={24} /></NavLink>
          <NavLink to="/exams" className={({ isActive }) => `p-3 rounded-2xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'text-gray-400'}`}><GraduationCap size={24} /></NavLink>
          <NavLink to="/profile" className={({ isActive }) => `p-3 rounded-2xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'text-gray-400'}`}><UserCircle size={24} /></NavLink>
        </nav>
      </div>

      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-gray-950/70 backdrop-blur-md" onClick={() => setSearchOpen(false)}>
           <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
             <div className="relative border-b border-gray-50 dark:border-gray-800">
                <Search className="absolute left-6 top-6 text-gray-400" size={24} />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Chercher partout..."
                  className="w-full py-7 pl-16 pr-6 bg-transparent text-xl font-bold text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button onClick={() => setSearchOpen(false)} className="absolute right-6 top-6 p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"><X size={24} /></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-900/30 custom-scrollbar">
               {searchResults.length > 0 ? (
                  <div className="space-y-2">
                     {searchResults.map((result) => (
                        <button key={`${result.type}-${result.id}`} onClick={() => { setSearchOpen(false); navigate(result.link); }} className="w-full flex items-center gap-5 p-4 rounded-3xl hover:bg-white dark:hover:bg-gray-800 transition-all group text-left shadow-sm hover:shadow-xl border border-transparent hover:border-primary-100">
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110
                              ${result.type === 'Annonce' ? 'bg-blue-50 text-blue-500' : 
                                result.type === 'Examen' ? 'bg-orange-50 text-orange-500' : 'bg-primary-50 text-primary-500'}
                           `}>
                              {result.type === 'Annonce' ? <Megaphone size={20} /> : result.type === 'Examen' ? <GraduationCap size={20} /> : <Search size={20} />}
                           </div>
                           <div className="flex-1 min-w-0">
                              <h4 className="font-black text-gray-900 dark:text-white truncate group-hover:text-primary-600 transition-colors tracking-tight">{result.title}</h4>
                              <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1">
                                 <span className="text-primary-500">{result.type}</span>
                                 {result.subtitle && <span className="truncate opacity-60">• {result.subtitle}</span>}
                              </div>
                           </div>
                           <ArrowRight size={20} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </button>
                     ))}
                  </div>
               ) : (
                  <div className="py-20 text-center text-gray-400">
                     <Search size={64} className="mx-auto mb-6 opacity-5" />
                     <p className="text-sm font-bold uppercase tracking-widest italic">Aucun résultat pour "{searchQuery}"</p>
                  </div>
               )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

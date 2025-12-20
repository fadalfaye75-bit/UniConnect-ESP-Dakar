import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole } from '../types';
import { Clock, FileText, GraduationCap, Loader2, ChevronRight, BarChart2, Calendar, Video, Settings, ArrowRight, User as UserIcon, Sparkles, Megaphone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, adminViewClass } = useAuth();
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || '');
      const isAdmin = user?.role === UserRole.ADMIN && !adminViewClass;

      const [allAnns, allExams] = await Promise.all([
          API.announcements.list(10),
          API.exams.list()
      ]);

      const filteredExams = allExams.filter(e => {
        if (isAdmin) return true;
        return e.className === targetClass;
      }).filter(e => new Date(e.date) >= new Date());

      const filteredAnns = allAnns.filter(a => {
        if (isAdmin) return true;
        return a.className === targetClass || a.className === 'Général';
      });

      setExams(filteredExams.slice(0, 3));
      setAnnouncements(filteredAnns.slice(0, 4));
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  }, [user, adminViewClass]);

  useEffect(() => {
    if (user) {
      fetchDashboardData(true);
      
      // Temps réel pour le Dashboard aussi !
      const subAnn = API.announcements.subscribe(() => fetchDashboardData(false));
      const subPoll = API.polls.subscribe(() => fetchDashboardData(false));
      
      return () => {
        subAnn.unsubscribe();
        subPoll.unsubscribe();
      };
    }
  }, [user, adminViewClass, fetchDashboardData]);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-160px)] gap-6">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin"></div>
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-500 animate-pulse" size={24} />
        </div>
        <span className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] animate-pulse">UniConnect Live...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-10 max-w-7xl mx-auto animate-fade-in pb-20 md:pb-12 px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-primary-500" size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 italic">UniConnect Live Sync</span>
           </div>
           <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight">
             Salut, <span className="text-primary-600 block sm:inline">{user?.name.split(' ')[0]}</span>
           </h2>
           <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base font-medium italic opacity-80">
             "Le savoir est l'arme la plus puissante."
           </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-black text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 px-6 py-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-soft uppercase tracking-[0.2em] self-start sm:self-auto">
          <Calendar size={16} className="text-primary-500" />
          {formattedDate}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Link to="/announcements" className="bg-white dark:bg-gray-900 p-5 md:p-7 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 hover:scale-105 active:scale-95 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 relative z-10">
             <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Infos</div>
             <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors"><Megaphone size={20} /></div>
          </div>
          <div className="text-4xl font-black text-gray-900 dark:text-white relative z-10">{announcements.length}</div>
          <div className="mt-1 text-[9px] text-gray-400 font-black uppercase tracking-widest relative z-10">Annonces</div>
          <div className="absolute -bottom-4 -right-4 text-blue-500/5 group-hover:text-blue-500/10 transition-colors">
            <Megaphone size={120} />
          </div>
        </Link>
        <Link to="/exams" className="bg-white dark:bg-gray-900 p-5 md:p-7 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 hover:scale-105 active:scale-95 transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 relative z-10">
             <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Examens</div>
             <div className="p-3 bg-orange-50 dark:bg-orange-900/30 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-colors"><GraduationCap size={20} /></div>
          </div>
          <div className="text-4xl font-black text-gray-900 dark:text-white relative z-10">{exams.length}</div>
          <div className="mt-1 text-[9px] text-gray-400 font-black uppercase tracking-widest relative z-10">Epreuves</div>
          <div className="absolute -bottom-4 -right-4 text-orange-500/5 group-hover:text-orange-500/10 transition-colors">
            <GraduationCap size={120} />
          </div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 md:gap-10">
        <div className="lg:col-span-2 space-y-10">
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-[0.3em]">Agenda Prioritaire</h3>
              <Link to="/exams" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest flex items-center gap-1">Tous <ArrowRight size={12}/></Link>
            </div>
            {exams.length > 0 ? (
              <div className="grid gap-5">
                 {exams.map(exam => (
                   <div key={exam.id} onClick={() => navigate('/exams')} className="bg-white dark:bg-gray-900 p-5 sm:p-7 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 flex items-center justify-between hover:border-primary-400 hover:shadow-2xl transition-all cursor-pointer group active:scale-[0.98]">
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-3xl flex flex-col items-center justify-center border border-orange-100 dark:border-orange-800/50 shadow-sm transition-transform group-hover:rotate-3">
                            <span className="text-[10px] font-black uppercase">{new Date(exam.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                            <span className="text-2xl sm:text-3xl font-black leading-none">{new Date(exam.date).getDate()}</span>
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-black text-base sm:text-lg text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors truncate tracking-tight">{exam.subject}</h4>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-gray-500 mt-2 font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><Clock size={14} className="text-primary-500" /> {new Date(exam.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                <span className="flex items-center gap-1.5"><FileText size={14} className="text-primary-500" /> {exam.room}</span>
                            </div>
                        </div>
                      </div>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 group-hover:text-primary-500 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-all">
                        <ArrowRight size={20} />
                      </div>
                   </div>
                 ))}
              </div>
            ) : <div className="p-20 bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 text-center text-gray-400 text-sm font-black flex flex-col items-center gap-4">
                    <Calendar size={48} className="opacity-10" />
                    <span className="uppercase tracking-[0.2em] opacity-40 italic">Horizon dégagé pour le moment</span>
                </div>}
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-[0.3em]">Flux d'Annonces</h3>
               <Link to="/announcements" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest flex items-center gap-1">Le Mur <ArrowRight size={12}/></Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 md:gap-8">
              {announcements.map(ann => (
                <div 
                  key={ann.id} 
                  onClick={() => navigate('/announcements')} 
                  className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 hover:shadow-2xl hover:border-primary-400 transition-all cursor-pointer group flex flex-col overflow-hidden p-8 sm:p-10 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-8">
                    <span className={`text-[8px] font-black uppercase px-4 py-2 rounded-2xl border tracking-[0.2em] ${
                        ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 
                        ann.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' : 
                        'bg-primary-50 text-primary-600 border-primary-100 dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-800'
                    }`}>
                        {ann.priority}
                    </span>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-500 flex items-center justify-center font-black text-[10px] border border-primary-100 dark:border-primary-800 transition-transform group-hover:scale-110">
                            {ann.author.charAt(0)}
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-60">{ann.author.split(' ')[0]}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <h4 className="text-xl font-black text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors line-clamp-1 leading-none mb-4 tracking-tighter italic">{ann.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mb-8 flex-1 font-medium italic opacity-90">{ann.content}</p>
                    <div className="flex items-center justify-between mt-auto border-t border-gray-50 dark:border-gray-800 pt-6">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={14} className="text-primary-500" /> {new Date(ann.date).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-primary-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-3 group-hover:translate-x-0 tracking-[0.2em]">
                           Explorer <ArrowRight size={14} />
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-10">
          <div className="bg-gradient-to-br from-primary-600 to-indigo-900 rounded-[3rem] p-8 md:p-12 text-white shadow-3xl group transition-all hover:-translate-y-3 overflow-hidden relative">
             <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-1/4 -translate-y-1/4 group-hover:rotate-12 transition-transform duration-1000">
                <Video size={250} />
             </div>
             <div className="relative z-10">
                <h3 className="text-3xl md:text-4xl font-black mb-4 tracking-tight leading-none italic">Amphi Live</h3>
                <p className="text-primary-100 text-sm mb-12 opacity-90 font-bold leading-relaxed uppercase tracking-widest text-[10px]">L'école partout, tout le temps.</p>
                <Link to="/meet" className="inline-flex items-center justify-center w-full sm:w-auto gap-3 bg-white text-primary-700 px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-gray-50 active:scale-95 transition-all">
                    Entrer en salle <ArrowRight size={18} />
                </Link>
             </div>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 p-8 md:p-10 shadow-soft">
             <h3 className="font-black text-gray-900 dark:text-white mb-10 text-[10px] uppercase tracking-[0.3em] border-b border-gray-50 dark:border-gray-800 pb-6 flex items-center gap-2 italic">
                <Sparkles size={14} className="text-primary-500" /> Navigation Rapide
             </h3>
             <div className="space-y-8">
               <Link to="/schedule" className="flex items-center gap-6 group">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-3xl group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm"><Calendar size={24} /></div>
                  <div className="flex flex-col">
                    <span className="font-black text-base text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors tracking-tight">Planning</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-60">Semaine en cours</span>
                  </div>
               </Link>
               <Link to="/polls" className="flex items-center gap-6 group">
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-3xl group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all shadow-sm"><BarChart2 size={24} /></div>
                  <div className="flex flex-col">
                    <span className="font-black text-base text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors tracking-tight">Sondages</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-60">Votre avis compte</span>
                  </div>
               </Link>
               <Link to="/profile" className="flex items-center gap-6 group">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 text-gray-600 rounded-3xl group-hover:scale-110 group-hover:bg-gray-950 group-hover:text-white transition-all shadow-sm"><Settings size={24} /></div>
                  <div className="flex flex-col">
                    <span className="font-black text-base text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors tracking-tight">Mon Compte</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-60">Gérer mon profil</span>
                  </div>
               </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}


import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole } from '../types';
import { Clock, FileText, GraduationCap, Loader2, ChevronRight, BarChart2, Calendar, Video, Settings, ArrowRight, User as UserIcon, Sparkles } from 'lucide-react';
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
      fetchDashboardData(announcements.length === 0);
    }
  }, [user, adminViewClass, fetchDashboardData]);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-160px)] gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <span className="text-sm font-bold text-gray-400 animate-pulse">Synchronisation ESP...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <Sparkles className="text-primary-500" size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">UniConnect v1.0.2</span>
           </div>
           <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
             Hello, <span className="text-primary-600">{user?.name.split(' ')[0]}</span>
           </h2>
           <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium italic">
             "Le savoir est le seul trésor que l'on peut diviser sans le diminuer."
           </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft uppercase tracking-wider">
          <Calendar size={14} className="text-primary-500" />
          {formattedDate}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/announcements" className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-soft border border-gray-100 dark:border-gray-700 hover:scale-[1.02] active:scale-[0.98] transition-all group overflow-hidden">
          <div className="flex items-center justify-between mb-4">
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Informations</div>
             <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors"><FileText size={20} /></div>
          </div>
          <div className="text-4xl font-black text-gray-900 dark:text-white">{announcements.length}</div>
          <div className="mt-2 text-[10px] text-gray-400 font-black uppercase tracking-widest">Annonces</div>
        </Link>
        <Link to="/exams" className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-soft border border-gray-100 dark:border-gray-700 hover:scale-[1.02] active:scale-[0.98] transition-all group overflow-hidden">
          <div className="flex items-center justify-between mb-4">
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Évaluations</div>
             <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-colors"><GraduationCap size={20} /></div>
          </div>
          <div className="text-4xl font-black text-gray-900 dark:text-white">{exams.length}</div>
          <div className="mt-2 text-[10px] text-gray-400 font-black uppercase tracking-widest">Épreuves</div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-[0.2em]">Agenda de la semaine</h3>
              <Link to="/exams" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest">Voir planning</Link>
            </div>
            {exams.length > 0 ? (
              <div className="grid gap-4">
                 {exams.map(exam => (
                   <div key={exam.id} onClick={() => navigate('/exams')} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-soft border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-primary-400 hover:shadow-lg transition-all cursor-pointer group">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/30 text-orange-600 rounded-2xl flex flex-col items-center justify-center border border-orange-100 dark:border-orange-800">
                            <span className="text-[9px] font-black uppercase">{new Date(exam.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                            <span className="text-xl font-black leading-none">{new Date(exam.date).getDate()}</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{exam.subject}</h4>
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 font-medium">
                                <span className="flex items-center gap-1"><Clock size={12} /> {new Date(exam.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                <span className="flex items-center gap-1"><FileText size={12} /> {exam.room}</span>
                            </div>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-300 group-hover:text-primary-500 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-all">
                        <ChevronRight size={20} />
                      </div>
                   </div>
                 ))}
              </div>
            ) : <div className="p-16 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center text-gray-400 text-sm font-bold flex flex-col items-center gap-3">
                    <Calendar size={32} className="opacity-20" />
                    Aucun examen imminent.
                </div>}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
               <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-[0.2em]">Dernières Publications</h3>
               <Link to="/announcements" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest">Toutes les annonces</Link>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {announcements.map(ann => (
                <div 
                  key={ann.id} 
                  onClick={() => navigate('/announcements')} 
                  className="bg-white dark:bg-gray-800 rounded-3xl shadow-soft border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-primary-300 transition-all cursor-pointer group flex flex-col overflow-hidden p-8"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-xl border tracking-widest ${
                        ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-400' : 
                        ann.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/30 dark:text-orange-400' : 
                        'bg-primary-50 text-primary-600 border-primary-100 dark:bg-primary-900/30 dark:text-primary-400'
                    }`}>
                        {ann.priority}
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-500 flex items-center justify-center font-black text-[10px] border border-primary-100 dark:border-primary-800">
                            {ann.author.charAt(0)}
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{ann.author.split(' ')[0]}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <h4 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors line-clamp-1 leading-tight mb-3 tracking-tight">{ann.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mb-6 flex-1 font-medium">{ann.content}</p>
                    <div className="flex items-center justify-between mt-auto border-t border-gray-50 dark:border-gray-700 pt-5">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={12} className="text-primary-500" /> {new Date(ann.date).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-primary-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 tracking-widest">
                           Lire <ArrowRight size={12} />
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary-600 to-indigo-800 rounded-[2.5rem] p-10 text-white shadow-2xl group transition-all hover:-translate-y-2 overflow-hidden relative">
             <div className="absolute top-0 right-0 p-4 opacity-10 translate-x-1/4 -translate-y-1/4">
                <Video size={160} />
             </div>
             <div className="relative z-10">
                <h3 className="text-3xl font-black mb-3 tracking-tight leading-tight">Accès Amphi Virtuel</h3>
                <p className="text-primary-100 text-sm mb-10 opacity-90 font-medium leading-relaxed">Vos cours interactifs à portée de main. Connectez-vous maintenant.</p>
                <Link to="/meet" className="inline-flex items-center gap-3 bg-white text-primary-700 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-gray-50 active:scale-95 transition-all">
                    Rejoindre le Live <ArrowRight size={16} />
                </Link>
             </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 p-10 shadow-soft">
             <h3 className="font-black text-gray-900 dark:text-white mb-8 text-[10px] uppercase tracking-[0.2em] border-b border-gray-50 dark:border-gray-700 pb-5">Espace Rapide</h3>
             <div className="space-y-6">
               <Link to="/schedule" className="flex items-center gap-5 group">
                  <div className="p-3.5 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-2xl group-hover:scale-110 group-hover:bg-green-500 group-hover:text-white transition-all"><FileText size={22} /></div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">Emploi du Temps</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Semaine en cours</span>
                  </div>
               </Link>
               <Link to="/polls" className="flex items-center gap-5 group">
                  <div className="p-3.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-2xl group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all"><BarChart2 size={22} /></div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">Consultations</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exprimez-vous</span>
                  </div>
               </Link>
               <Link to="/profile" className="flex items-center gap-5 group">
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-700 text-gray-600 rounded-2xl group-hover:scale-110 group-hover:bg-gray-800 group-hover:text-white transition-all"><Settings size={22} /></div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">Paramètres</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mon profil élève</span>
                  </div>
               </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

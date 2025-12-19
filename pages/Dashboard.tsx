
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole } from '../types';
import { Clock, FileText, GraduationCap, Loader2, ChevronRight, BarChart2, Calendar, Video, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, adminViewClass } = useAuth();
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, adminViewClass]);

  const fetchDashboardData = async () => {
    try {
      // On affiche les données déjà présentes en cache si possible (vécu par API.ts)
      setLoading(announcements.length === 0);
      
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || '');
      const isAdmin = user?.role === UserRole.ADMIN && !adminViewClass;

      // Requêtes parallèles pour gagner du temps
      const [allAnns, allExams] = await Promise.all([
          API.announcements.list(5),
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
      setAnnouncements(filteredAnns.slice(0, 3));
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-160px)] gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <span className="text-sm font-bold text-gray-400 animate-pulse">Synchronisation de vos données...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-gray-200 dark:border-gray-700 pb-5 gap-4">
        <div>
           <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">
             Tableau de Bord
           </h2>
           <p className="text-gray-500 dark:text-gray-400 mt-1">
             Bienvenue sur UniConnect, <span className="text-primary-600 font-bold">{user?.name.split(' ')[0]}</span>
           </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft uppercase tracking-wider">
          <Calendar size={14} className="text-primary-500" />
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/announcements" className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:scale-[1.02] transition-all group overflow-hidden">
          <div className="flex items-center justify-between mb-4">
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fil d'actu</div>
             <div className="p-2 bg-blue-50 text-blue-500 rounded-lg"><FileText size={18} /></div>
          </div>
          <div className="text-3xl font-black text-gray-900 dark:text-white">{announcements.length}</div>
          <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase">Annonces récentes</div>
        </Link>
        <Link to="/exams" className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:scale-[1.02] transition-all group overflow-hidden">
          <div className="flex items-center justify-between mb-4">
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Planning</div>
             <div className="p-2 bg-orange-50 text-orange-500 rounded-lg"><GraduationCap size={18} /></div>
          </div>
          <div className="text-3xl font-black text-gray-900 dark:text-white">{exams.length}</div>
          <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase">Épreuves à venir</div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-black text-gray-900 dark:text-white uppercase text-xs tracking-widest">Prochains Rendez-vous</h3>
              <Link to="/exams" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest">Tout voir</Link>
            </div>
            {exams.length > 0 ? (
              <div className="grid gap-4">
                 {exams.map(exam => (
                   <div key={exam.id} onClick={() => navigate('/exams')} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-primary-400 transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl flex flex-col items-center justify-center">
                            <span className="text-[10px] font-black uppercase">{new Date(exam.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                            <span className="text-lg font-black leading-none">{new Date(exam.date).getDate()}</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{exam.subject}</h4>
                            <p className="text-xs text-gray-400 mt-0.5">{exam.room} • {exam.duration}</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                   </div>
                 ))}
              </div>
            ) : <div className="p-12 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center text-gray-400 text-sm font-medium">Calme plat ! Aucun examen imminent.</div>}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
               <h3 className="font-black text-gray-900 dark:text-white uppercase text-xs tracking-widest">Derniers Avis</h3>
               <Link to="/announcements" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest">Lire tout</Link>
            </div>
            <div className="grid gap-4">
              {announcements.map(ann => (
                <div key={ann.id} onClick={() => navigate('/announcements')} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:border-primary-400 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{ann.title}</h4>
                    <span className="text-[10px] font-bold text-gray-400">{new Date(ann.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{ann.content}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-8 text-white shadow-xl group transition-all hover:-translate-y-1 overflow-hidden relative">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Video size={120} />
             </div>
             <h3 className="text-2xl font-black mb-2 relative z-10">Amphi Virtuel</h3>
             <p className="text-primary-100 text-sm mb-8 opacity-90 font-medium relative z-10">Rejoignez vos cours en direct en un clic.</p>
             <Link to="/meet" className="inline-flex items-center gap-2 bg-white text-primary-700 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-primary-50 active:scale-95 transition-all relative z-10">
                Lancer la session <ChevronRight size={14} />
             </Link>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-soft">
             <h3 className="font-black text-gray-900 dark:text-white mb-6 text-xs uppercase tracking-widest border-b border-gray-50 dark:border-gray-700 pb-4">Actions Utiles</h3>
             <div className="space-y-4">
               <Link to="/schedule" className="flex items-center gap-4 group">
                  <div className="p-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl group-hover:scale-110 transition-transform"><FileText size={20} /></div>
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300 group-hover:text-primary-600 transition-colors">Planning de la semaine</span>
               </Link>
               <Link to="/polls" className="flex items-center gap-4 group">
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl group-hover:scale-110 transition-transform"><BarChart2 size={20} /></div>
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300 group-hover:text-primary-600 transition-colors">Consultations en cours</span>
               </Link>
               <Link to="/profile" className="flex items-center gap-4 group">
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-700 text-gray-600 rounded-xl group-hover:scale-110 transition-transform"><Settings size={20} /></div>
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300 group-hover:text-primary-600 transition-colors">Mon compte</span>
               </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}


import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole } from '../types';
import { Clock, FileText, Video, GraduationCap, Loader2, ChevronRight, ArrowRight, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, adminViewClass } = useAuth();
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    announcementsWeek: 0,
    examsWeek: 0,
    totalAnnouncements: 0
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, adminViewClass]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || '');
      const isAdmin = user?.role === UserRole.ADMIN && !adminViewClass;

      // 1. Fetch from API
      const allExams = await API.exams.list();
      const allAnnouncements = await API.announcements.list();

      // 2. Filter Logic
      const filteredExams = allExams.filter(e => {
        if (isAdmin) return true;
        return e.className === targetClass;
      }).filter(e => new Date(e.date) >= new Date()); // Future exams only

      const filteredAnns = allAnnouncements.filter(a => {
        if (isAdmin) return true;
        return a.className === targetClass || a.className === 'Général';
      });

      // 3. Stats Calculation
      const oneWeekAway = new Date();
      oneWeekAway.setDate(oneWeekAway.getDate() + 7);
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const examsNext7Days = filteredExams.filter(e => new Date(e.date) <= oneWeekAway).length;
      const newAnnouncementsCount = filteredAnns.filter(a => new Date(a.date) >= oneWeekAgo).length;

      setExams(filteredExams.slice(0, 5)); // Limit to 5
      setAnnouncements(filteredAnns.slice(0, 5)); // Limit to 5
      setStats({
        examsWeek: examsNext7Days,
        announcementsWeek: newAnnouncementsCount,
        totalAnnouncements: filteredAnns.length
      });

    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-100px)]">
        <Loader2 className="animate-spin text-primary-400" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex items-end justify-between border-b border-gray-200 dark:border-gray-700 pb-5">
        <div>
           <h2 className="text-3xl font-bold text-gray-800 dark:text-white tracking-tight">
             Tableau de Bord
           </h2>
           <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
             Heureux de vous revoir, <span className="text-primary-500 font-semibold">{user?.name.split(' ')[0]}</span> !
           </p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft">
          <Clock size={16} className="text-primary-400" />
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <Link to="/announcements" className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all hover:-translate-y-1 group relative overflow-hidden">
          <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <Bell size={64} className="text-primary-500 rotate-12" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
             <div className="text-sm font-bold text-gray-400 uppercase tracking-wide">Annonces</div>
             <div className="p-2.5 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-xl group-hover:bg-primary-100 transition-colors"><FileText size={20} /></div>
          </div>
          <div className="text-4xl font-bold text-gray-800 dark:text-white mb-2 relative z-10">{stats.totalAnnouncements}</div>
          <div className="text-xs font-medium text-gray-400 relative z-10">
            {stats.announcementsWeek > 0 ? <span className="text-green-500 font-bold">+{stats.announcementsWeek} nouveautés</span> : 'Pas de nouveautés'}
          </div>
        </Link>
        <Link to="/exams" className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all hover:-translate-y-1 group relative overflow-hidden">
          <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <GraduationCap size={64} className="text-orange-500 rotate-12" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
             <div className="text-sm font-bold text-gray-400 uppercase tracking-wide">Examens</div>
             <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-xl group-hover:bg-orange-100 transition-colors"><GraduationCap size={20} /></div>
          </div>
          <div className="text-4xl font-bold text-gray-800 dark:text-white mb-2 relative z-10">{exams.length}</div>
          <div className={`text-xs font-medium relative z-10 ${stats.examsWeek > 0 ? 'text-orange-500 font-bold' : 'text-gray-400'}`}>
            {stats.examsWeek > 0 ? `${stats.examsWeek} prochainement` : 'Rien cette semaine'}
          </div>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Main Feed */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Exams Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                Prochains Examens
              </h3>
              <Link to="/exams" className="text-sm text-primary-500 font-bold hover:text-primary-600 transition-colors flex items-center gap-1">
                Voir tout <ArrowRight size={16} />
              </Link>
            </div>
            
            {exams.length > 0 ? (
              <div className="flex md:flex-col gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0 snap-x">
                 {exams.map(exam => {
                   const daysLeft = Math.ceil((new Date(exam.date).getTime() - Date.now()) / (1000 * 3600 * 24));
                   const isUrgent = daysLeft <= 3 && daysLeft >= 0;
                   return (
                     <div 
                        key={exam.id} 
                        onClick={() => navigate('/exams')}
                        className="min-w-[280px] md:min-w-0 snap-start bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all relative overflow-hidden group cursor-pointer"
                     >
                        {isUrgent && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400"></div>}
                        <div className="pl-2">
                          <h4 className="font-bold text-gray-800 dark:text-white text-lg group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">{exam.subject}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                             <span className="bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-bold text-gray-600 dark:text-gray-300">
                               {new Date(exam.date).toLocaleDateString('fr-FR')}
                             </span>
                             <span className="text-gray-300">•</span>
                             <span>{new Date(exam.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                             <span className="text-xs text-gray-400 font-medium">Salle {exam.room}</span>
                          </div>
                        </div>
                        <div className="text-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl min-w-[70px] group-hover:bg-primary-50 dark:group-hover:bg-gray-700 transition-colors">
                           <span className={`block text-xl font-bold ${isUrgent ? 'text-orange-500' : 'text-primary-500'}`}>
                             J-{daysLeft}
                           </span>
                           <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Restant</span>
                        </div>
                     </div>
                   );
                 })}
              </div>
            ) : (
              <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-gray-400 text-sm">
                Aucun examen programmé.
              </div>
            )}
          </div>

          {/* Announcements Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
               <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  Fil d'actualité
               </h3>
               <Link to="/announcements" className="text-sm text-primary-500 font-bold hover:text-primary-600 transition-colors flex items-center gap-1">
                  Voir tout <ArrowRight size={16} />
               </Link>
            </div>

            <div className="space-y-4">
              {announcements.length > 0 ? (
                announcements.map(ann => (
                  <div 
                    key={ann.id} 
                    onClick={() => navigate('/announcements')}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-[10px] font-bold text-primary-500 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-full uppercase tracking-wide mb-2 inline-block">{ann.author}</span>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-primary-500 transition-colors">{ann.title}</h4>
                      </div>
                      <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{new Date(ann.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">{ann.content}</p>
                    <div className="mt-4 flex items-center gap-2">
                       {ann.isImportant && (
                         <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded border border-red-100 uppercase tracking-wide">Important</span>
                       )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-gray-400 text-sm">
                  Aucune annonce récente.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Virtual Class Widget */}
          <div className="bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
             <div className="absolute -top-4 -right-4 p-4 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
               <Video size={120} />
             </div>
             <div className="relative z-10">
               <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <Video size={20} className="text-white" />
               </div>
               <h3 className="text-xl font-bold mb-2">Classe Virtuelle</h3>
               <p className="text-primary-50 text-sm mb-6 leading-relaxed opacity-90">Accédez directement à vos cours en visioconférence.</p>
               <Link to="/meet" className="inline-flex items-center gap-2 bg-white text-primary-600 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-primary-50 transition-colors">
                 Accéder aux liens
               </Link>
             </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-soft">
             <h3 className="font-bold text-gray-800 dark:text-white mb-4 text-sm uppercase tracking-wide">Accès Rapide</h3>
             <div className="space-y-3">
               <Link to="/schedule" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300 transition-colors group border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-100 transition-colors"><FileText size={18} /></div>
                  <span className="font-bold text-sm">Emploi du temps</span>
                  <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-gray-400" />
               </Link>
               <Link to="/polls" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300 transition-colors group border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors"><FileText size={18} /></div>
                  <span className="font-bold text-sm">Sondages</span>
                  <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-gray-400" />
               </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

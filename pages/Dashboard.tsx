
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole } from '../types';
import { Clock, FileText, GraduationCap, Loader2, ChevronRight, BarChart2 } from 'lucide-react';
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
      setLoading(true);
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || '');
      const isAdmin = user?.role === UserRole.ADMIN && !adminViewClass;

      // On demande très peu d'éléments (3) pour maximiser la vitesse du dashboard
      const [allAnns, allExams] = await Promise.all([
          API.announcements.list(3),
          API.exams.list(3)
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

  const stats = useMemo(() => {
      return {
          totalAnnouncements: announcements.length,
          examsCount: exams.length
      };
  }, [announcements, exams]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-100px)]">
        <Loader2 className="animate-spin text-primary-400" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-gray-200 dark:border-gray-700 pb-5 gap-4">
        <div>
           <h2 className="text-3xl font-bold text-gray-800 dark:text-white tracking-tight">
             Tableau de Bord
           </h2>
           <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
             Heureux de vous revoir, <span className="text-primary-500 font-semibold">{user?.name.split(' ')[0]}</span> !
           </p>
        </div>
        <div className="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft">
          <Clock size={16} className="text-primary-400" />
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Link to="/announcements" className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
             <div className="text-sm font-bold text-gray-400 uppercase">Annonces</div>
             <div className="p-2.5 bg-primary-50 text-primary-500 rounded-xl"><FileText size={20} /></div>
          </div>
          <div className="text-4xl font-bold text-gray-800 dark:text-white">{stats.totalAnnouncements}</div>
        </Link>
        <Link to="/exams" className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
             <div className="text-sm font-bold text-gray-400 uppercase">Examens</div>
             <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl"><GraduationCap size={20} /></div>
          </div>
          <div className="text-4xl font-bold text-gray-800 dark:text-white">{stats.examsCount}</div>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">Prochains Examens</h3>
              <Link to="/exams" className="text-sm text-primary-500 font-bold hover:underline">Voir tout</Link>
            </div>
            {exams.length > 0 ? (
              <div className="space-y-4">
                 {exams.map(exam => (
                   <div key={exam.id} onClick={() => navigate('/exams')} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-primary-300 transition-all cursor-pointer">
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-white">{exam.subject}</h4>
                        <p className="text-sm text-gray-500">{new Date(exam.date).toLocaleDateString()} • {exam.room}</p>
                      </div>
                      <div className="text-primary-500 font-bold">J-{Math.ceil((new Date(exam.date).getTime() - Date.now()) / (1000 * 3600 * 24))}</div>
                   </div>
                 ))}
              </div>
            ) : <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 text-center text-gray-400">Aucun examen imminent.</div>}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
               <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Fil d'actualité</h3>
               <Link to="/announcements" className="text-sm text-primary-500 font-bold hover:underline">Voir tout</Link>
            </div>
            <div className="space-y-4">
              {announcements.map(ann => (
                <div key={ann.id} onClick={() => navigate('/announcements')} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 hover:border-primary-200 transition-all cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900 dark:text-white">{ann.title}</h4>
                    <span className="text-xs text-gray-400">{new Date(ann.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{ann.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl p-6 text-white shadow-lg group transition-transform hover:scale-[1.02]">
             <h3 className="text-xl font-bold mb-2">Classe Virtuelle</h3>
             <p className="text-primary-50 text-sm mb-6 opacity-90">Accédez directement à vos cours en ligne.</p>
             <Link to="/meet" className="inline-block bg-white text-primary-600 px-5 py-2.5 rounded-xl font-bold text-sm">Accéder</Link>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-soft">
             <h3 className="font-bold text-gray-800 dark:text-white mb-4 text-sm uppercase tracking-wide">Accès Rapide</h3>
             <div className="space-y-3">
               <Link to="/schedule" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-gray-600 dark:text-gray-300 transition-colors">
                  <FileText size={18} className="text-green-500" />
                  <span className="font-bold text-sm">Emploi du temps</span>
                  <ChevronRight size={16} className="ml-auto" />
               </Link>
               <Link to="/polls" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-gray-600 dark:text-gray-300 transition-colors">
                  <BarChart2 size={18} className="text-purple-500" />
                  <span className="font-bold text-sm">Sondages</span>
                  <ChevronRight size={16} className="ml-auto" />
               </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

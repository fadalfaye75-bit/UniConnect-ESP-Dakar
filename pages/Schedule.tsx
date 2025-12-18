
import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Download, Clock, Upload, History, Loader2, Trash2, Save, X, Share2, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

export default function Schedule() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  useEffect(() => {
    fetchSchedules();
  }, [user, adminViewClass]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const data = await API.schedules.list();
      setSchedules(data.sort((a,b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedSchedules = useMemo(() => {
    return schedules.filter(sch => {
      if (user?.role === UserRole.ADMIN) {
        return adminViewClass ? sch.className === adminViewClass : true;
      }
      return sch.className === user?.className;
    });
  }, [user, adminViewClass, schedules]);

  const currentSchedule = displayedSchedules[0];
  const history = displayedSchedules.slice(1);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    if (!window.confirm('Mettre en ligne une nouvelle version ?')) {
      e.target.value = ''; 
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const totalDuration = 2000; 
    const intervalTime = 50;
    const steps = totalDuration / intervalTime;
    let currentStep = 0;

    const progressInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 95); 
      setUploadProgress(progress);
    }, intervalTime);

    try {
      await new Promise(resolve => setTimeout(resolve, totalDuration));
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const newVersionNum = currentSchedule ? parseInt(currentSchedule.version.replace(/[^0-9]/g, '')) + 1 : 1;
      
      const fakeUrl = "https://example.com/emploi-du-temps-demo.pdf"; 

      const newSch = await API.schedules.create({
        version: `V${newVersionNum}`,
        url: fakeUrl,
        className: targetClass
      });

      setSchedules(prev => [newSch, ...prev]);
      addNotification({ title: 'Succès', message: `Version V${newVersionNum} mise en ligne.`, type: 'success' });

    } catch (error: any) {
      addNotification({ title: 'Erreur', message: "Échec.", type: 'alert' });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        e.target.value = '';
      }, 500); 
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer ?")) return;

    try {
      await API.schedules.delete(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      addNotification({ title: 'Supprimé', message: 'Fichier supprimé.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de supprimer.', type: 'alert' });
    }
  };

  const handleCopyLink = (sch: ScheduleFile) => {
     navigator.clipboard.writeText(sch.url).then(() => {
        addNotification({ title: 'Lien copié', message: 'URL du fichier copiée.', type: 'success' });
     });
  };

  const handleShare = (sch: ScheduleFile) => {
    const subject = encodeURIComponent(`Emploi du temps ${sch.className} - ${sch.version}`);
    const body = encodeURIComponent(`Voici le lien vers l'emploi du temps (${sch.version}): ${sch.url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between h-14">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Emploi du Temps</h2>
          <p className="text-sm text-gray-500 mt-1">{user?.role === UserRole.ADMIN && adminViewClass ? adminViewClass : user?.className}</p>
        </div>
        
        {canManage && (
          <>
            {uploading ? (
              <div className="flex flex-col items-end justify-center w-48 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-600 dark:text-primary-400 mb-1.5">
                   <Loader2 size={14} className="animate-spin" />
                   <span>Téléchargement {uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <label className="cursor-pointer flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-md hover:scale-105 transition-all">
                <Upload size={18} />
                <span className="hidden sm:inline">Nouvelle Version</span>
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            )}
          </>
        )}
      </div>

      {!currentSchedule ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
           <FileSpreadsheet size={40} className="mx-auto text-green-500 mb-4" />
           <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aucun emploi du temps</h3>
           <p className="text-gray-500 text-sm mt-1">Le fichier n'a pas encore été publié.</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 relative overflow-hidden">
              <div className="flex items-start justify-between mb-8 relative z-10">
                <div className="flex gap-4">
                  <div className="p-4 bg-green-50 rounded-2xl text-green-600 border border-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
                    <FileSpreadsheet size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Planning Semestriel</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{currentSchedule.className}</p>
                  </div>
                </div>
                <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs font-bold px-3 py-1.5 rounded-full uppercase">Actuel</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8 relative z-10 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                <div>
                  <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Version</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{currentSchedule.version}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Date</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{new Date(currentSchedule.uploadDate).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 relative z-10">
                <a href={currentSchedule.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 text-white py-3.5 rounded-xl font-bold shadow-lg transition-colors">
                  <Download size={20} /> Télécharger
                </a>
                <button onClick={() => handleShare(currentSchedule)} className="p-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors" title="Partager">
                    <Share2 size={20} />
                </button>
                <button onClick={() => handleCopyLink(currentSchedule)} className="p-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors" title="Copier le lien">
                    <Copy size={20} />
                </button>
                {canManage && (
                     <button onClick={(e) => handleDelete(e, currentSchedule.id)} className="p-3.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-colors"><Trash2 size={20} /></button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-4">
             <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><History size={18} /> Historique</h3>
             <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-2xl border border-gray-200 dark:border-gray-700 max-h-[400px] overflow-y-auto space-y-1">
                {history.map(sch => (
                    <div key={sch.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 font-bold text-xs flex items-center justify-center dark:bg-green-900/30 dark:text-green-400">{sch.version}</div>
                        <div className="text-xs text-gray-400 font-medium">{new Date(sch.uploadDate).toLocaleDateString()}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleShare(sch)} className="p-1.5 text-gray-400 hover:text-primary-500"><Share2 size={14} /></button>
                        {canManage && <button onClick={(e) => handleDelete(e, sch.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Aucune version précédente</p>}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

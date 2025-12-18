
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, AlertCircle, Share2, Pencil, CalendarClock, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Activity, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Polls() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit & Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [dates, setDates] = useState({ start: '', end: '' });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  useEffect(() => {
    fetchPolls();
    const interval = setInterval(fetchPolls, 60000); 
    return () => clearInterval(interval);
  }, [user, adminViewClass]);

  const fetchPolls = async () => {
    try {
      if(polls.length === 0) setLoading(true); 
      const data = await API.polls.list();
      setPolls(data);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedPolls = useMemo(() => {
    return polls.filter(poll => {
      if (user?.role === UserRole.ADMIN) {
        return adminViewClass ? poll.className === adminViewClass : true;
      }
      return poll.className === user?.className;
    }).sort((a, b) => {
        return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
    });
  }, [user, adminViewClass, polls]);

  const dashboardStats = useMemo(() => {
    const totalVotes = displayedPolls.reduce((acc, p) => acc + p.totalVotes, 0);
    const activePolls = displayedPolls.filter(p => p.isActive).length;
    const avgVotes = displayedPolls.length > 0 ? Math.round(totalVotes / displayedPolls.length) : 0;
    
    const topPolls = [...displayedPolls]
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 5)
        .map(p => ({
            name: p.question.length > 25 ? p.question.substring(0, 25) + '...' : p.question,
            votes: p.totalVotes,
            fullQuestion: p.question
        }));

    return { totalVotes, activePolls, avgVotes, topPolls };
  }, [displayedPolls]);

  const getPollStatus = (poll: Poll) => {
      const now = new Date();
      const start = poll.startTime ? new Date(poll.startTime) : null;
      const end = poll.endTime ? new Date(poll.endTime) : null;

      if (!poll.isActive) return 'closed_manual';
      if (start && now < start) return 'future';
      if (end && now > end) return 'ended';
      return 'active';
  };

  const handleVote = async (pollId: string, optionId: string, status: string) => {
    if (!user) return;
    if (status !== 'active') {
       addNotification({ title: 'Vote impossible', message: 'Ce sondage n\'est pas ouvert.', type: 'warning' });
       return;
    }

    try {
      const currentPoll = polls.find(p => p.id === pollId);
      const isChangingVote = currentPoll?.hasVoted;

      // Fixed: Removed user.id as the API method only takes 2 arguments
      await API.polls.vote(pollId, optionId);
      
      addNotification({ 
          title: isChangingVote ? 'Vote modifié' : 'A voté !', 
          message: isChangingVote ? 'Votre nouveau choix a été enregistré.' : 'Choix enregistré.', 
          type: 'success' 
      });
      fetchPolls();
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error.message || 'Impossible de voter.', type: 'alert' });
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.toggleStatus(poll.id);
      fetchPolls();
    } catch (error) {
       addNotification({ title: 'Erreur', message: 'Impossible de changer le statut.', type: 'alert' });
    }
  };

  const handleShare = (poll: Poll) => {
    const subject = encodeURIComponent(`Sondage: ${poll.question}`);
    const body = encodeURIComponent(`Répondez au sondage : ${poll.question}\n\nAccédez à la plateforme pour voter.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Voulez-vous vraiment supprimer ce sondage ? Cette action est irréversible.')) return;
    try {
      await API.polls.delete(id);
      setPolls(prev => prev.filter(p => p.id !== id));
      addNotification({ title: 'Succès', message: 'Sondage supprimé.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de supprimer.', type: 'alert' });
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setQuestion('');
    setOptions(['', '']);
    setDates({ start: '', end: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (poll: Poll) => {
    setEditingId(poll.id);
    setQuestion(poll.question);
    setOptions(poll.options.map(o => o.label));
    setDates({
        start: poll.startTime ? new Date(poll.startTime).toISOString().slice(0, 16) : '',
        end: poll.endTime ? new Date(poll.endTime).toISOString().slice(0, 16) : ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim() !== '');
    if (validOptions.length < 2) return alert('Min 2 options');
    
    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      
      const payload: any = {
          question,
          startTime: dates.start ? new Date(dates.start).toISOString() : undefined,
          endTime: dates.end ? new Date(dates.end).toISOString() : undefined
      };

      if (editingId) {
        await API.polls.update(editingId, payload);
        fetchPolls();
        addNotification({ title: 'Succès', message: 'Sondage mis à jour.', type: 'success' });
      } else {
        payload.className = targetClass;
        payload.options = validOptions.map((label, idx) => ({ label }));
        
        await API.polls.create(payload);
        fetchPolls(); // Re-fetch to get new ID properly
        addNotification({ title: 'Sondage créé', message: 'Succès.', type: 'success' });
      }

      setIsModalOpen(false);
      setQuestion('');
      setOptions(['', '']);
      setDates({ start: '', end: '' });
      setEditingId(null);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Echec création.', type: 'alert' });
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    const newOpts = [...options];
    newOpts[idx] = val;
    setOptions(newOpts);
  };

  const addOption = () => setOptions([...options, '']);
  const removeOption = (idx: number) => {
      if(options.length <= 2) return;
      setOptions(options.filter((_, i) => i !== idx));
  };

  if (loading) return (
    <div className="flex justify-center items-center h-[calc(100vh-200px)]">
      <Loader2 className="animate-spin text-primary-400" size={48} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Sticky */}
      <div className="flex items-center justify-between sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 py-4 z-20 backdrop-blur-sm">
        <div>
           <h2 className="text-3xl font-bold text-gray-800 dark:text-white tracking-tight flex items-center gap-3">
             <BarChart2 className="text-primary-500" size={32} />
             Consultations
           </h2>
           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 pl-1">Exprimez-vous et participez aux décisions.</p>
        </div>
        {canManage && (
          <button 
            onClick={openNewModal} 
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 transition-all text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:scale-105 active:scale-95"
          >
            <Plus size={18} /> <span className="hidden sm:inline">Nouveau Sondage</span>
          </button>
        )}
      </div>

      {/* DASHBOARD - ADMIN/DELEGATE ONLY */}
      {canManage && displayedPolls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 fade-in duration-500">
           {/* Stats Cards */}
           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                 <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Participation Totale</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{dashboardStats.totalVotes}</h3>
                 </div>
                 <div className="p-3 bg-blue-50 text-blue-500 dark:bg-blue-900/20 rounded-xl">
                    <Users size={24} />
                 </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-blue-500 font-medium">
                 <TrendingUp size={14} /> Sur tous les sondages
              </div>
           </div>

           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                 <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Sondages Actifs</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{dashboardStats.activePolls}</h3>
                 </div>
                 <div className="p-3 bg-green-50 text-green-500 dark:bg-green-900/20 rounded-xl">
                    <Activity size={24} />
                 </div>
              </div>
              <div className="mt-4 text-xs text-gray-400">
                 Sur {displayedPolls.length} sondages créés
              </div>
           </div>

           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                 <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Moyenne Votes/Sondage</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{dashboardStats.avgVotes}</h3>
                 </div>
                 <div className="p-3 bg-purple-50 text-purple-500 dark:bg-purple-900/20 rounded-xl">
                    <BarChart2 size={24} />
                 </div>
              </div>
              <div className="mt-4 w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                 <div className="bg-purple-500 h-full rounded-full" style={{width: '60%'}}></div>
              </div>
           </div>

           {/* Chart */}
           <div className="md:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
               <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Top 5 - Sondages les plus populaires</h3>
               <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardStats.topPolls} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                              <linearGradient id="barGradientActive" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#38bdf8" />
                                <stop offset="100%" stopColor="#0ea5e9" />
                              </linearGradient>
                              <linearGradient id="barGradientInactive" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#cbd5e1" />
                                <stop offset="100%" stopColor="#94a3b8" />
                              </linearGradient>
                          </defs>
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={180} 
                            tick={{fontSize: 12, fill: '#6B7280', fontWeight: 600}} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            cursor={{fill: 'rgba(0,0,0,0.02)'}}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white dark:bg-gray-700 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-600">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">{label}</p>
                                    <p className="text-lg font-black text-gray-800 dark:text-white">
                                        {payload[0].value} <span className="text-sm font-medium text-gray-500">votes</span>
                                    </p>
                                    </div>
                                );
                                }
                                return null;
                            }}
                          />
                          <Bar dataKey="votes" barSize={24} radius={[0, 12, 12, 0]} animationDuration={1000}>
                            {dashboardStats.topPolls.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? "url(#barGradientActive)" : "url(#barGradientInactive)"} />
                            ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
               </div>
           </div>
        </div>
      )}

      {/* POLLS LIST */}
      <div className="grid gap-6 md:grid-cols-2">
        {displayedPolls.map(poll => {
            const status = getPollStatus(poll);
            const totalVotes = poll.totalVotes || 0;
            let statusBadge;
            let statusColor = "";
            switch(status) {
                case 'future': 
                    statusColor = "border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
                    statusBadge = <><Clock size={14} /> À venir</>;
                    break;
                case 'active':
                    statusColor = "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
                    statusBadge = <><Timer size={14} /> En cours</>;
                    break;
                case 'ended':
                    statusColor = "border-gray-200 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
                    statusBadge = <><CheckCircle2 size={14} /> Terminé</>;
                    break;
                case 'closed_manual':
                    statusColor = "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
                    statusBadge = <><Lock size={14} /> Fermé</>;
                    break;
            }

            return (
              <div key={poll.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-soft border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
                
                {/* Header Card */}
                <div className="flex justify-between items-start mb-4">
                   <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${statusColor}`}>
                       {statusBadge}
                   </div>
                   
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleShare(poll)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors" title="Partager">
                             <Share2 size={16} />
                        </button>
                        {canManage && (
                            <>
                                <button onClick={() => handleToggleStatus(poll)} className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${!poll.isActive ? 'text-red-500' : 'text-gray-400'}`} title={poll.isActive ? "Fermer manuellement" : "Ouvrir manuellement"}>
                                    {poll.isActive ? <Unlock size={16} /> : <Lock size={16} />}
                                </button>
                                <button onClick={() => handleEdit(poll)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Modifier">
                                    <Pencil size={16} />
                                </button>
                                <button onClick={(e) => handleDelete(e, poll.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Supprimer">
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                   </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 leading-tight pr-8">
                    {poll.question}
                </h3>

                <div className="space-y-3 flex-1">
                  {poll.options.map(option => {
                    const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = poll.userVoteOptionId === option.id;
                    const showResults = poll.hasVoted || status === 'ended' || (canManage && status !== 'active');
                    const canVote = status === 'active';

                    return (
                      <button 
                        key={option.id}
                        onClick={() => canVote && handleVote(poll.id, option.id, status)}
                        disabled={!canVote}
                        className={`relative w-full text-left rounded-xl overflow-hidden transition-all group/opt h-12
                           ${canVote ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}
                           ${isSelected 
                                ? 'ring-2 ring-primary-400 dark:ring-primary-500 shadow-sm' 
                                : 'border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                        `}
                      >
                         {/* Background Progress Bar */}
                         {showResults && (
                             <div 
                                className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out 
                                    ${isSelected 
                                        ? 'bg-primary-100 dark:bg-primary-900/40' 
                                        : 'bg-gray-100 dark:bg-gray-700/50'}
                                `} 
                                style={{ width: `${percentage}%` }} 
                             />
                         )}
                         
                         {/* Content */}
                         <div className="absolute inset-0 px-4 flex justify-between items-center z-10">
                              <div className="flex items-center gap-3">
                                 {/* Radio Indicator */}
                                 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors 
                                    ${isSelected 
                                        ? 'border-primary-500 bg-primary-500 text-white' 
                                        : 'border-gray-300 dark:border-gray-500 bg-transparent group-hover/opt:border-primary-400'}
                                 `}>
                                     {isSelected && <Check size={12} strokeWidth={4} />}
                                 </div>
                                 <span className={`font-medium text-sm truncate max-w-[180px] sm:max-w-xs ${isSelected ? 'text-primary-900 dark:text-white font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                                     {option.label}
                                 </span>
                              </div>

                              {showResults && (
                                  <span className={`font-bold text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                      {percentage}%
                                  </span>
                              )}
                         </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer Info */}
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                       <BarChart2 size={14} className="text-gray-400" />
                       <span className="text-gray-700 dark:text-gray-300 font-bold">{totalVotes}</span> votes
                    </div>
                    {(poll.startTime || poll.endTime) && (
                        <div className="flex items-center gap-1.5 ml-auto">
                            <CalendarClock size={14} className="text-gray-400" />
                            <span>
                                {poll.endTime ? `Fin le ${new Date(poll.endTime).toLocaleDateString([], {day: 'numeric', month: 'short'})} à ${new Date(poll.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Pas de date limite'}
                            </span>
                        </div>
                    )}
                </div>
              </div>
            );
        })}
        {displayedPolls.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mb-4 text-gray-400">
                   <AlertCircle size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aucun sondage actif</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Revenez plus tard pour participer aux consultations.</p>
            </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier le sondage" : "Nouveau sondage"}>
        <form onSubmit={handleSubmit} className="space-y-5">
           <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Question</label>
              <input 
                required 
                type="text" 
                value={question} 
                onChange={e => setQuestion(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-300 outline-none transition-all"
                placeholder="Ex: Date de l'examen ?" 
              />
           </div>
           
           <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Début (Optionnel)</label>
                  <input 
                    type="datetime-local" 
                    value={dates.start} 
                    onChange={e => setDates({...dates, start: e.target.value})} 
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-primary-300 outline-none"
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Fin (Optionnel)</label>
                  <input 
                    type="datetime-local" 
                    value={dates.end} 
                    onChange={e => setDates({...dates, end: e.target.value})} 
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-primary-300 outline-none"
                  />
              </div>
           </div>

           <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Options de réponse</label>
              <div className="space-y-2">
                 {options.map((opt, idx) => (
                   <div key={idx} className="flex gap-2 relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">{idx + 1}.</div>
                      <input 
                        type="text" 
                        required 
                        value={opt} 
                        onChange={e => handleOptionChange(idx, e.target.value)}
                        placeholder={`Choix ${idx + 1}`}
                        className="flex-1 pl-8 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none"
                      />
                      {options.length > 2 && (
                        <button type="button" onClick={() => removeOption(idx)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                           <X size={20} />
                        </button>
                      )}
                   </div>
                 ))}
              </div>
              <button type="button" onClick={addOption} className="mt-3 text-sm font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20">
                <Plus size={16} /> Ajouter une option
              </button>
           </div>

           <button type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 transition-all hover:-translate-y-0.5 active:scale-[0.99] flex justify-center">
             {editingId ? 'Mettre à jour' : 'Lancer le sondage'}
           </button>
        </form>
      </Modal>
    </div>
  );
}

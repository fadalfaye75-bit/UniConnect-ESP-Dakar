
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, AlertCircle, Share2, Pencil, CalendarClock, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Activity, Users, PieChart as PieChartIcon, Trophy, Search, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

export default function Polls() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedPollForResults, setSelectedPollForResults] = useState<Poll | null>(null);
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  // Edit & Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [dates, setDates] = useState({ start: '', end: '' });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const fetchPolls = useCallback(async (showLoader = false) => {
    try {
      if(showLoader) setLoading(true); 
      const data = await API.polls.list();
      setPolls(data);
      if (selectedPollForResults) {
        const updated = data.find(p => p.id === selectedPollForResults.id);
        if (updated) setSelectedPollForResults(updated);
      }
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger les sondages.', type: 'alert' });
    } finally {
      if(showLoader) setLoading(false);
    }
  }, [addNotification, selectedPollForResults]);

  useEffect(() => {
    fetchPolls(true);
    const interval = setInterval(() => fetchPolls(false), 120000); 
    return () => clearInterval(interval);
  }, [fetchPolls, user, adminViewClass]);

  const displayedPolls = useMemo(() => {
    return polls.filter(poll => {
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? poll.className === adminViewClass : true)
        : (poll.className === user?.className || poll.className === 'Général');
      
      const matchesSearch = poll.question.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && poll.isActive) ||
                           (statusFilter === 'closed' && !poll.isActive);

      return matchesClass && matchesSearch && matchesStatus;
    }).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
  }, [user, adminViewClass, polls, searchTerm, statusFilter]);

  const dashboardStats = useMemo(() => {
    const totalVotes = displayedPolls.reduce((acc, p) => acc + p.totalVotes, 0);
    const activePolls = displayedPolls.filter(p => p.isActive).length;
    const avgVotes = displayedPolls.length > 0 ? Math.round(totalVotes / displayedPolls.length) : 0;
    const topPolls = [...displayedPolls].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 5).map(p => ({
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

  const handleVote = async (pollId: string, optionId: string, status: string, hasAlreadyVoted: boolean) => {
    if (!user) return;
    if (status !== 'active') {
       addNotification({ title: 'Vote impossible', message: 'Ce sondage n\'est pas ouvert.', type: 'warning' });
       return;
    }
    try {
      await API.polls.vote(pollId, optionId);
      const msg = hasAlreadyVoted ? 'Votre vote a été mis à jour.' : 'Merci pour votre participation.';
      addNotification({ title: 'Vote enregistré', message: msg, type: 'success' });
      fetchPolls(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Impossible d\'enregistrer votre vote.', type: 'alert' });
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.toggleStatus(poll.id);
      fetchPolls(false);
      addNotification({ title: 'Statut mis à jour', message: poll.isActive ? 'Sondage fermé.' : 'Sondage ouvert.', type: 'info' });
    } catch (error) {
       addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleShare = (poll: Poll) => {
    const text = `Sondage UniConnect: ${poll.question}\nRépondez ici : ${window.location.origin}/#/polls`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Lien copié', message: 'Vous pouvez maintenant le partager.', type: 'success' });
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce sondage ?')) return;
    try {
      await API.polls.delete(id);
      setPolls(prev => prev.filter(p => p.id !== id));
      addNotification({ title: 'Supprimé', message: 'Le sondage a été retiré.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
    }
  };

  const openResults = (poll: Poll) => {
    setSelectedPollForResults(poll);
    setIsResultsModalOpen(true);
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
    setDates({ start: poll.startTime ? new Date(poll.startTime).toISOString().slice(0, 16) : '', end: poll.endTime ? new Date(poll.endTime).toISOString().slice(0, 16) : '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const validOptions = options.filter(o => o.trim() !== '');
    if (validOptions.length < 2) {
        addNotification({ title: 'Données insuffisantes', message: 'Veuillez ajouter au moins 2 options.', type: 'warning' });
        return;
    }
    setSubmitting(true);
    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const payload: any = { question, startTime: dates.start ? new Date(dates.start).toISOString() : undefined, endTime: dates.end ? new Date(dates.end).toISOString() : undefined };
      if (editingId) {
        await API.polls.update(editingId, payload);
        addNotification({ title: 'Mis à jour', message: 'Les modifications ont été enregistrées.', type: 'success' });
      } else {
        payload.className = targetClass;
        payload.options = validOptions.map((label) => ({ label }));
        await API.polls.create(payload);
        addNotification({ title: 'Sondage lancé', message: 'Les étudiants peuvent maintenant voter.', type: 'success' });
      }
      await fetchPolls(false);
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error.message || "Erreur de base de données.", type: 'alert' });
    } finally {
      setSubmitting(false);
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

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) return <div className="flex justify-center items-center h-[calc(100vh-200px)]"><Loader2 className="animate-spin text-primary-400" size={48} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 py-4 z-20 backdrop-blur-sm gap-4">
        <div>
           <h2 className="text-3xl font-bold text-gray-800 dark:text-white tracking-tight flex items-center gap-3">
             <BarChart2 className="text-primary-500" size={32} />
             Consultations
           </h2>
        </div>

        <div className="flex flex-1 items-center gap-2 max-w-xl">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
             <input 
                type="text" 
                placeholder="Chercher une question..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
             />
           </div>
           <select 
             value={statusFilter}
             onChange={e => setStatusFilter(e.target.value as any)}
             className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 outline-none cursor-pointer"
           >
              <option value="all">Sondages (Tous)</option>
              <option value="active">Actifs</option>
              <option value="closed">Fermés</option>
           </select>
        </div>

        {canManage && (
          <button onClick={openNewModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 transition-all text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-500/20 whitespace-nowrap">
            <Plus size={18} /> <span className="hidden sm:inline">Nouveau Sondage</span>
          </button>
        )}
      </div>

      {canManage && displayedPolls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 fade-in duration-500">
           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                 <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Participation Totale</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{dashboardStats.totalVotes}</h3>
                 </div>
                 <div className="p-3 bg-blue-50 text-blue-500 dark:bg-blue-900/20 rounded-xl"><Users size={24} /></div>
              </div>
           </div>
           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                 <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Sondages Actifs</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{dashboardStats.activePolls}</h3>
                 </div>
                 <div className="p-3 bg-green-50 text-green-500 dark:bg-green-900/20 rounded-xl"><Activity size={24} /></div>
              </div>
           </div>
           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                 <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Moyenne Votes</p>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{dashboardStats.avgVotes}</h3>
                 </div>
                 <div className="p-3 bg-purple-50 text-purple-500 dark:bg-purple-900/20 rounded-xl"><BarChart2 size={24} /></div>
              </div>
           </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {displayedPolls.map(poll => {
            const status = getPollStatus(poll);
            const totalVotes = poll.totalVotes || 0;
            let statusBadge, statusColor = "";
            switch(status) {
                case 'future': statusColor = "border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-800"; statusBadge = <><Clock size={14} /> À venir</>; break;
                case 'active': statusColor = "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/30 dark:border-green-800"; statusBadge = <><Timer size={14} /> En cours</>; break;
                case 'ended': statusColor = "border-gray-200 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:border-gray-600"; statusBadge = <><CheckCircle2 size={14} /> Terminé</>; break;
                case 'closed_manual': statusColor = "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/30 dark:border-red-800"; statusBadge = <><Lock size={14} /> Fermé</>; break;
            }
            return (
              <div key={poll.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-soft border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                   <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${statusColor}`}>{statusBadge}</div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleShare(poll)} className="p-2 text-gray-400 hover:text-primary-500 rounded-lg transition-colors"><Share2 size={16} /></button>
                        {canManage && (
                            <>
                                <button onClick={() => handleToggleStatus(poll)} className={`p-2 rounded-lg transition-colors ${!poll.isActive ? 'text-red-500' : 'text-gray-400'}`}>{poll.isActive ? <Unlock size={16} /> : <Lock size={16} />}</button>
                                <button onClick={() => handleEdit(poll)} className="p-2 text-gray-400 hover:text-blue-500 rounded-lg transition-colors"><Pencil size={16} /></button>
                                <button onClick={(e) => handleDelete(e, poll.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
                            </>
                        )}
                   </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight pr-8">{poll.question}</h3>
                <div className="space-y-3 flex-1">
                  {poll.options.map(option => {
                    const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = poll.userVoteOptionId === option.id;
                    const showResults = poll.hasVoted || status === 'ended' || (canManage && status !== 'active');
                    const canVote = status === 'active';
                    return (
                      <button key={option.id} onClick={() => canVote && handleVote(poll.id, option.id, status, poll.hasVoted)} disabled={!canVote} className={`relative w-full text-left rounded-xl overflow-hidden transition-all h-12 ${canVote ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'} ${isSelected ? 'ring-2 ring-primary-400 shadow-sm' : 'border border-gray-200 dark:border-gray-700'}`}>
                         {showResults && <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-700/50'}`} style={{ width: `${percentage}%` }} />}
                         <div className="absolute inset-0 px-4 flex justify-between items-center z-10">
                              <div className="flex items-center gap-3">
                                 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-300 bg-transparent'}`}>{isSelected && <Check size={12} strokeWidth={4} />}</div>
                                 <span className={`font-medium text-sm truncate ${isSelected ? 'text-primary-900 dark:text-white font-bold' : 'text-gray-700 dark:text-gray-300'}`}>{option.label}</span>
                              </div>
                              {showResults && <span className={`font-bold text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}>{percentage}%</span>}
                         </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2 text-xs font-medium text-gray-500 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md"><BarChart2 size={14} /><span className="text-gray-700 dark:text-gray-300 font-bold">{totalVotes}</span> votes</div>
                        {(poll.hasVoted || status === 'ended' || canManage) && <button onClick={() => openResults(poll)} className="flex items-center gap-1.5 text-primary-600 font-bold"><PieChartIcon size={14} /> Résultats</button>}
                    </div>
                </div>
              </div>
            );
        })}
        {displayedPolls.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center">
                <Search size={40} className="text-gray-300 mb-3 opacity-20" />
                <h3 className="text-lg font-bold text-gray-400">Aucun sondage trouvé</h3>
            </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier le sondage" : "Nouveau sondage"}>
        <form onSubmit={handleSubmit} className="space-y-5">
           <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Question</label><input required type="text" value={question} onChange={e => setQuestion(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:bg-gray-700 outline-none" placeholder="Ex: Date de l'examen ?" /></div>
           <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
              <div><label className="block text-xs font-bold text-gray-500 mb-1.5">Début</label><input type="datetime-local" value={dates.start} onChange={e => setDates({...dates, start: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 text-xs" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1.5">Fin</label><input type="datetime-local" value={dates.end} onChange={e => setDates({...dates, end: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 text-xs" /></div>
           </div>
           <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Options</label>
              <div className="space-y-2">
                 {options.map((opt, idx) => (
                   <div key={idx} className="flex gap-2 relative">
                      <input type="text" required value={opt} onChange={e => handleOptionChange(idx, e.target.value)} placeholder={`Choix ${idx + 1}`} className="flex-1 pl-4 pr-4 py-2.5 rounded-xl border border-gray-300 dark:bg-gray-700 outline-none" />
                      {options.length > 2 && <button type="button" onClick={() => removeOption(idx)} className="text-red-500"><X size={20} /></button>}
                   </div>
                 ))}
              </div>
              <button type="button" onClick={addOption} className="mt-3 text-sm font-bold text-primary-600 flex items-center gap-1"><Plus size={16} /> Ajouter une option</button>
           </div>
           <button type="submit" disabled={submitting} className="w-full bg-primary-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">{submitting ? <Loader2 className="animate-spin" size={18} /> : (editingId ? 'Mettre à jour' : 'Lancer')}</button>
        </form>
      </Modal>

      <Modal isOpen={isResultsModalOpen} onClose={() => setIsResultsModalOpen(false)} title="Résultats">
        {selectedPollForResults && (
          <div className="space-y-8">
             <div className="bg-gray-50 dark:bg-gray-700/30 p-5 rounded-2xl">
                <h4 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-2">{selectedPollForResults.question}</h4>
                <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-sm"><Users size={16} className="text-primary-500" /><span className="text-sm font-bold text-gray-700 dark:text-gray-300">{selectedPollForResults.totalVotes} votes</span></div>
                </div>
             </div>
             <div className="h-[280px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={selectedPollForResults.options} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="votes" nameKey="label" animationDuration={1000}>{selectedPollForResults.options.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer>
             </div>
             <button onClick={() => setIsResultsModalOpen(false)} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl">Fermer</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

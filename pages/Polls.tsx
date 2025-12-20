
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

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
    const subscription = API.polls.subscribe(() => fetchPolls(false));
    return () => subscription.unsubscribe();
  }, [fetchPolls]);

  const displayedPolls = useMemo(() => {
    return polls.filter(poll => {
      const target = poll.className || 'Général';
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? (target === adminViewClass || target === 'Général') : true)
        : (target === user?.className || target === 'Général');
      
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
    return { totalVotes, activePolls, avgVotes };
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
      addNotification({ title: 'Vote enregistré', message: 'Participation validée.', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Impossible d\'enregistrer votre vote.', type: 'alert' });
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.toggleStatus(poll.id);
      addNotification({ title: 'Statut mis à jour', message: poll.isActive ? 'Sondage fermé.' : 'Sondage ouvert.', type: 'info' });
    } catch (error) {
       addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleShare = (poll: Poll) => {
    const text = `Sondage UniConnect: ${poll.question}\nLien : ${window.location.origin}/#/polls`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Lien prêt à être partagé.', type: 'success' });
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce sondage ?')) return;
    try {
      await API.polls.delete(id);
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
        addNotification({ title: 'Données insuffisantes', message: 'Ajoutez au moins 2 options.', type: 'warning' });
        return;
    }
    setSubmitting(true);
    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const payload: any = { question, startTime: dates.start ? new Date(dates.start).toISOString() : undefined, endTime: dates.end ? new Date(dates.end).toISOString() : undefined };
      if (editingId) {
        await API.polls.update(editingId, payload);
        addNotification({ title: 'Mis à jour', message: 'Modifications enregistrées.', type: 'success' });
      } else {
        payload.className = targetClass;
        payload.options = validOptions.map((label) => ({ label }));
        await API.polls.create(payload);
        addNotification({ title: 'Succès', message: 'Sondage lancé.', type: 'success' });
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: "Erreur technique.", type: 'alert' });
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

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) return <div className="flex justify-center items-center h-[calc(100vh-200px)]"><Loader2 className="animate-spin text-primary-400" size={48} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
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
                type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
             />
           </div>
           <select 
             value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
             className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 outline-none"
           >
              <option value="all">Tous</option>
              <option value="active">Actifs</option>
              <option value="closed">Fermés</option>
           </select>
        </div>
        {canManage && (
          <button onClick={openNewModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-500/20 whitespace-nowrap active:scale-95">
            <Plus size={18} /> <span className="hidden sm:inline">Lancer un sondage</span>
          </button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {displayedPolls.map(poll => {
            const status = getPollStatus(poll);
            const totalVotes = poll.totalVotes || 0;
            let statusBadge, statusColor = "";
            switch(status) {
                case 'future': statusColor = "border-yellow-200 bg-yellow-50 text-yellow-700"; statusBadge = <><Clock size={14} /> À venir</>; break;
                case 'active': statusColor = "border-green-200 bg-green-50 text-green-700"; statusBadge = <><Timer size={14} /> En cours</>; break;
                default: statusColor = "border-gray-200 bg-gray-100 text-gray-600"; statusBadge = <><CheckCircle2 size={14} /> Terminé</>; break;
            }
            return (
              <div key={poll.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-soft border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                   <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${statusColor}`}>{statusBadge}</div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleShare(poll)} className="p-2 text-gray-400 hover:text-primary-500 rounded-lg"><Share2 size={16} /></button>
                        {canManage && (
                            <>
                                <button onClick={() => handleToggleStatus(poll)} className="p-2 text-gray-400">{poll.isActive ? <Unlock size={16} /> : <Lock size={16} />}</button>
                                <button onClick={() => handleEdit(poll)} className="p-2 text-gray-400 hover:text-blue-500"><Pencil size={16} /></button>
                                <button onClick={(e) => handleDelete(e, poll.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                            </>
                        )}
                   </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">{poll.question}</h3>
                <div className="space-y-3 flex-1 mt-4">
                  {poll.options.map(option => {
                    const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = poll.userVoteOptionId === option.id;
                    const showResults = poll.hasVoted || status === 'ended' || (canManage && status !== 'active');
                    const canVote = status === 'active';
                    return (
                      <button key={option.id} onClick={() => canVote && handleVote(poll.id, option.id, status, poll.hasVoted)} disabled={!canVote} className={`relative w-full text-left rounded-xl overflow-hidden transition-all h-12 border ${isSelected ? 'border-primary-400 ring-1 ring-primary-50' : 'border-gray-100 dark:border-gray-700'}`}>
                         {showResults && <div className={`absolute left-0 top-0 bottom-0 ${isSelected ? 'bg-primary-50 dark:bg-primary-900/40' : 'bg-gray-50 dark:bg-gray-700/50'}`} style={{ width: `${percentage}%` }} />}
                         <div className="absolute inset-0 px-4 flex justify-between items-center z-10">
                              <span className={`font-medium text-sm truncate ${isSelected ? 'text-primary-700 dark:text-white font-bold' : 'text-gray-700 dark:text-gray-300'}`}>{option.label}</span>
                              {showResults && <span className="font-black text-sm text-gray-500">{percentage}%</span>}
                         </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{totalVotes} participations • {poll.className || 'Général'}</span>
                    {(poll.hasVoted || status === 'ended' || canManage) && <button onClick={() => openResults(poll)} className="text-xs font-bold text-primary-600 hover:underline">Voir détails</button>}
                </div>
              </div>
            );
        })}
        {displayedPolls.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                <p className="text-gray-400 font-bold italic">Aucun sondage disponible</p>
            </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier" : "Lancer un sondage"}>
        <form onSubmit={handleSubmit} className="space-y-5">
           <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Question</label><input required type="text" value={question} onChange={e => setQuestion(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-100" /></div>
           <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Options</label>
              {options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                   <input type="text" required value={opt} onChange={e => handleOptionChange(idx, e.target.value)} placeholder={`Choix ${idx + 1}`} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:bg-gray-700 dark:text-white outline-none" />
                   {options.length > 2 && <button type="button" onClick={() => removeOption(idx)} className="text-red-500 p-2"><X size={20} /></button>}
                </div>
              ))}
              <button type="button" onClick={addOption} className="text-xs font-bold text-primary-600 hover:underline px-1">+ Ajouter une option</button>
           </div>
           <button type="submit" disabled={submitting} className="w-full bg-primary-500 text-white font-bold py-3.5 rounded-xl shadow-lg disabled:opacity-50">{submitting ? <Loader2 className="animate-spin" size={18} /> : 'Publier'}</button>
        </form>
      </Modal>

      <Modal isOpen={isResultsModalOpen} onClose={() => setIsResultsModalOpen(false)} title="Analyse des résultats">
        {selectedPollForResults && (
          <div className="space-y-8">
             <div className="bg-gray-50 dark:bg-gray-700/30 p-5 rounded-2xl">
                <h4 className="text-lg font-black text-gray-900 dark:text-white leading-tight mb-2">{selectedPollForResults.question}</h4>
                <div className="text-xs font-bold text-gray-400 uppercase">{selectedPollForResults.totalVotes} votes exprimés</div>
             </div>
             <div className="h-[280px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={selectedPollForResults.options} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="votes" nameKey="label" animationDuration={800}>
                            {selectedPollForResults.options.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
             </div>
             <button onClick={() => setIsResultsModalOpen(false)} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl active:scale-95 transition-all">Fermer</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

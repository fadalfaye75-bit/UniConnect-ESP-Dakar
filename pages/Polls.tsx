import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Polls() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedPollForResults, setSelectedPollForResults] = useState<Poll | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const fetchPolls = useCallback(async (showLoader = false) => {
    try {
      if(showLoader) setLoading(true); 
      const data = await API.polls.list();
      setPolls(data);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Chargement des sondages impossible.', type: 'alert' });
    } finally {
      if(showLoader) setLoading(false);
    }
  }, [addNotification]);

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

  const handleVote = async (poll: Poll, optionId: string) => {
    if (!user) return;
    
    const isConcerned = poll.className === 'Général' || poll.className === user.className;
    if (!isConcerned && user.role !== UserRole.ADMIN) {
        addNotification({ title: 'Accès restreint', message: 'Réservé à une autre classe.', type: 'warning' });
        return;
    }

    if (!poll.isActive) {
       addNotification({ title: 'Clos', message: 'Les votes sont terminés.', type: 'warning' });
       return;
    }

    // Optimistic Update pour une fluidité maximale
    const originalPolls = [...polls];
    setPolls(prev => prev.map(p => {
        if (p.id === poll.id) {
            return {
                ...p,
                hasVoted: true,
                userVoteOptionId: optionId,
                totalVotes: p.totalVotes + 1,
                options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o)
            };
        }
        return p;
    }));

    try {
      await API.polls.vote(poll.id, optionId);
      addNotification({ title: 'Vote envoyé', message: 'Participation enregistrée !', type: 'success' });
    } catch (error) {
      setPolls(originalPolls);
      addNotification({ title: 'Erreur', message: 'Échec de la synchronisation.', type: 'alert' });
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.toggleStatus(poll.id);
      addNotification({ title: 'Statut', message: 'Mise à jour réussie.', type: 'info' });
    } catch (error) {
       addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("Supprimer ce sondage ?")) return;
      try {
          await API.polls.delete(id);
          addNotification({ title: 'Supprimé', message: 'Le sujet a été retiré.', type: 'info' });
      } catch(e) {
          addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
      }
  };

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest italic animate-pulse tracking-[0.3em]">Lecture des urnes...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 z-20 backdrop-blur-md">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-primary-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <BarChart2 size={32} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                 <Users size={12}/> {displayedPolls.length} Sujets actifs
              </p>
           </div>
        </div>

        <div className="flex flex-1 items-center gap-3 max-w-xl">
           <div className="relative flex-1 group">
             <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
             <input 
                type="text" placeholder="Filtrer par question..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 transition-all font-medium"
             />
           </div>
           {canManage && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-xl shadow-primary-500/20 transition-all active:scale-95 uppercase tracking-widest">
               <Plus size={18} /> Ouvrir un vote
             </button>
           )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {displayedPolls.map(poll => {
            const totalVotes = poll.totalVotes || 0;
            const hasVoted = poll.hasVoted;
            const isConcerned = poll.className === 'Général' || poll.className === user?.className;
            
            return (
              <div key={poll.id} className={`bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-soft border transition-all flex flex-col relative overflow-hidden group ${poll.isActive ? 'hover:border-primary-400' : 'opacity-80'}`}>
                {/* Badge Status */}
                <div className="flex justify-between items-center mb-8 relative z-10">
                   <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${poll.isActive ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                      {poll.isActive ? <><Timer size={12} /> Ouvert</> : <><Lock size={12} /> Clos</>}
                   </div>
                   {canManage && (
                        <div className="flex gap-2">
                            <button onClick={() => handleToggleStatus(poll)} className="p-2.5 bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary-500 rounded-xl transition-colors">
                                {poll.isActive ? <Lock size={18} /> : <Unlock size={18} />}
                            </button>
                            <button onClick={() => handleDelete(poll.id)} className="p-2.5 bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-red-500 rounded-xl transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                   )}
                </div>

                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-8 leading-tight tracking-tighter italic">{poll.question}</h3>

                {/* Options List */}
                <div className="space-y-4 flex-1 relative z-10">
                  {poll.options.map(option => {
                    const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = poll.userVoteOptionId === option.id;
                    const canVote = poll.isActive && !hasVoted && isConcerned;
                    const showResults = hasVoted || !poll.isActive || (user?.role === UserRole.ADMIN);

                    return (
                      <button 
                        key={option.id} 
                        onClick={() => canVote && handleVote(poll, option.id)} 
                        disabled={!canVote} 
                        className={`relative w-full text-left rounded-[1.5rem] overflow-hidden transition-all h-16 border-2 flex items-center px-6 ${
                          isSelected ? 'border-primary-500 bg-primary-50/20 shadow-inner' : 'border-gray-50 dark:border-gray-800'
                        } ${canVote ? 'hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800/50' : 'cursor-default'}`}
                      >
                         {showResults && (
                           <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out ${isSelected ? 'bg-primary-500/10' : 'bg-gray-100 dark:bg-gray-800/40'}`} style={{ width: `${percentage}%` }} />
                         )}
                         <div className="flex-1 flex items-center justify-between z-10">
                              <span className={`text-sm font-black italic ${isSelected ? 'text-primary-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                {option.label}
                                {isSelected && <Check size={16} className="inline ml-2 animate-in zoom-in" />}
                              </span>
                              {showResults && (
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-[10px] text-gray-400">{percentage}%</span>
                                  {isSelected && <Sparkles size={14} className="text-primary-400" />}
                                </div>
                              )}
                              {!showResults && canVote && <Vote size={18} className="text-primary-500 opacity-20 group-hover:opacity-100 transition-opacity" />}
                         </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer Info */}
                <div className="mt-10 pt-8 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{totalVotes} VOTES</span>
                        <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest mt-1">CLASSE : {poll.className}</span>
                    </div>
                    {hasVoted ? (
                        <div className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase"><CheckCircle2 size={16}/> CHOIX ENREGISTRÉ</div>
                    ) : (
                        !isConcerned && poll.isActive && (
                            <div className="flex items-center gap-1.5 text-orange-400 text-[9px] font-black uppercase">
                                <AlertTriangle size={14}/> Accès réservé
                            </div>
                        )
                    )}
                    <button onClick={() => { setSelectedPollForResults(poll); setIsResultsModalOpen(true); }} className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-primary-500 rounded-2xl transition-all shadow-sm">
                       <TrendingUp size={18} />
                    </button>
                </div>
              </div>
            );
        })}
      </div>

      {/* Modal Résultats détaillés */}
      <Modal isOpen={isResultsModalOpen} onClose={() => setIsResultsModalOpen(false)} title="Analyse de la consultation">
        {selectedPollForResults && (
          <div className="space-y-8 animate-fade-in">
             <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                          data={selectedPollForResults.options} 
                          cx="50%" cy="50%" 
                          innerRadius={60} 
                          outerRadius={80} 
                          paddingAngle={5} 
                          dataKey="votes" 
                          nameKey="label"
                          animationBegin={0}
                          animationDuration={800}
                        >
                            {selectedPollForResults.options.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="space-y-2">
                {selectedPollForResults.options.map((opt, i) => (
                    <div key={opt.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                            <span className="font-bold text-sm italic">{opt.label}</span>
                        </div>
                        <span className="font-black text-primary-500 uppercase text-xs">{opt.votes} voix</span>
                    </div>
                ))}
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
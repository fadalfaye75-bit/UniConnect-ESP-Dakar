
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll, ClassGroup } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Polls() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedPollForResults, setSelectedPollForResults] = useState<Poll | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  // Formulaire de création
  const [newPoll, setNewPoll] = useState({
    question: '',
    className: user?.role === UserRole.DELEGATE ? user.className : 'Général',
    options: ['', '']
  });

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
    API.classes.list().then(setClasses);
    const subscription = API.polls.subscribe(() => fetchPolls(false));
    return () => subscription.unsubscribe();
  }, [fetchPolls]);

  const displayedPolls = useMemo(() => {
    return polls.filter(poll => {
      const target = poll.className || 'Général';
      
      const isVisible = user?.role === UserRole.ADMIN 
        ? true 
        : (target === user?.className || target === 'Général');
      
      if (!isVisible) return false;

      const matchesClassFilter = classFilter === 'all' || target === classFilter;
      const matchesSearch = poll.question.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && poll.isActive) ||
                           (statusFilter === 'closed' && !poll.isActive);

      return matchesClassFilter && matchesSearch && matchesStatus;
    }).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
  }, [user, polls, searchTerm, statusFilter, classFilter]);

  const handleVote = async (poll: Poll, optionId: string) => {
    if (!user) return;
    
    const isConcerned = poll.className === 'Général' || poll.className === user.className;
    if (!isConcerned && user.role !== UserRole.ADMIN) {
        addNotification({ title: 'Accès restreint', message: 'Vous ne pouvez voter que pour les sondages de votre classe.', type: 'warning' });
        return;
    }

    if (!poll.isActive) {
       addNotification({ title: 'Sondage Clos', message: 'Les votes sont terminés pour ce sujet.', type: 'warning' });
       return;
    }

    // Optimistic Update
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
      addNotification({ title: 'Vote enregistré', message: 'Merci pour votre participation !', type: 'success' });
    } catch (error) {
      setPolls(originalPolls);
      addNotification({ title: 'Erreur', message: 'Échec de la connexion au serveur de vote.', type: 'alert' });
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPoll.options.some(o => !o.trim())) {
      addNotification({ title: 'Options manquantes', message: 'Veuillez remplir toutes les options.', type: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await API.polls.create({
        question: newPoll.question,
        className: newPoll.className,
        options: newPoll.options.map(o => ({ label: o }))
      });
      setIsModalOpen(false);
      setNewPoll({ question: '', className: user?.role === UserRole.DELEGATE ? user.className : 'Général', options: ['', ''] });
      addNotification({ title: 'Sondage publié', message: 'Le vote est maintenant ouvert.', type: 'success' });
      fetchPolls();
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Création échouée.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const addOption = () => {
    if (newPoll.options.length < 5) {
      setNewPoll({ ...newPoll, options: [...newPoll.options, ''] });
    }
  };

  const removeOption = (index: number) => {
    if (newPoll.options.length > 2) {
      const newOptions = [...newPoll.options];
      newOptions.splice(index, 1);
      setNewPoll({ ...newPoll, options: newOptions });
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.toggleStatus(poll.id);
      addNotification({ title: 'Statut mis à jour', message: 'Le sondage est désormais ' + (poll.isActive ? 'fermé.' : 'ouvert.'), type: 'info' });
      fetchPolls();
    } catch (error) {
       addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("Supprimer définitivement ce sondage ?")) return;
      try {
          await API.polls.delete(id);
          addNotification({ title: 'Supprimé', message: 'Le sujet a été retiré.', type: 'info' });
          fetchPolls();
      } catch(e) {
          addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
      }
  };

  // Définition des couleurs de base et de leurs variantes pour les gradients
  const COLOR_PALETTE = [
    { base: '#0ea5e9', light: '#38bdf8' }, // Sky
    { base: '#10b981', light: '#34d399' }, // Emerald
    { base: '#f59e0b', light: '#fbbf24' }, // Amber
    { base: '#ef4444', light: '#f87171' }, // Red
    { base: '#8b5cf6', light: '#a78bfa' }, // Violet
  ];

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest italic animate-pulse">Lecture des urnes...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Header & Filtres */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 z-20 backdrop-blur-md">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-primary-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <BarChart2 size={32} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                 <Users size={12}/> {displayedPolls.length} Sujets disponibles
              </p>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 items-center gap-3 max-w-3xl">
           <div className="relative flex-1 w-full group">
             <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
             <input 
                type="text" placeholder="Rechercher une question..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 transition-all font-medium"
             />
           </div>

           <div className="flex items-center gap-2 w-full lg:w-auto">
               <select 
                 value={classFilter} onChange={e => setClassFilter(e.target.value)}
                 className="flex-1 lg:flex-none px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-[10px] font-black text-gray-600 dark:text-gray-300 outline-none uppercase tracking-widest cursor-pointer hover:border-primary-300 transition-colors"
               >
                  <option value="all">Toutes les classes</option>
                  <option value="Général">Général (Public)</option>
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
               </select>

               <select 
                 value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                 className="flex-1 lg:flex-none px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-[10px] font-black text-gray-600 dark:text-gray-300 outline-none uppercase tracking-widest cursor-pointer hover:border-primary-300 transition-colors"
               >
                  <option value="all">Statuts</option>
                  <option value="active">Ouverts</option>
                  <option value="closed">Clos</option>
               </select>
           </div>

           {canManage && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3.5 rounded-2xl text-xs font-black shadow-xl shadow-primary-500/20 transition-all active:scale-95 uppercase tracking-widest">
               <Plus size={18} /> Nouveau
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
                   <div className="flex items-center gap-2">
                      <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${poll.isActive ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                        {poll.isActive ? <><Timer size={12} /> Ouvert</> : <><Lock size={12} /> Clos</>}
                      </div>
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] border border-gray-100 dark:border-gray-800 px-3 py-1.5 rounded-full">{poll.className || 'Général'}</span>
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

                {/* Options de Vote */}
                <div className="space-y-4 flex-1 relative z-10">
                  {poll.options.map(option => {
                    const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = poll.userVoteOptionId === option.id;
                    const canVote = poll.isActive && !hasVoted && isConcerned;
                    
                    return (
                      <button 
                        key={option.id} 
                        onClick={() => canVote && handleVote(poll, option.id)} 
                        disabled={!canVote} 
                        className={`relative w-full text-left rounded-[2rem] overflow-hidden transition-all h-16 border-2 flex items-center px-6 ${
                          isSelected 
                            ? 'border-primary-500 border-4 bg-primary-50/20 dark:bg-primary-900/10 shadow-[0_0_20px_rgba(14,165,233,0.2)] ring-4 ring-primary-50 dark:ring-primary-900/5 scale-[1.02]' 
                            : 'border-gray-100 dark:border-gray-800'
                        } ${canVote ? 'hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800/50' : 'cursor-default'}`}
                      >
                         {/* Barre de progression systématique */}
                         <div 
                           className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out ${isSelected ? 'bg-primary-500/15' : 'bg-gray-100 dark:bg-gray-800/40'}`} 
                           style={{ width: `${percentage}%` }} 
                         />
                         
                         <div className="flex-1 flex items-center justify-between z-10 relative">
                              <span className={`text-sm font-black italic tracking-tight ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {option.label}
                                {isSelected && <CheckCircle2 size={18} className="inline ml-3 animate-in zoom-in text-primary-500" />}
                              </span>
                              
                              <div className="flex items-center gap-3">
                                <span className={`font-black text-[11px] ${isSelected ? 'text-primary-600' : 'text-gray-400'}`}>
                                  {percentage}%
                                </span>
                                {canVote && !hasVoted && (
                                   <div className="p-1.5 bg-primary-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Vote size={12} />
                                   </div>
                                )}
                              </div>
                         </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="mt-10 pt-8 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{totalVotes} VOTES</span>
                        <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest mt-1">CIBLE : {poll.className || "L'école entière"}</span>
                    </div>
                    {hasVoted ? (
                        <div className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full"><CheckCircle2 size={16}/> VOTÉ</div>
                    ) : (
                        !isConcerned && poll.isActive ? (
                            <div className="flex items-center gap-1.5 text-orange-400 text-[9px] font-black uppercase">
                                <AlertTriangle size={14}/> Accès restreint
                            </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-primary-400 text-[9px] font-black uppercase animate-pulse">
                              <Vote size={14}/> Voter maintenant
                          </div>
                        )
                    )}
                    <button 
                      onClick={() => { setSelectedPollForResults(poll); setIsResultsModalOpen(true); }} 
                      className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-primary-500 rounded-2xl transition-all shadow-sm"
                    >
                       <TrendingUp size={18} />
                    </button>
                </div>
              </div>
            );
        })}

        {displayedPolls.length === 0 && (
           <div className="col-span-full py-32 text-center bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <FilterX size={64} className="mx-auto text-gray-100 dark:text-gray-800 mb-6 opacity-10" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic opacity-60">Aucun sondage trouvé</p>
           </div>
        )}
      </div>

      {/* Modal de Création */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Question</label>
            <textarea 
              required 
              rows={3}
              value={newPoll.question}
              onChange={e => setNewPoll({...newPoll, question: e.target.value})}
              placeholder="ex: Quel jour préférez-vous pour le DS de Maths ?"
              className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-primary-50 transition-all italic"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Cible (Classe)</label>
            <select 
              value={newPoll.className}
              onChange={e => setNewPoll({...newPoll, className: e.target.value})}
              disabled={user?.role === UserRole.DELEGATE}
              className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-black text-gray-900 dark:text-white outline-none focus:ring-4 focus:ring-primary-50 transition-all uppercase tracking-widest"
            >
              <option value="Général">Général (Tout l'école)</option>
              {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-3">
             <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Options de réponse</label>
             {newPoll.options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                   <input 
                      required
                      type="text"
                      value={opt}
                      onChange={e => {
                        const newOptions = [...newPoll.options];
                        newOptions[idx] = e.target.value;
                        setNewPoll({...newPoll, options: newOptions});
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-5 py-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white"
                   />
                   {newPoll.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(idx)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                         <Trash2 size={18} />
                      </button>
                   )}
                </div>
             ))}
             {newPoll.options.length < 5 && (
                <button type="button" onClick={addOption} className="text-xs font-black text-primary-500 uppercase tracking-widest flex items-center gap-2 py-2 hover:translate-x-1 transition-transform">
                   <Plus size={16} /> Ajouter une option
                </button>
             )}
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all flex justify-center items-center gap-2 uppercase tracking-widest active:scale-95"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Vote size={20} />}
            {submitting ? 'Publication...' : 'Ouvrir le vote'}
          </button>
        </form>
      </Modal>

      {/* Modal Résultats détaillés */}
      <Modal isOpen={isResultsModalOpen} onClose={() => setIsResultsModalOpen(false)} title="Analyse de la consultation">
        {selectedPollForResults && (
          <div className="space-y-8 animate-fade-in">
             <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        {/* Définition des dégradés SVG */}
                        <defs>
                          {COLOR_PALETTE.map((color, index) => (
                            <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color.light} stopOpacity={1}/>
                              <stop offset="95%" stopColor={color.base} stopOpacity={1}/>
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie 
                          data={selectedPollForResults.options} 
                          cx="50%" cy="50%" 
                          innerRadius={70} 
                          outerRadius={95} 
                          paddingAngle={8} 
                          dataKey="votes" 
                          nameKey="label"
                          stroke="none"
                          animationBegin={0}
                          animationDuration={1200}
                          animationEasing="ease-out"
                        >
                            {selectedPollForResults.options.map((_, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={`url(#gradient-${index % COLOR_PALETTE.length})`}
                                className="filter drop-shadow-lg"
                              />
                            ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '1.5rem', 
                            border: 'none', 
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            padding: '12px 16px',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }} 
                        />
                        <Legend 
                          iconType="circle" 
                          wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', paddingTop: '30px', letterSpacing: '0.1em' }} 
                        />
                    </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="space-y-3">
                {selectedPollForResults.options.map((opt, i) => {
                    const palette = COLOR_PALETTE[i % COLOR_PALETTE.length];
                    return (
                        <div key={opt.id} className={`flex justify-between items-center p-5 rounded-[2rem] border transition-all duration-300 ${selectedPollForResults.userVoteOptionId === opt.id ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/20 shadow-xl' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm'}`}>
                            <div className="flex items-center gap-4">
                                <div 
                                  className="w-5 h-5 rounded-full shadow-lg" 
                                  style={{ background: `linear-gradient(to bottom, ${palette.light}, ${palette.base})` }}
                                ></div>
                                <span className="font-black text-sm italic text-gray-800 dark:text-gray-200">{opt.label}</span>
                            </div>
                            <div className="flex items-center gap-4">
                               <div className="text-right">
                                  <p className="font-black text-gray-900 dark:text-white text-sm leading-none">{opt.votes} voix</p>
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Totalité</p>
                               </div>
                               {selectedPollForResults.userVoteOptionId === opt.id && <Sparkles size={16} className="text-primary-500 animate-pulse" />}
                            </div>
                        </div>
                    );
                })}
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
}


import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Clock, MapPin, AlertTriangle, Plus, Trash2, Loader2, Copy, Share2, Pencil, Search, Filter 
} from 'lucide-react';
import { UserRole, Exam } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

export default function Exams() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'upcoming' | 'passed' | 'all'>('upcoming');

  // Edit Mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    subject: '', 
    date: '', 
    time: '', 
    duration: '', 
    room: '', 
    notes: '' 
  });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  useEffect(() => {
    fetchExams();
  }, [user, adminViewClass]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await API.exams.list();
      setExams(data);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger les examens.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedExams = useMemo(() => {
    const now = new Date();
    return exams.filter(exam => {
      const examDate = new Date(exam.date);
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? exam.className === adminViewClass : true)
        : exam.className === user?.className;
      
      const matchesSearch = exam.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exam.room.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'upcoming' && examDate >= now) ||
                           (statusFilter === 'passed' && examDate < now);

      return matchesClass && matchesSearch && matchesStatus;
    }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [user, adminViewClass, exams, searchTerm, statusFilter]);

  const handleCopy = (exam: Exam) => {
    const d = new Date(exam.date);
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const text = `Examen: ${exam.subject}\nDate: ${dateStr} à ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\nSalle: ${exam.room}\nDurée: ${exam.duration}`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Détails copiés.', type: 'success' });
    });
  };

  const handleShare = (exam: Exam) => {
    const subject = encodeURIComponent(`Examen UniConnect: ${exam.subject}`);
    const body = encodeURIComponent(`Rappel Examen\n\nMatière: ${exam.subject}\nDate: ${new Date(exam.date).toLocaleString()}\nSalle: ${exam.room}\nNotes: ${exam.notes || 'Aucune'}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ subject: '', date: '', time: '', duration: '', room: '', notes: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (exam: Exam) => {
    const d = new Date(exam.date);
    setEditingId(exam.id);
    setFormData({ subject: exam.subject, date: d.toISOString().split('T')[0], time: d.toTimeString().slice(0, 5), duration: exam.duration, room: exam.room, notes: exam.notes || '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const isoDate = new Date(`${formData.date}T${formData.time}`).toISOString();
      const payload = { subject: formData.subject, date: isoDate, duration: formData.duration, room: formData.room, notes: formData.notes };
      if (editingId) {
         const updatedExam = await API.exams.update(editingId, payload);
         setExams(prev => prev.map(e => e.id === editingId ? updatedExam : e));
         addNotification({ title: 'Succès', message: 'Examen mis à jour.', type: 'success' });
      } else {
         const newExam = await API.exams.create({ ...payload, className: targetClass });
         setExams(prev => [...prev, newExam]);
         addNotification({ title: 'Succès', message: 'Examen ajouté.', type: 'success' });
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: "Opération échouée.", type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cet examen ?')) return;
    try {
      await API.exams.delete(id);
      setExams(prev => prev.filter(e => e.id !== id));
      addNotification({ title: 'Supprimé', message: 'L\'examen a été retiré.', type: 'info' });
    } catch (error) {
        addNotification({ title: 'Erreur', message: "Impossible de supprimer.", type: 'alert' });
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 py-4 z-10 backdrop-blur-sm gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Examens & DS</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-semibold text-primary-600">{user?.role === UserRole.ADMIN && adminViewClass ? adminViewClass : user?.className}</span>
          </p>
        </div>

        <div className="flex flex-1 items-center gap-2 max-w-lg">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
             <input 
                type="text" 
                placeholder="Chercher une matière..." 
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
              <option value="upcoming">À venir</option>
              <option value="passed">Passés</option>
              <option value="all">Tous</option>
           </select>
        </div>

        {canManage && (
          <button onClick={openNewModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all hover:scale-105 whitespace-nowrap">
            <Plus size={18} /> <span className="hidden sm:inline">Ajouter</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {displayedExams.map((exam) => {
          const examDate = new Date(exam.date);
          const now = new Date();
          const timeDiff = examDate.getTime() - now.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          const isUrgent = daysDiff >= 0 && daysDiff <= 3;
          const isPassed = timeDiff < 0;
          const dayString = examDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
          const capitalizedDate = dayString.charAt(0).toUpperCase() + dayString.slice(1);
          return (
            <div key={exam.id} className={`relative bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border transition-all hover:shadow-md ${isUrgent ? 'border-orange-300 dark:border-orange-500 ring-1 ring-orange-100' : 'border-gray-200 dark:border-gray-700'}`}>
              {isUrgent && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl flex items-center gap-1 shadow-sm z-10">
                  <AlertTriangle size={12} /> J-{daysDiff}
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                 <div className="flex-1">
                    <h3 className={`text-xl font-bold ${isPassed ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>{exam.subject}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300 mb-4 mt-2">
                       <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-medium ${isUrgent ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-gray-50 dark:bg-gray-700'}`}>
                          <Clock size={16} className={isUrgent ? 'text-orange-500' : 'text-primary-500'} />
                          <span className="capitalize">{capitalizedDate}</span>
                          <span className="opacity-40 mx-1">à</span>
                          <span>{examDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          <span className="opacity-40 mx-1">|</span>
                          <span>{exam.duration}</span>
                       </div>
                       <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-md font-medium">
                          <MapPin size={16} className="text-primary-500" />
                          <span>{exam.room}</span>
                       </div>
                    </div>
                    {exam.notes && <p className="text-sm text-gray-500 dark:text-gray-400 italic border-l-2 border-primary-200 dark:border-primary-800 pl-3 mb-4">{exam.notes}</p>}
                 </div>
                 <div className="flex items-center gap-2 self-start border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-700 pt-4 md:pt-0 md:pl-4">
                    <button onClick={() => handleCopy(exam)} className="p-2 text-gray-400 hover:text-primary-500 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700" title="Copier les détails"><Copy size={18} /></button>
                    <button onClick={() => handleShare(exam)} className="p-2 text-gray-400 hover:text-primary-500 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700" title="Partager par mail"><Share2 size={18} /></button>
                    {canManage && (
                      <>
                        <button onClick={() => handleEdit(exam)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Modifier"><Pencil size={18} /></button>
                        <button onClick={(e) => handleDelete(e, exam.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Supprimer"><Trash2 size={18} /></button>
                      </>
                    )}
                 </div>
              </div>
            </div>
          );
        })}
        {displayedExams.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
             <Search size={40} className="mx-auto mb-3 opacity-20" />
             <p className="font-bold">Aucun examen trouvé pour cette recherche.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier l'Examen" : "Ajouter un Examen"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Matière</label>
            <input required type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Heure</label>
              <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Salle</label>
              <input required type="text" value={formData.room} onChange={e => setFormData({...formData, room: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Durée</label>
              <input required type="text" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} placeholder="ex: 2h" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Notes (Optionnel)</label>
            <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" />
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2">
            {submitting ? <Loader2 className="animate-spin" /> : (editingId ? "Enregistrer" : "Ajouter")}
          </button>
        </form>
      </Modal>
    </div>
  );
}


import React, { useState, useEffect, useMemo } from 'react';
import { Video, ExternalLink, Plus, Trash2, Calendar, Copy, Loader2, Link as LinkIcon, Share2, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, MeetLink } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

export default function Meet() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [meetings, setMeetings] = useState<MeetLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form & Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', platform: 'Google Meet', url: '', day: '', time: '' });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  useEffect(() => {
    fetchMeetings();
  }, [user, adminViewClass]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const data = await API.meet.list();
      setMeetings(data);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedLinks = useMemo(() => {
    return meetings.filter(link => {
      if (user?.role === UserRole.ADMIN) {
        return adminViewClass ? link.className === adminViewClass : true;
      }
      return link.className === user?.className;
    });
  }, [user, adminViewClass, meetings]);

  const handleCopy = (link: MeetLink) => {
    navigator.clipboard.writeText(`${link.title} - ${link.url}`).then(() => {
      addNotification({ title: 'Lien copié', message: 'Dans le presse-papier.', type: 'success' });
    });
  };

  const handleShare = (link: MeetLink) => {
    const subject = encodeURIComponent(`Lien Visio: ${link.title}`);
    const body = encodeURIComponent(`Rejoindre le cours: ${link.title}\nHeure: ${link.time}\nLien: ${link.url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ title: '', platform: 'Google Meet', url: '', day: '', time: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (link: MeetLink) => {
    setEditingId(link.id);
    // Parse existing time string like "Lundi 10:00" if possible, else just use it
    const parts = link.time.split(' ');
    const day = parts[0] || '';
    const time = parts[1] || '';
    
    setFormData({ 
      title: link.title, 
      platform: link.platform as string, 
      url: link.url, 
      day: day, 
      time: time 
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const timeString = `${formData.day} ${formData.time}`;
      
      if (editingId) {
        // UPDATE
        const updated = await API.meet.update(editingId, {
           title: formData.title,
           platform: formData.platform as any,
           url: formData.url,
           time: timeString
        });
        setMeetings(prev => prev.map(m => m.id === editingId ? updated : m));
        addNotification({ title: 'Succès', message: 'Réunion mise à jour.', type: 'success' });
      } else {
        // CREATE
        const newMeet = await API.meet.create({
          title: formData.title,
          platform: formData.platform as any,
          url: formData.url,
          time: timeString,
          className: targetClass
        });
        setMeetings(prev => [newMeet, ...prev]);
        addNotification({ title: 'Succès', message: 'Réunion ajoutée.', type: 'success' });
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ title: '', platform: 'Google Meet', url: '', day: '', time: '' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Echec.", type: 'alert' });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ?')) return;
    try {
      await API.meet.delete(id);
      setMeetings(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Impossible de supprimer.", type: 'alert' });
    }
  };

  if (loading) return <Loader2 className="animate-spin mx-auto mt-20" />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Visioconférences</h2>
        {canManage && (
          <button onClick={openNewModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all">
            <Plus size={18} /> Ajouter
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {displayedLinks.map(link => (
                <tr key={link.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                  <td className="p-5 font-bold text-gray-900 dark:text-white flex items-center gap-3 min-w-[200px]">
                    <div className="p-2 bg-primary-50 text-primary-500 rounded-lg"><Video size={18} /></div>
                    {link.title}
                  </td>
                  <td className="p-5"><span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded whitespace-nowrap">{link.platform}</span></td>
                  <td className="p-5 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{link.time}</td>
                  <td className="p-5 text-right">
                      <div className="flex justify-end items-center gap-2">
                          <a href={link.url} target="_blank" rel="noreferrer" className="text-primary-600 font-bold text-sm flex items-center gap-1 hover:underline mr-4">
                             Rejoindre <ExternalLink size={14} />
                          </a>
                          
                          <button onClick={() => handleCopy(link)} className="p-2 text-gray-400 hover:text-primary-500" title="Copier le lien"><Copy size={16} /></button>
                          <button onClick={() => handleShare(link)} className="p-2 text-gray-400 hover:text-primary-500" title="Partager"><Share2 size={16} /></button>
                          
                          {canManage && (
                            <>
                               <button onClick={() => handleEdit(link)} className="p-2 text-gray-400 hover:text-blue-500" title="Modifier"><Pencil size={16} /></button>
                               <button onClick={(e) => handleDelete(e, link.id)} className="p-2 text-gray-400 hover:text-red-500" title="Supprimer"><Trash2 size={16} /></button>
                            </>
                          )}
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
        </div>
        {displayedLinks.length === 0 && <div className="p-12 text-center text-gray-400">Aucune réunion programmée.</div>}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier la réunion" : "Nouvelle Réunion"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Titre</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" placeholder="ex: Cours de Java" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Lien URL</label>
            <input required type="url" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Jour</label>
                <select required value={formData.day} onChange={e => setFormData({...formData, day: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none">
                    <option value="">Choisir...</option>
                    <option value="Lundi">Lundi</option>
                    <option value="Mardi">Mardi</option>
                    <option value="Mercredi">Mercredi</option>
                    <option value="Jeudi">Jeudi</option>
                    <option value="Vendredi">Vendredi</option>
                    <option value="Samedi">Samedi</option>
                </select>
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Heure</label>
                <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none" />
             </div>
          </div>
          <button type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 rounded-lg mt-4 transition-colors">
            {editingId ? 'Mettre à jour' : 'Ajouter'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

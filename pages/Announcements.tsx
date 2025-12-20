
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, AlertTriangle, Info, Pin, 
  Link as LinkIcon, ExternalLink, Bold, Italic, List, Paperclip, X, Upload, Circle, FileText, Download
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority, ExternalLink as LinkType } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

// Safe text formatter to prevent Error 31
const formatContent = (text: any) => {
    if (!text || typeof text !== 'string') return null;
    
    return text.split('\n').map((line, i) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return <br key={`br-${i}`} />;
        
        if (trimmedLine.startsWith('- ')) {
            return (
              <li key={`li-${i}`} className="ml-4 list-disc marker:text-gray-400">
                {trimmedLine.replace('- ', '')}
              </li>
            );
        }

        // Split by markdown markers and wrap in relevant tags
        const parts = trimmedLine.split(/(\*.*?\*|_.*?_)/g).map((part, j) => {
            if (!part) return "";
            if (part.startsWith('*') && part.endsWith('*')) {
                return <strong key={`bold-${j}`} className="font-bold text-gray-900 dark:text-white">{part.slice(1, -1)}</strong>;
            }
            if (part.startsWith('_') && part.endsWith('_')) {
                return <em key={`italic-${j}`} className="italic text-gray-700 dark:text-gray-300">{part.slice(1, -1)}</em>;
            }
            return part; // Return string, not object
        });
        
        return <p key={`p-${i}`} className="mb-1">{parts}</p>;
    });
};

export default function Announcements() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [readIds, setReadIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    content: '', 
    priority: 'normal' as AnnouncementPriority,
    attachments: [] as string[]
  });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  useEffect(() => {
    fetchAnnouncements();
    if (user) {
        const storedReads = localStorage.getItem(`uniconnect_read_anns_${user.id}`);
        if (storedReads) {
            try { setReadIds(JSON.parse(storedReads)); } catch(e) {}
        }
    }
  }, [user, adminViewClass]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await API.announcements.list();
      setAnnouncements(data);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = (id: string) => {
      if (user?.role === UserRole.STUDENT && !readIds.includes(id)) {
          const newIds = [...readIds, id];
          setReadIds(newIds);
          localStorage.setItem(`uniconnect_read_anns_${user.id}`, JSON.stringify(newIds));
      }
  };

  const displayedAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      if (user?.role === UserRole.ADMIN) {
        return adminViewClass ? (ann.className === adminViewClass || ann.className === 'Général') : true;
      }
      return ann.className === user?.className || ann.className === 'Général';
    });
  }, [user, adminViewClass, announcements]);

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Contenu copié.', type: 'success' });
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette annonce ?')) return;
    try {
      await API.announcements.delete(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      addNotification({ title: 'Supprimé', message: 'Annonce retirée.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ title: '', content: '', priority: 'normal', attachments: [] });
    setIsModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, ann: Announcement) => {
    e.stopPropagation();
    setEditingId(ann.id);
    setFormData({ 
        title: ann.title, 
        content: ann.content, 
        priority: ann.priority,
        attachments: ann.attachments || [] 
    });
    setIsModalOpen(true);
  };

  const handleAddAttachment = () => {
    const url = window.prompt("Lien vers la pièce jointe (PDF, Image, etc.) :");
    if (url && url.startsWith('http')) {
        setFormData(prev => ({...prev, attachments: [...prev.attachments, url]}));
    } else if (url) {
        alert("Lien invalide. Doit commencer par http.");
    }
  };

  const handleRemoveAttachment = (idx: number) => {
      setFormData(prev => ({...prev, attachments: prev.attachments.filter((_, i) => i !== idx)}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const payload = {
          title: formData.title,
          content: formData.content,
          priority: formData.priority,
          className: targetClass,
          attachments: formData.attachments
      };

      if (editingId) {
        const updatedAnn = await API.announcements.update(editingId, payload);
        setAnnouncements(prev => prev.map(a => a.id === editingId ? updatedAnn : a));
      } else {
        const newAnn = await API.announcements.create(payload);
        setAnnouncements(prev => [newAnn, ...prev]);
      }

      setIsModalOpen(false);
      addNotification({ title: 'Succès', message: 'Opération réussie.', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityStyle = (priority: AnnouncementPriority) => {
      switch(priority) {
          case 'urgent': return 'border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800';
          case 'important': return 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800';
          default: return 'border-blue-100 bg-white dark:bg-gray-800 dark:border-gray-700';
      }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 py-4 backdrop-blur-sm">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Megaphone className="text-primary-500" size={24} /> Avis & Annonces
        </h2>
        {canManage && (
          <button onClick={openNewModal} className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary-500/20">
            <Plus size={18} /> <span className="hidden sm:inline">Nouvelle annonce</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {displayedAnnouncements.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold">Aucune annonce</h3>
          </div>
        ) : (
          displayedAnnouncements.map((ann) => {
            const isUnread = user?.role === UserRole.STUDENT && !readIds.includes(ann.id);
            return (
              <div 
                key={ann.id} 
                onClick={() => handleMarkAsRead(ann.id)}
                className={`relative rounded-2xl border shadow-sm p-6 group transition-all ${getPriorityStyle(ann.priority)} ${isUnread ? 'ring-2 ring-primary-400 dark:ring-primary-500 bg-primary-50/10' : ''}`}
              >
                <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold">
                           {ann.author.charAt(0)}
                       </div>
                       <div>
                           <div className="flex items-center gap-2">
                              {user?.role === UserRole.STUDENT && (
                                <div 
                                  className={`w-2.5 h-2.5 rounded-full shadow-sm transition-colors ${isUnread ? 'bg-primary-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} 
                                  title={isUnread ? 'Non lue' : 'Lue'}
                                />
                              )}
                              <span className="text-sm font-bold">{ann.author}</span>
                              <span className="text-[10px] uppercase font-bold text-gray-400">{ann.priority}</span>
                           </div>
                           <div className="text-xs text-gray-500">{new Date(ann.date).toLocaleDateString()} • {ann.className}</div>
                       </div>
                   </div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={(e) => handleCopy(e, ann.content)} className="p-1.5 text-gray-400 hover:text-primary-500"><Copy size={14} /></button>
                      {canManage && (
                          <>
                              <button onClick={(e) => handleEdit(e, ann)} className="p-1.5 text-gray-400 hover:text-blue-500"><Pencil size={14} /></button>
                              <button onClick={(e) => handleDelete(e, ann.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                          </>
                      )}
                   </div>
                </div>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                   {ann.title}
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-4">
                    {formatContent(ann.content)}
                </div>
                
                {ann.attachments && ann.attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Pièces jointes</p>
                    <div className="flex flex-wrap gap-2">
                      {ann.attachments.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-100 dark:border-gray-600"
                        >
                          <FileText size={14} className="text-primary-500" />
                          <span className="truncate max-w-[150px]">Fichier {idx + 1}</span>
                          <Download size={12} className="text-gray-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier" : "Nouvelle Annonce"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="text" required value={formData.title} placeholder="Titre"
            onChange={e => setFormData({...formData, title: e.target.value})}
            className="w-full px-4 py-2 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="grid grid-cols-3 gap-2">
              {['normal', 'important', 'urgent'].map(p => (
                  <button key={p} type="button" onClick={() => setFormData({...formData, priority: p as any})}
                    className={`py-2 rounded-lg text-xs font-bold border capitalize transition-colors ${formData.priority === p ? 'bg-primary-50 border-primary-500 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300' : 'bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'}`}>
                    {p}
                  </button>
              ))}
          </div>
          <textarea 
            ref={textareaRef} required rows={5} value={formData.content} placeholder="Message..."
            onChange={e => setFormData({...formData, content: e.target.value})}
            className="w-full px-4 py-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
          />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Pièces jointes</label>
              <button type="button" onClick={handleAddAttachment} className="text-xs text-primary-600 font-bold hover:underline flex items-center gap-1">
                <Plus size={14} /> Ajouter un lien
              </button>
            </div>
            <div className="space-y-1">
              {formData.attachments.map((url, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600">
                  <span className="text-xs truncate max-w-[200px]">{url}</span>
                  <button type="button" onClick={() => handleRemoveAttachment(idx)} className="text-red-500 p-1">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 rounded-xl transition-opacity disabled:opacity-50">
             {submitting ? 'Envoi...' : 'Publier'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

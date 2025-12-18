
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, User, Share2, Copy, Trash2, Loader2, Pencil, 
  Calendar, Megaphone, AlertTriangle, Info, Pin, 
  Link as LinkIcon, ExternalLink, Bold, Italic, List, Paperclip, X, Upload, FileText
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority, ExternalLink as LinkType } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

// Simple text formatter for display
const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
        if (line.trim().startsWith('- ')) {
            return <li key={i} className="ml-4 list-disc marker:text-gray-400">{line.replace('- ', '')}</li>;
        }
        const parts = line.split(/(\*.*?\*|_.*?_)/g).map((part, j) => {
            if (part.startsWith('*') && part.endsWith('*')) return <strong key={j} className="font-bold text-gray-900 dark:text-white">{part.slice(1, -1)}</strong>;
            if (part.startsWith('_') && part.endsWith('_')) return <em key={j} className="italic text-gray-700 dark:text-gray-300">{part.slice(1, -1)}</em>;
            return part;
        });
        return <p key={i} className="mb-1">{parts}</p>;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [readIds, setReadIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    content: '', 
    priority: 'normal' as AnnouncementPriority,
    links: [] as LinkType[]
  });
  const [newLink, setNewLink] = useState({ label: '', url: '' });

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
      addNotification({ title: 'Erreur', message: 'Impossible de charger les annonces.', type: 'alert' });
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

  const handleShare = (e: React.MouseEvent, ann: Announcement) => {
    e.stopPropagation();
    const subject = encodeURIComponent(`Annonce: ${ann.title}`);
    const body = encodeURIComponent(`${ann.title}\n\n${ann.content}\n\nPosté le ${new Date(ann.date).toLocaleDateString()}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette annonce ?')) return;
    try {
      await API.announcements.delete(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      addNotification({ title: 'Supprimé', message: 'Annonce supprimée.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de supprimer.', type: 'alert' });
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ title: '', content: '', priority: 'normal', links: [] });
    setNewLink({ label: '', url: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, ann: Announcement) => {
    e.stopPropagation();
    setEditingId(ann.id);
    setFormData({ 
        title: ann.title, 
        content: ann.content, 
        priority: ann.priority,
        links: ann.links || [] 
    });
    setNewLink({ label: '', url: '' });
    setIsModalOpen(true);
  };

  const handleAddLink = () => {
      if(newLink.label && newLink.url) {
          setFormData(prev => ({ ...prev, links: [...prev.links, newLink] }));
          setNewLink({ label: '', url: '' });
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fakeUrl = URL.createObjectURL(file); 
    const fileLink: LinkType = { label: file.name, url: fakeUrl };
    setFormData(prev => ({ ...prev, links: [...prev.links, fileLink] }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    addNotification({ title: 'Fichier ajouté', message: `${file.name} prêt à être publié.`, type: 'success' });
  };

  const removeLink = (index: number) => {
      setFormData(prev => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }));
  };

  const insertFormat = (char: string, wrap: boolean = true) => {
      if(!textareaRef.current) return;
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = formData.content;
      
      let newText = '';
      if (wrap) {
        newText = text.substring(0, start) + char + text.substring(start, end) + char + text.substring(end);
      } else {
        newText = text.substring(0, start) + char + text.substring(start);
      }
      
      setFormData({ ...formData, content: newText });
      setTimeout(() => {
          if(textareaRef.current) {
             textareaRef.current.focus();
             textareaRef.current.selectionStart = textareaRef.current.selectionEnd = end + (wrap ? char.length * 2 : char.length);
          }
      }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const isImportant = formData.priority === 'important' || formData.priority === 'urgent';

      const payload = {
          title: formData.title,
          content: formData.content,
          priority: formData.priority,
          isImportant,
          links: formData.links
      };

      if (editingId) {
        const updatedAnn = await API.announcements.update(editingId, payload);
        setAnnouncements(prev => prev.map(a => a.id === editingId ? updatedAnn : a));
        addNotification({ title: 'Succès', message: 'Annonce mise à jour.', type: 'success' });
      } else {
        const newAnn = await API.announcements.create({
            ...payload,
            className: targetClass
        });
        setAnnouncements(prev => [newAnn, ...prev]);
        addNotification({ title: 'Succès', message: 'Annonce publiée.', type: 'success' });
      }

      setIsModalOpen(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Opération échouée.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityStyle = (priority: AnnouncementPriority) => {
      switch(priority) {
          case 'urgent': return 'border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800 hover:shadow-red-100 dark:hover:shadow-none';
          case 'important': return 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800 hover:shadow-yellow-100 dark:hover:shadow-none';
          default: return 'border-blue-100 bg-white dark:bg-gray-800 dark:border-gray-700';
      }
  };

  const getPriorityBadge = (priority: AnnouncementPriority) => {
      switch(priority) {
          case 'urgent': return (
            <span className="flex items-center gap-1 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-red-200 dark:border-red-800">
                <AlertTriangle size={10} /> Urgent
            </span>
          );
          case 'important': return (
            <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-yellow-200 dark:border-yellow-800">
                <Pin size={10} /> Important
            </span>
          );
          default: return (
             <span className="flex items-center gap-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-blue-100 dark:border-blue-800">
                <Info size={10} /> Info
            </span>
          );
      }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="animate-spin text-primary-500" /></div>;

  // ... (Keep existing JSX layout, just ensure it uses state variables correctly)
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 py-4 backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Megaphone className="text-primary-500" size={24} />
            Avis & Annonces
          </h2>
          {user?.role === UserRole.ADMIN && adminViewClass && (
             <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-full border border-primary-100 mt-1 inline-block">
               Filtre : {adminViewClass}
             </span>
          )}
        </div>
        
        {canManage && (
          <button onClick={openNewModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary-500/20 transition-all hover:scale-105 active:scale-95">
            <Plus size={18} /> <span className="hidden sm:inline">Nouvelle annonce</span>
          </button>
        )}
      </div>

      {/* Announcements Grid */}
      <div className="space-y-4">
        {displayedAnnouncements.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-500">
               <Megaphone size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aucune annonce</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Les nouvelles informations apparaîtront ici.</p>
          </div>
        ) : (
          displayedAnnouncements.map((ann) => {
            const isUnread = user?.role === UserRole.STUDENT && !readIds.includes(ann.id);
            const cardStyle = getPriorityStyle(ann.priority);

            return (
              <div 
                key={ann.id} 
                onClick={() => handleMarkAsRead(ann.id)}
                className={`relative rounded-2xl border shadow-sm transition-all duration-200 group overflow-hidden ${cardStyle} ${isUnread ? 'ring-1 ring-primary-300 dark:ring-primary-600' : ''}`}
              >
                {/* Urgent Strip */}
                {ann.priority === 'urgent' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 z-10"></div>}
                {isUnread && <div className="absolute top-4 right-4 w-3 h-3 bg-blue-500 rounded-full shadow-sm animate-pulse z-20" title="Non lu"></div>}

                <div className="p-5 sm:p-6 pl-6 sm:pl-8">
                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${ann.priority === 'urgent' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-white text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-white dark:border-gray-600'}`}>
                             {ann.author.charAt(0).toUpperCase()}
                         </div>
                         <div>
                             <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">{ann.author}</span>
                                {getPriorityBadge(ann.priority)}
                             </div>
                             <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                <span>{new Date(ann.date).toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="font-medium bg-gray-100 dark:bg-gray-700 px-1.5 rounded">{ann.className}</span>
                             </div>
                         </div>
                     </div>

                     {/* Actions Toolbar */}
                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-1">
                        <button onClick={(e) => handleCopy(e, ann.content)} className="p-1.5 text-gray-400 hover:text-primary-500 rounded transition-colors" title="Copier"><Copy size={14} /></button>
                        <button onClick={(e) => handleShare(e, ann)} className="p-1.5 text-gray-400 hover:text-primary-500 rounded transition-colors" title="Partager"><Share2 size={14} /></button>
                        {canManage && (
                            <>
                                <button onClick={(e) => handleEdit(e, ann)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded transition-colors" title="Modifier"><Pencil size={14} /></button>
                                <button onClick={(e) => handleDelete(e, ann.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors" title="Supprimer"><Trash2 size={14} /></button>
                            </>
                        )}
                     </div>
                  </div>

                  {/* Content */}
                  <div className="pl-13 ml-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{ann.title}</h3>
                      <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {formatContent(ann.content)}
                      </div>
                  </div>

                  {/* Links & Attachments */}
                  {ann.links && ann.links.length > 0 && (
                      <div className="mt-4 pl-1 flex flex-wrap gap-2">
                          {ann.links.map((link, idx) => (
                              <a 
                                key={idx} 
                                href={link.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-primary-600 dark:text-primary-400 hover:border-primary-300 transition-colors shadow-sm"
                              >
                                  {link.label.includes('.') ? <Paperclip size={12} /> : <LinkIcon size={12} />}
                                  {link.label} 
                                  <ExternalLink size={10} className="text-gray-400" />
                              </a>
                          ))}
                      </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Editor Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier l'annonce" : "Nouvelle Annonce"}>
        <form onSubmit={handleSubmit} className="space-y-5">
           
           {/* Title & Priority */}
           <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Titre de l'annonce</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-300 outline-none font-bold"
                  placeholder="Ex: Report de cours..."
                />
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Niveau de priorité</label>
                 <div className="grid grid-cols-3 gap-3">
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, priority: 'normal'})}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all ${formData.priority === 'normal' ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-100' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                        Normal
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, priority: 'important'})}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all ${formData.priority === 'important' ? 'bg-yellow-50 border-yellow-200 text-yellow-700 ring-2 ring-yellow-100' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                        Important
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, priority: 'urgent'})}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all ${formData.priority === 'urgent' ? 'bg-red-50 border-red-200 text-red-700 ring-2 ring-red-100' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                        Urgent
                    </button>
                 </div>
              </div>
           </div>

           {/* Rich Editor */}
           <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contenu</label>
              <div className="border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-700">
                  <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                      <button type="button" onClick={() => insertFormat('*')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="Gras"><Bold size={16} /></button>
                      <button type="button" onClick={() => insertFormat('_')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="Italique"><Italic size={16} /></button>
                      <div className="w-px h-4 bg-gray-300 mx-1"></div>
                      <button type="button" onClick={() => insertFormat('- ', false)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="Liste"><List size={16} /></button>
                  </div>
                  <textarea 
                    ref={textareaRef}
                    required
                    rows={6}
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    className="w-full px-4 py-3 bg-transparent text-gray-900 dark:text-white outline-none resize-none text-sm leading-relaxed"
                    placeholder="Détails de l'annonce... (Utilisez la barre d'outils pour formater)"
                  />
              </div>
           </div>

           {/* Links Section */}
           <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                   <Paperclip size={14} /> Pièces jointes & Liens
               </label>
               
               {/* Link List */}
               {formData.links.length > 0 && (
                   <div className="space-y-2 mb-3">
                       {formData.links.map((link, idx) => (
                           <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm text-xs">
                               <div className="flex items-center gap-2 truncate">
                                   <LinkIcon size={12} className="text-primary-500" />
                                   <span className="font-bold text-gray-800 dark:text-white">{link.label}</span>
                                   <span className="text-gray-400 truncate max-w-[150px]">{link.url}</span>
                               </div>
                               <button type="button" onClick={() => removeLink(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                           </div>
                       ))}
                   </div>
               )}

               {/* Add Link Inputs */}
               <div className="flex flex-col gap-3">
                  {/* File Upload Button */}
                  <div>
                      <input 
                         type="file" 
                         ref={fileInputRef} 
                         onChange={handleFileUpload} 
                         className="hidden" 
                      />
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-primary-400 transition-all"
                      >
                          <Upload size={16} /> Joindre un fichier
                      </button>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-bold justify-center">
                    <span className="h-px bg-gray-200 w-full"></span>
                    <span>OU</span>
                    <span className="h-px bg-gray-200 w-full"></span>
                  </div>

                  {/* Manual URL Input */}
                  <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Nom du lien" 
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs outline-none focus:border-primary-300"
                        value={newLink.label}
                        onChange={e => setNewLink({...newLink, label: e.target.value})}
                    />
                    <input 
                        type="url" 
                        placeholder="URL (https://...)" 
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs outline-none focus:border-primary-300"
                        value={newLink.url}
                        onChange={e => setNewLink({...newLink, url: e.target.value})}
                    />
                    <button 
                        type="button" 
                        onClick={handleAddLink}
                        disabled={!newLink.label || !newLink.url}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                  </div>
               </div>
           </div>

           <div className="pt-2">
                <button 
                    type="submit" 
                    disabled={submitting}
                    className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                >
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : (editingId ? <Pencil size={20} /> : <Megaphone size={20} />)}
                    {submitting ? 'Enregistrement...' : (editingId ? 'Mettre à jour' : 'Publier l\'annonce')}
                </button>
           </div>
        </form>
      </Modal>
    </div>
  );
}

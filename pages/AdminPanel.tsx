
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  Users, BookOpen, UserPlus, Search, Loader2, School, 
  Lock, Plus, Trash2, LayoutDashboard, Shield, 
  FileText, Ban, CheckCircle, RefreshCw, PenSquare, Activity, Calendar, Filter, Download
} from 'lucide-react';
import { UserRole, ClassGroup, ActivityLog } from '../types';
import Modal from '../components/Modal';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type TabType = 'dashboard' | 'users' | 'classes' | 'logs';

export default function AdminPanel() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [users, setUsers] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<ClassGroup[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dashboard Stats
  const [stats, setStats] = useState({
    usersCount: 0,
    classesCount: 0,
    rolesData: [] as any[],
    recentLogs: [] as ActivityLog[]
  });

  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: 'temporary-password-123', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [creatingClass, setCreatingClass] = useState(false);
  const [classFormData, setClassFormData] = useState({ id: '', name: '', email: '' });
  const [isEditClassMode, setIsEditClassMode] = useState(false);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      fetchGlobalData();
    }
  }, [user]);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
        const [usersData, classesData, logsData] = await Promise.all([
            API.auth.getUsers(),
            API.classes.list(),
            API.logs.list()
        ]);

        setUsers(usersData);
        setClassesList(classesData);
        setLogs(logsData.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

        const rolesCount = { [UserRole.ADMIN]: 0, [UserRole.DELEGATE]: 0, [UserRole.STUDENT]: 0 };
        usersData.forEach(u => { 
            const role = (u.role as string).toUpperCase() as UserRole;
            if (rolesCount[role] !== undefined) rolesCount[role]++; 
        });

        setStats({
            usersCount: usersData.length,
            classesCount: classesData.length,
            rolesData: [
                { name: 'Étudiants', value: rolesCount[UserRole.STUDENT], color: '#3B82F6' },
                { name: 'Délégués', value: rolesCount[UserRole.DELEGATE], color: '#10B981' },
                { name: 'Admins', value: rolesCount[UserRole.ADMIN], color: '#8B5CF6' },
            ],
            recentLogs: logsData.slice(0, 10)
        });

    } catch(e) {
        addNotification({ title: 'Erreur', message: 'Chargement des données échoué', type: 'alert' });
    } finally {
        setLoading(false);
    }
  };

  // ACTIONS UTILISATEURS
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      await API.auth.createUser({
        name: newUser.fullName,
        email: newUser.email,
        role: newUser.role.toLowerCase(),
        className: newUser.className
      }, user?.name || 'Admin');
      
      await fetchGlobalData();
      setIsUserModalOpen(false);
      setNewUser({ fullName: '', email: '', password: 'temporary-password-123', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
      addNotification({ title: 'Utilisateur créé', message: 'Compte prêt.', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error.message, type: 'alert' });
    } finally { setCreatingUser(false); }
  };

  const handleToggleStatus = async (userId: string) => {
      try {
          await API.auth.toggleUserStatus(user?.name || 'Admin', userId);
          fetchGlobalData();
          addNotification({ title: 'Succès', message: 'Statut mis à jour.', type: 'info' });
      } catch(e) { addNotification({ title: 'Erreur', message: "Échec.", type: 'alert' }); }
  };

  const handleResetPassword = async (userId: string) => {
      if(!window.confirm("Réinitialiser le mot de passe ?")) return;
      try {
          await API.auth.resetUserPassword(user?.name || 'Admin', userId);
          addNotification({ title: 'Succès', message: 'Lien de reset envoyé par mail.', type: 'success' });
      } catch(e) { addNotification({ title: 'Erreur', message: "Échec.", type: 'alert' }); }
  };

  const handleDeleteUser = async (userId: string) => {
      if(!window.confirm("Supprimer cet utilisateur ?")) return;
      try {
          await API.auth.deleteUser(userId, user?.name);
          fetchGlobalData();
          addNotification({ title: 'Supprimé', message: 'Utilisateur retiré.', type: 'info' });
      } catch(e) { addNotification({ title: 'Erreur', message: "Échec.", type: 'alert' }); }
  };

  // ACTIONS CLASSES
  const openClassModal = (cls?: ClassGroup) => {
      if(cls) {
          setClassFormData({ id: cls.id, name: cls.name, email: cls.email });
          setIsEditClassMode(true);
      } else {
          setClassFormData({ id: '', name: '', email: '' });
          setIsEditClassMode(false);
      }
      setIsClassModalOpen(true);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreatingClass(true);
      try {
          if(isEditClassMode) {
              await API.classes.update(classFormData.id, { name: classFormData.name, email: classFormData.email }, user?.name || 'Admin');
          } else {
              await API.classes.create(classFormData.name, classFormData.email, user?.name || 'Admin');
          }
          await fetchGlobalData();
          setIsClassModalOpen(false);
          addNotification({ title: 'Succès', message: 'Action effectuée.', type: 'success' });
      } catch (error) {
          addNotification({ title: 'Erreur', message: 'Opération échouée.', type: 'alert' });
      } finally { setCreatingClass(false); }
  };

  const handleDeleteClass = async (id: string) => {
      if(!window.confirm("Supprimer cette classe ?")) return;
      try {
          await API.classes.delete(id, user?.name || 'Admin');
          fetchGlobalData();
          addNotification({ title: 'Supprimée', message: 'Classe retirée.', type: 'warning' });
      } catch (error) { addNotification({ title: 'Erreur', message: 'Échec suppression.', type: 'alert' }); }
  };

  const filteredUsers = useMemo(() => users.filter(u => 
    (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.className?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ), [users, searchTerm]);

  const filteredLogs = useMemo(() => logs.filter(l => 
    (l.actor?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (l.action?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (l.target?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ), [logs, searchTerm]);

  if (loading && users.length === 0) return (
      <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary-500" size={40} /></div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-full md:w-64 flex-shrink-0 space-y-2">
         <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-soft border border-gray-100 dark:border-gray-700">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Administration</h3>
             <nav className="space-y-1">
                 {[
                   { id: 'dashboard', icon: LayoutDashboard, label: 'Vue Globale' },
                   { id: 'classes', icon: BookOpen, label: 'Gestion Classes' },
                   { id: 'users', icon: Users, label: 'Utilisateurs' },
                   { id: 'logs', icon: Activity, label: 'Journal d\'audit' }
                 ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as TabType); setSearchTerm(''); }} 
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === tab.id ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                 ))}
             </nav>
         </div>
         
         <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-lg">
             <div className="flex items-center gap-2 mb-2">
                 <Shield size={20} className="text-green-400" />
                 <span className="font-bold text-sm">Système Sécurisé</span>
             </div>
             <p className="text-xs text-gray-400 leading-relaxed">Audit actif : toutes les modifications sont traçables.</p>
         </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
         
         {/* DASHBOARD TAB */}
         {activeTab === 'dashboard' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase">Utilisateurs Totaux</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.usersCount}</h3>
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-green-500 font-bold uppercase"><CheckCircle size={10} /> Base active</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase">Classes Créées</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.classesCount}</h3>
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-500 font-bold uppercase"><School size={10} /> DIC, Licence, Master</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase">Santé du Serveur</p>
                        <div className="flex items-center gap-2 mt-3">
                            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Séquentiel OK</span>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Users size={18} /> Répartition des Rôles</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.rolesData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" animationDuration={1000}>
                                        {stats.rolesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Activity size={18} /> Journal Récent</h3>
                            <button onClick={() => setActiveTab('logs')} className="text-xs font-bold text-primary-500 hover:underline">Voir tout</button>
                        </div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {stats.recentLogs.map(log => (
                                <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-transparent hover:border-gray-100 transition-colors">
                                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                                        log.type === 'create' ? 'bg-blue-100 text-blue-600' : 
                                        log.type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                    }`}>
                                        {log.type === 'create' ? <Plus size={14} /> : log.type === 'delete' ? <Trash2 size={14} /> : <PenSquare size={14} />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-800 dark:text-white leading-tight">{log.action} : {log.target}</p>
                                        <p className="text-[10px] text-gray-400 mt-1 uppercase">Par {log.actor} • {new Date(log.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
         )}
         
         {/* USERS TAB */}
         {activeTab === 'users' && (
             <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden">
                 <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-gray-800">
                     <div className="relative w-full md:w-80">
                         <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                         <input type="text" placeholder="Rechercher (nom, mail, classe)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-300 outline-none" />
                     </div>
                     <button onClick={() => setIsUserModalOpen(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 transition-transform active:scale-95">
                         <UserPlus size={18} /> Créer un Utilisateur
                     </button>
                 </div>
                 <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                         <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                             <tr>
                                 <th className="px-6 py-4">Utilisateur</th>
                                 <th className="px-6 py-4">Rôle</th>
                                 <th className="px-6 py-4">Classe</th>
                                 <th className="px-6 py-4 text-center">Actions</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                             {filteredUsers.map(u => (
                                 <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                     <td className="px-6 py-4">
                                         <div className="flex items-center gap-3">
                                             <img src={u.avatar} className={`w-9 h-9 rounded-full bg-gray-100 ${!u.isActive ? 'grayscale opacity-50' : ''}`} alt="" />
                                             <div className="min-w-0">
                                                 <p className={`font-bold truncate ${!u.isActive ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{u.name}</p>
                                                 <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                             </div>
                                         </div>
                                     </td>
                                     <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                            u.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30' : 
                                            u.role === UserRole.DELEGATE ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/30' : 
                                            'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30'
                                        }`}>
                                            {u.role}
                                        </span>
                                     </td>
                                     <td className="px-6 py-4">
                                         <span className="text-gray-600 dark:text-gray-300 font-medium text-xs">{u.className || '-'}</span>
                                     </td>
                                     <td className="px-6 py-4 text-right">
                                         <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={() => handleToggleStatus(u.id)} className={`p-2 rounded-lg transition-colors ${!u.isActive ? 'text-green-500 hover:bg-green-50' : 'text-orange-400 hover:bg-orange-50'}`} title={u.isActive ? 'Désactiver' : 'Réactiver'}>
                                                 {u.isActive ? <Ban size={16} /> : <CheckCircle size={16} />}
                                             </button>
                                             <button onClick={() => handleResetPassword(u.id)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Réinit MDP">
                                                 <RefreshCw size={16} />
                                             </button>
                                             <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Supprimer">
                                                 <Trash2 size={16} />
                                             </button>
                                         </div>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                     {filteredUsers.length === 0 && <div className="p-12 text-center text-gray-400">Aucun utilisateur trouvé.</div>}
                 </div>
             </div>
         )}

         {/* CLASSES TAB */}
         {activeTab === 'classes' && (
             <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden">
                 <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800">
                     <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><School size={20} className="text-primary-500" /> Gestion des Classes</h3>
                     <button onClick={() => openClassModal()} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20">
                         <Plus size={18} /> Nouvelle Classe
                     </button>
                 </div>
                 <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                         <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                             <tr>
                                 <th className="px-6 py-4">Classe</th>
                                 <th className="px-6 py-4">Email Groupe</th>
                                 <th className="px-6 py-4 text-center">Effectif</th>
                                 <th className="px-6 py-4 text-right">Actions</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                             {classesList.map(cls => (
                                 <tr key={cls.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                     <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <div className="w-8 h-8 bg-primary-50 text-primary-500 rounded flex items-center justify-center font-black text-[10px]">{cls.name.split(' ')[0]}</div>
                                        {cls.name}
                                     </td>
                                     <td className="px-6 py-4 text-gray-400 font-mono text-xs">{cls.email || 'Non défini'}</td>
                                     <td className="px-6 py-4 text-center">
                                         <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded font-bold text-xs">
                                             {users.filter(u => u.className === cls.name).length} étudiants
                                         </span>
                                     </td>
                                     <td className="px-6 py-4 text-right">
                                         <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={() => openClassModal(cls)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><PenSquare size={16} /></button>
                                             <button onClick={() => handleDeleteClass(cls.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                         </div>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                     {classesList.length === 0 && <div className="p-12 text-center text-gray-400">Aucune classe répertoriée.</div>}
                 </div>
             </div>
         )}

         {/* LOGS TAB */}
         {activeTab === 'logs' && (
             <div className="space-y-4">
                 <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                     <div className="relative w-80">
                         <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                         <input type="text" placeholder="Filtrer le journal d'audit..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-transparent focus:bg-white rounded-lg text-sm outline-none transition-all" />
                     </div>
                     <div className="flex gap-2">
                         <button className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300"><Filter size={16} /> Filtres</button>
                         <button className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300"><Download size={16} /> Exporter</button>
                     </div>
                 </div>

                 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                         <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                             <tr>
                                 <th className="px-6 py-4">Action</th>
                                 <th className="px-6 py-4">Cible</th>
                                 <th className="px-6 py-4">Acteur</th>
                                 <th className="px-6 py-4">Date & Heure</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                             {filteredLogs.map(log => (
                                 <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                     <td className="px-6 py-4">
                                         <span className={`flex items-center gap-2 font-bold ${
                                             log.type === 'delete' ? 'text-red-500' : 
                                             log.type === 'create' ? 'text-blue-500' : 'text-gray-700 dark:text-gray-200'
                                         }`}>
                                             {log.action}
                                         </span>
                                     </td>
                                     <td className="px-6 py-4 text-gray-500 dark:text-gray-400 italic text-xs">{log.target}</td>
                                     <td className="px-6 py-4 font-bold text-gray-700 dark:text-white">{log.actor}</td>
                                     <td className="px-6 py-4 text-gray-400 text-xs">
                                         <div className="flex items-center gap-1.5"><Calendar size={12} /> {new Date(log.timestamp).toLocaleString()}</div>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                    </table>
                 </div>
             </div>
         )}
      </div>

      {/* --- MODALS --- */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Création d'Utilisateur">
         <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-4">
               <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nom Complet</label>
                   <input required className="w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-300 outline-none dark:text-white" placeholder="Ex: Adama Diop" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
               </div>
               <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Universitaire (@esp.sn)</label>
                   <input required type="email" className="w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-300 outline-none dark:text-white" placeholder="adama.diop@esp.sn" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rôle Système</label>
                   <select className="w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-300 outline-none dark:text-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                       <option value={UserRole.STUDENT}>Étudiant</option>
                       <option value={UserRole.DELEGATE}>Délégué</option>
                       <option value={UserRole.ADMIN}>Administrateur</option>
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Affectation Classe</label>
                   <select className="w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-300 outline-none dark:text-white" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})}>
                        <option value="">Général / Aucun</option>
                        {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                   </select>
               </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] rounded-xl border border-blue-100 dark:border-blue-800 flex items-center gap-3">
                <Shield size={20} className="flex-shrink-0" />
                <p>Une notification automatique sera envoyée à l'utilisateur pour définir son accès personnel via Supabase Auth.</p>
            </div>

            <button disabled={creatingUser} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 flex justify-center transition-all hover:scale-[1.02] active:scale-95">
                {creatingUser ? <Loader2 className="animate-spin" /> : 'Initialiser le compte'}
            </button>
         </form>
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title={isEditClassMode ? "Modification Classe" : "Configuration de Classe"}>
          <form onSubmit={handleClassSubmit} className="space-y-4">
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nom (Identifiant)</label>
                  <input required className="w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-300 outline-none dark:text-white font-bold" placeholder="Ex: DIC 2 Informatique" value={classFormData.name} onChange={e => setClassFormData({...classFormData, name: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Institutionnel (Facultatif)</label>
                  <input type="email" className="w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-primary-300 outline-none dark:text-white" placeholder="delegue.dic2@esp.sn" value={classFormData.email} onChange={e => setClassFormData({...classFormData, email: e.target.value})} />
              </div>
              <button disabled={creatingClass} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/20 flex justify-center transition-all hover:scale-[1.02]">
                  {creatingClass ? <Loader2 className="animate-spin" /> : (isEditClassMode ? 'Enregistrer les modifications' : 'Créer la structure')}
              </button>
          </form>
      </Modal>
    </div>
  );
}

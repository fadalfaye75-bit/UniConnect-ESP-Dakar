
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { Lock, Save, Loader2, Shield, Mail, Briefcase, GraduationCap, RefreshCcw } from 'lucide-react';

export default function Profile() {
  const { user, updateCurrentUser } = useAuth();
  const { addNotification } = useNotification();
  
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      addNotification({ title: 'Erreur', message: 'Mots de passe différents.', type: 'alert' });
      return;
    }

    setLoading(true);
    try {
      if(user) await API.auth.updatePassword(user.id, passwords.newPassword);
      addNotification({ title: 'Succès', message: 'Mot de passe modifié.', type: 'success' });
      setPasswords({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Echec.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const refreshAvatar = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Forcer la mise à jour du nom pour régénérer l'avatar d'initiales si besoin
      await updateCurrentUser({ name: user.name });
      addNotification({ title: 'Succès', message: 'Avatar synchronisé.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de synchronisation.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Mon Profil</h2>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          
          {/* Profile Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center text-center relative overflow-hidden">
             {/* Background Decoration */}
             <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary-50 to-transparent dark:from-primary-900/10"></div>
             
            <div className="relative group z-10">
                <img 
                  src={user?.avatar} 
                  alt="Profile" 
                  className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 shadow-lg mb-4 object-cover bg-gray-100" 
                />
                <button 
                  onClick={refreshAvatar}
                  disabled={loading}
                  className="absolute bottom-4 right-0 bg-primary-400 text-white p-2 rounded-full border-4 border-white dark:border-gray-800 shadow-sm hover:bg-primary-500 transition-colors disabled:opacity-50"
                  title="Rafraîchir les initiales"
                >
                    <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{user?.name}</h3>
            <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                user?.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                user?.role === 'DELEGATE' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
            }`}>
                {user?.role}
            </span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6 space-y-5">
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-lg"><Mail size={18} /></div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Email</p>
                    <p className="truncate font-medium text-gray-800 dark:text-white">{user?.email}</p>
                </div>
             </div>
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-lg"><GraduationCap size={18} /></div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Classe</p>
                    <p className="font-medium text-gray-800 dark:text-white">{user?.className}</p>
                </div>
             </div>
             {user?.schoolName && (
               <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                  <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-lg"><Briefcase size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Établissement</p>
                    <p className="font-medium text-gray-800 dark:text-white">{user?.schoolName}</p>
                  </div>
               </div>
             )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-8">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100 dark:border-gray-700">
               <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
                   <Shield size={24} />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sécurité du compte</h3>
                   <p className="text-sm text-gray-500">Mettez à jour votre mot de passe pour sécuriser votre accès.</p>
               </div>
            </div>
            
            <form onSubmit={handlePasswordChange} className="space-y-6 max-w-lg">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input 
                      type="password" 
                      required
                      value={passwords.newPassword}
                      onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:border-primary-300 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Confirmer le mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input 
                      type="password" 
                      required
                      value={passwords.confirmPassword}
                      onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:border-primary-300 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-4">
                   <button 
                     type="submit" 
                     disabled={loading}
                     className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                     {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                     Enregistrer les modifications
                   </button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

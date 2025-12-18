
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { API } from '../services/api';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
  adminViewClass: string | null;
  setAdminViewClass: (classId: string | null) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminViewClass, setAdminViewClass] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const initAuth = async () => {
      try {
        const sessionUser = await API.auth.getSession();
        setUser(sessionUser);
      } catch (e) {
        console.error("Auth initialization failed", e);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAdminViewClass(null);
      } else if (session) {
        const profile = await API.auth.getSession();
        setUser(profile);
      } else if (event === 'USER_DELETED') {
        setUser(null);
        setAdminViewClass(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const foundUser = await API.auth.login(email, pass);
    setUser(foundUser);
  };

  const logout = async () => {
    // 1. Déconnexion optimiste : on vide l'état immédiatement pour rediriger l'utilisateur sans attendre l'API
    setUser(null);
    setAdminViewClass(null);
    
    try {
      // 2. On tente de fermer la session proprement côté serveur
      await API.auth.logout();
      
      // 3. Nettoyage manuel exhaustif du localStorage pour éviter toute restauration de session parasite
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('-auth-token') || key.includes('supabase.auth')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Si l'API échoue (ex: déjà déconnecté ou pas de réseau), l'utilisateur est quand même redirigé
      // car setUser(null) a déjà été appelé au début de la fonction.
      console.warn("La session distante n'a pas pu être fermée proprement, mais l'accès local a été révoqué.", e);
    }
  };

  const updateCurrentUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = await API.auth.updateProfile(user.id, updates);
    if (updatedUser) setUser(updatedUser);
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      document.documentElement.classList.toggle('dark', newMode);
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      return newMode;
    });
  };

  if (loading) {
      return (
          <div id="app-loader">
              <div className="spinner"></div>
              <p className="mt-4 text-sm font-medium text-gray-500">Connexion sécurisée...</p>
          </div>
      );
  }

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, login, logout, updateCurrentUser,
      adminViewClass, setAdminViewClass, toggleTheme, isDarkMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

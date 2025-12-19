
import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Loader2 } from 'lucide-react';

// Lazy loaded pages
const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Exams = lazy(() => import('./pages/Exams'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Meet = lazy(() => import('./pages/Meet'));
const Polls = lazy(() => import('./pages/Polls'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Profile = lazy(() => import('./pages/Profile'));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-gray-50/50 dark:bg-gray-900/50">
    <Loader2 className="animate-spin text-primary-500 mb-4" size={40} />
    <p className="text-sm font-bold text-gray-500 animate-pulse">Chargement du module...</p>
  </div>
);

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <>
      {children}
    </>
  );
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/meet" element={<Meet />} />
          <Route path="/polls" element={<Polls />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

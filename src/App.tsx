import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ApplicantPortal } from './components/ApplicantPortal.tsx';
import { AdminLogin } from './components/AdminLogin.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';

function RouterContent() {
  const { admin, token, loading } = useAuth();
  const [route, setRoute] = useState<string>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) return path;
    return '/apply';
  });

  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setRoute(newPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setRoute(path === '/' ? '/apply' : path);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs font-mono text-slate-500">
        Initializing Doorbly Portal...
      </div>
    );
  }

  // Protected Admin Routes: /admin, /admin/login, /admin/dashboard (#2, #13)
  if (route.startsWith('/admin')) {
    if (!admin || !token) {
      return (
        <AdminLogin
          onLoginSuccess={() => navigate('/admin/dashboard')}
          onBackToApply={() => navigate('/apply')}
        />
      );
    }
    return <AdminDashboard onNavigateToApply={() => navigate('/apply')} />;
  }

  // Public Applicant Portal: /apply (#2)
  return <ApplicantPortal onNavigateToAdmin={() => navigate('/admin/dashboard')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <RouterContent />
    </AuthProvider>
  );
}

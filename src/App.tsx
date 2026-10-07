import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ApplicantPortal } from './components/ApplicantPortal.tsx';
import { AdminLogin } from './components/AdminLogin.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';

function RouterContent() {
  const { admin, token, loading } = useAuth();
  const [route, setRoute] = useState<string>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('/admin') || path.startsWith('/admin')) return '/admin/dashboard';
    return '/apply';
  });

  const navigate = (newPath: string) => {
    setRoute(newPath);
    // Keep URL root `/` with hash `#/apply` or `#/admin` on static hosts so browser refresh never triggers a 404 even before vercel.json is pushed
    try {
      if (window.location.hostname.includes('vercel.app')) {
        window.history.pushState({}, '', `/#${newPath}`);
      } else {
        window.history.pushState({}, '', newPath);
      }
    } catch {
      // ignore history errors
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.startsWith('/admin') || path.startsWith('/admin')) {
        setRoute('/admin/dashboard');
      } else {
        setRoute('/apply');
      }
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
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

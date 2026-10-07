import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';

export interface AdminUserProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'HR';
  active: boolean;
}

interface AuthContextType {
  admin: AdminUserProfile | null;
  token: string | null;
  loading: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_TOKEN_STORAGE_KEY = 'doorbly_admin_session_token';

const SOLE_AUTHORIZED_ADMIN: AdminUserProfile = {
  id: 'admin-super-tribune-id',
  userId: 'admin-super-tribune',
  name: 'Debabrata Mohanta',
  email: 'debabrata.tribune@gmail.com',
  role: 'SUPER_ADMIN',
  active: true,
};

async function safeParseJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const savedToken = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
        if (savedToken) {
          // Verify token embeds the sole authorized email
          if (savedToken.includes('debabrata.tribune@gmail.com')) {
            try {
              const res = await fetch('/api/admin/me', {
                headers: {
                  Authorization: `Bearer ${savedToken}`,
                },
              });
              const data = await safeParseJson(res);
              if (res.ok && data?.admin) {
                if (mounted) {
                  setToken(savedToken);
                  setAdmin(data.admin);
                  setLoading(false);
                }
                return;
              }
            } catch {
              // Fallback for static Vercel deployment
            }

            if (mounted) {
              setToken(savedToken);
              setAdmin(SOLE_AUTHORIZED_ADMIN);
              setLoading(false);
            }
            return;
          } else {
            localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
            if (mounted) {
              setToken(null);
              setAdmin(null);
            }
          }
        }
      } catch (e) {
        console.error('Session restore error:', e);
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const email = (firebaseUser.email || '').trim().toLowerCase();
          if (email === 'debabrata.tribune@gmail.com') {
            try {
              const idToken = await firebaseUser.getIdToken();
              if (mounted) {
                setToken(idToken);
                setAdmin(SOLE_AUTHORIZED_ADMIN);
                localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, idToken);
              }
            } catch (err) {
              console.error('Failed to verify Firebase admin user:', err);
            }
          }
        }
        if (mounted) setLoading(false);
      });

      return unsubscribe;
    };

    const unsubPromise = restoreSession();

    return () => {
      mounted = false;
      unsubPromise.then((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  const loginWithCredentials = async (email: string, password: string) => {
    const cleanEmail = String(email || '').trim().toLowerCase();

    // Strictly enforce sole authorized administrator credentials everywhere (Express, Supabase, and Vercel static)
    if (cleanEmail !== 'debabrata.tribune@gmail.com' || password !== 'Devraj@1122') {
      throw new Error(
        'Unauthorized: Access is restricted exclusively to the authorized administrator account.'
      );
    }

    // 1. If Supabase Auth is configured, sign in so Supabase RLS policies recognize authenticated session
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
      } catch {
        // Proceed even if Supabase Auth user hasn't been created in external dashboard yet
      }
    }

    // 2. Try Express backend API (/api/admin/login)
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await safeParseJson(response);
      if (data) {
        if (!response.ok) {
          throw new Error(data.error || 'Invalid email or password.');
        }
        setToken(data.token);
        setAdmin(data.admin);
        try {
          localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token);
        } catch {
          // ignore
        }
        return;
      }
    } catch (err: any) {
      if (err?.message?.includes('Unauthorized')) {
        throw err;
      }
    }

    // 3. Fallback for static Vercel deployment where /api/* Express server is not running
    const fallbackToken = `doorbly-admin-session:${cleanEmail}:admin-super-tribune`;
    setToken(fallbackToken);
    setAdmin(SOLE_AUTHORIZED_ADMIN);
    try {
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, fallbackToken);
    } catch {
      // ignore
    }
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const email = (result.user.email || '').trim().toLowerCase();
    if (email !== 'debabrata.tribune@gmail.com') {
      await signOut(auth);
      throw new Error(
        'Access Denied: Only debabrata.tribune@gmail.com is authorized to access the Admin Panel.'
      );
    }
    const idToken = await result.user.getIdToken();
    setToken(idToken);
    setAdmin(SOLE_AUTHORIZED_ADMIN);
    try {
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, idToken);
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      if (auth.currentUser) {
        await signOut(auth);
      }
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setToken(null);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        token,
        loading,
        loginWithCredentials,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

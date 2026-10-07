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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const res = await fetch('/api/admin/me', {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setToken(idToken);
            setAdmin(data.admin);
          }
        } catch (err) {
          console.error('Failed to verify Firebase admin user:', err);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithCredentials = async (email: string, password: string) => {
    // If external Supabase project is also configured, authenticate against Supabase Auth first
    if (isSupabaseConfigured && supabase) {
      const { data: supaData, error: supaError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!supaError && supaData.user) {
        const sessionToken = `doorbly-admin-session:${email}:${supaData.user.id}`;
        const res = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (res.ok) {
          const profileData = await res.json();
          setToken(sessionToken);
          setAdmin(profileData.admin);
          return;
        }
      }
    }

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Invalid email or password.');
    }

    setToken(data.token);
    setAdmin(data.admin);
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await result.user.getIdToken();
    const res = await fetch('/api/admin/me', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to verify administrator privileges.');
    }
    setToken(idToken);
    setAdmin(data.admin);
  };

  const logout = async () => {
    try {
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

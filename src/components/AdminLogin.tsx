import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Lock, ArrowLeft, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToApply: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onBackToApply,
}) => {
  const { loginWithCredentials } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginWithCredentials(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8 text-slate-100 overflow-x-hidden">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToApply}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white cursor-pointer py-1.5"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="truncate">Return to Applicant Portal</span>
        </button>
        <div className="text-xs sm:text-sm font-bold tracking-tight text-white shrink-0">
          DOORBLY ADMIN
        </div>
      </div>

      <div className="max-w-md w-full mx-auto bg-white text-slate-900 rounded-xl border border-slate-200 p-5 sm:p-8 my-6 sm:my-auto shadow-xl">
        <div className="flex items-center gap-2 text-teal-700 mb-3">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="text-[11px] sm:text-xs font-mono font-semibold uppercase tracking-wider">
            Authorized Administrator Access
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Administrator Sign In
        </h1>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Enter your authorized Doorbly administrator credentials to access the recruitment and KYC verification console.
        </p>

        {error && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 sm:mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Administrator Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter administrator email"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] py-2.5 px-4 bg-slate-900 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {submitting ? 'Authenticating...' : 'Sign In to Admin Dashboard'}
          </button>
        </form>
      </div>

      <div className="text-center text-[11px] sm:text-xs text-slate-500 pb-1">
        Doorbly Recruitment &amp; KYC Verification Console · Restricted Administrator Access
      </div>
    </div>
  );
};

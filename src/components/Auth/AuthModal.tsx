import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, Mail, Lock, User, Loader2, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn, signUp, isOffline } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isOffline) {
        throw new Error('Supabase integration is currently unconfigured. Run in Mock Mode instead.');
      }

      if (isSignUp) {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        await signUp(email, password, fullName);
        setSuccessMessage('Registration successful! Please check your email inbox to verify your account.');
      } else {
        await signIn(email, password);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
      {/* Modal Container */}
      <div className="bg-white border border-theme-divider rounded-2xl max-w-md w-full p-8 shadow-2xl relative space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-brand-slate hover:text-foreground hover:bg-slate-100 rounded-lg transition-premium cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-brand-indigo flex items-center justify-center text-white font-black mx-auto shadow-md shadow-brand-indigo/10">
            C
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {isSignUp ? 'Create your Chronicle Account' : 'Welcome back to Chronicle AI'}
          </h3>
          <p className="text-xs text-brand-slate">
            {isSignUp ? 'Establish a secure profile to sync your hourly blocks.' : 'Log in to synchronize metrics across databases.'}
          </p>
        </div>

        {/* Warning Banners */}
        {isOffline && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Offline Sandboxing Active</span>
              <p className="text-[10px] mt-0.5 leading-tight text-amber-700">Database connections are not established. Sign up/Log in are locked. Use Mock Mode below.</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-brand-slate absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  disabled={isOffline || loading}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full text-xs border border-theme-divider rounded-xl pl-10 pr-3.5 py-2.5 bg-white text-foreground focus:outline-none focus:border-brand-indigo"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-brand-slate absolute left-3.5 top-3" />
              <input
                type="email"
                required
                disabled={isOffline || loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full text-xs border border-theme-divider rounded-xl pl-10 pr-3.5 py-2.5 bg-white text-foreground focus:outline-none focus:border-brand-indigo"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-slate block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-brand-slate absolute left-3.5 top-3" />
              <input
                type="password"
                required
                disabled={isOffline || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs border border-theme-divider rounded-xl pl-10 pr-3.5 py-2.5 bg-white text-foreground focus:outline-none focus:border-brand-indigo"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isOffline || loading}
            className="w-full py-3 bg-brand-indigo hover:bg-brand-indigo-dark text-white rounded-xl text-xs font-bold shadow-md shadow-brand-indigo/10 transition-premium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Log In'
            )}
          </button>
        </form>

        {/* Form Footer Toggle */}
        <div className="text-center text-xs text-brand-slate border-t border-theme-border pt-4">
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-brand-indigo font-bold hover:underline cursor-pointer focus:outline-none"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-brand-indigo font-bold hover:underline cursor-pointer focus:outline-none"
              >
                Create Account
              </button>
            </p>
          )}

          {/* Sandbox Fallback */}
          <div className="mt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-[10px] text-brand-slate border border-theme-divider px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 font-bold transition-premium flex items-center gap-1 mx-auto cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-indigo" /> Enter Mock Sandbox Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

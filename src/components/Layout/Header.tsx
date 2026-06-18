import React, { useState, useEffect } from 'react';
import { Flame, CheckCircle, User, LogOut, ShieldAlert, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  activeTab: string;
  efficiencyScore: number;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, efficiencyScore, onOpenAuthModal }) => {
  const { user, profile, signOut, isOffline } = useAuth();
  const [isBrowserOffline, setIsBrowserOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsBrowserOffline(false);
    const handleOffline = () => setIsBrowserOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getBreadcrumb = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Productivity Analytics';
      case 'planner':
        return 'Time Block Scheduler';
      case 'ai-summary':
        return 'AI Executive Summary';
      case 'settings':
        return 'System Preferences';
      default:
        return 'Chronicle AI';
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Girish Mulgund';
  const activeStreak = profile?.streak_count ?? 4;

  return (
    <header className="h-16 border-b border-theme-divider bg-white px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 print:hidden">
      {/* Breadcrumb / Title & Mobile Logo */}
      <div className="flex items-center gap-2 select-none">
        <div className="flex items-center gap-2 md:hidden">
          <img 
            src="/logo.png" 
            alt="Chronicle AI Logo" 
            className="w-7 h-7 rounded-lg object-contain shadow-xs"
          />
          <div className="flex flex-col">
            <h1 className="text-xs font-bold text-foreground tracking-tight leading-none">Chronicle AI</h1>
            <span className="text-[8px] text-brand-slate font-medium uppercase tracking-wider block mt-0.5">OS</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-brand-slate font-medium">Workspace</span>
          <span className="text-xs text-brand-slate">/</span>
          <span className="text-sm font-semibold text-foreground">{getBreadcrumb()}</span>
        </div>
      </div>

      {/* Action / Productivity widgets */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Real-time Browser Offline status badge */}
        {isBrowserOffline && (
          <div 
            className="flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-100 rounded-full text-red-700 select-none animate-pulse"
            title="Your browser is currently offline. Changes will save locally and sync when you reconnect."
          >
            <WifiOff className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] font-extrabold tracking-tight hidden sm:inline">Offline</span>
          </div>
        )}

        {/* Daily Streak */}
        <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-amber-50 border border-amber-100 rounded-full text-amber-700 select-none">
          <Flame className="w-3.5 h-3.5 fill-amber-500 stroke-none" />
          <span className="text-[10px] md:text-xs font-bold tracking-tight">
            {activeStreak}
            <span className="hidden sm:inline"> Day Streak</span>
            <span className="sm:hidden">d</span>
          </span>
        </div>

        {/* Productivity Efficiency */}
        <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-700 select-none">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] md:text-xs font-bold tracking-tight">
            {efficiencyScore}%
            <span className="hidden sm:inline"> Efficiency</span>
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-[1px] bg-theme-divider" />

        {/* User Account / Sign In trigger */}
        {user ? (
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-100 border border-theme-divider flex items-center justify-center text-brand-slate-dark relative select-none">
                <User className="w-3.5 h-3.5 md:w-4 md:h-4" />
                {(isOffline || isBrowserOffline) && (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white absolute -bottom-0.5 -right-0.5" title="Local sandbox profile active" />
                )}
              </div>
              <div className="text-left hidden md:block select-none">
                <div className="text-xs font-semibold text-foreground leading-none">{displayName}</div>
                <div className="text-[9px] text-brand-slate mt-0.5">
                  {isOffline ? 'Offline Sandbox' : 'Synced Cloud Account'}
                </div>
              </div>
            </div>
            
            {/* Sign Out Button */}
            <button
              onClick={() => signOut()}
              title="Log out session"
              className="p-1 md:p-1.5 text-brand-slate hover:text-red-600 hover:bg-red-50 rounded-lg transition-premium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="text-[10px] md:text-xs font-bold bg-brand-indigo hover:bg-brand-indigo-dark text-white px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl shadow-md shadow-brand-indigo/10 transition-premium flex items-center gap-1 cursor-pointer"
            title="Connect Database"
          >
            <ShieldAlert className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Connect Database</span>
          </button>
        )}
      </div>
    </header>
  );
};

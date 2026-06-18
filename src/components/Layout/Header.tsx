import React from 'react';
import { Flame, CheckCircle, User, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  activeTab: string;
  efficiencyScore: number;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, efficiencyScore, onOpenAuthModal }) => {
  const { user, profile, signOut, isOffline } = useAuth();

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
    <header className="h-16 border-b border-theme-divider bg-white px-8 flex items-center justify-between sticky top-0 z-40 print:hidden">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2 select-none">
        <span className="text-xs text-brand-slate font-medium">Workspace</span>
        <span className="text-xs text-brand-slate">/</span>
        <span className="text-sm font-semibold text-foreground">{getBreadcrumb()}</span>
      </div>

      {/* Action / Productivity widgets */}
      <div className="flex items-center gap-6">
        {/* Daily Streak */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-amber-700 select-none">
          <Flame className="w-4 h-4 fill-amber-500 stroke-none" />
          <span className="text-xs font-bold tracking-tight">{activeStreak} Day Streak</span>
        </div>

        {/* Productivity Efficiency */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-700 select-none">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold tracking-tight">{efficiencyScore}% Efficiency</span>
        </div>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-theme-divider" />

        {/* User Account / Sign In trigger */}
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-theme-divider flex items-center justify-center text-brand-slate-dark relative select-none">
                <User className="w-4 h-4" />
                {isOffline && (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white absolute -bottom-0.5 -right-0.5" title="Mock sandbox profile active" />
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
              className="p-1.5 text-brand-slate hover:text-red-600 hover:bg-red-50 rounded-lg transition-premium cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="text-xs font-bold bg-brand-indigo hover:bg-brand-indigo-dark text-white px-4 py-2 rounded-xl shadow-md shadow-brand-indigo/10 transition-premium flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" /> Connect Database
          </button>
        )}
      </div>
    </header>
  );
};

import React from 'react';
import { LayoutDashboard, CalendarRange, Sparkles, Settings, Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { profile } = useAuth();
  
  const xpPoints = profile?.xp_points ?? 120;
  const userLevel = Math.floor(xpPoints / 100) + 1;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'Block Planner', icon: CalendarRange },
    { id: 'ai-summary', label: 'AI Summary', icon: Sparkles },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-white border-r border-theme-divider flex-col h-screen sticky top-0 print:hidden">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-theme-border">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Chronicle AI Logo" 
            className="w-8 h-8 rounded-lg object-contain shadow-xs"
          />
          <div>
            <h1 className="font-semibold text-foreground tracking-tight leading-none">Chronicle AI</h1>
            <span className="text-[10px] text-brand-slate font-medium uppercase tracking-wider block mt-0.5">Productivity OS</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-premium ${
                isActive
                  ? 'bg-brand-indigo/5 text-brand-indigo font-semibold shadow-sm'
                  : 'text-brand-slate hover:bg-slate-50 hover:text-foreground'
              }`}
            >
              <Icon className={`w-4 h-4 transition-premium ${isActive ? 'text-brand-indigo' : 'text-brand-slate group-hover:text-foreground'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Gamification Dashboard Footer Widget */}
      <div className="p-4 border-t border-theme-border bg-slate-50/50 m-4 rounded-xl border select-none">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-7 h-7 rounded-full bg-brand-emerald/10 flex items-center justify-center text-brand-emerald">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-brand-slate font-semibold uppercase tracking-wider">Level {userLevel}</div>
            <div className="text-xs text-foreground font-bold">{xpPoints} XP Total</div>
          </div>
        </div>
        
        {/* Progress bar to next level */}
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-brand-emerald h-1.5 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${(xpPoints % 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1 text-[10px] text-brand-slate font-medium">
          <span>{xpPoints % 100}/100 XP</span>
          <span>Next Level</span>
        </div>
      </div>
    </aside>
  );
};

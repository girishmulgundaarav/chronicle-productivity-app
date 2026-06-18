import React from 'react';
import { LayoutDashboard, CalendarRange, Sparkles, Settings } from 'lucide-react';

interface BottomNavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'Planner', icon: CalendarRange },
    { id: 'ai-summary', label: 'AI Summary', icon: Sparkles },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t border-theme-divider flex justify-around items-center px-2 z-50 md:hidden shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center relative group"
          >
            {/* Active Highlight Dot Indicator */}
            <span
              className={`absolute top-0 w-8 h-1 rounded-b-full bg-brand-indigo transition-all duration-300 transform origin-top ${
                isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
              }`}
            />
            
            <div
              className={`p-1 rounded-xl transition-all duration-300 flex items-center justify-center ${
                isActive 
                  ? 'text-brand-indigo scale-110 bg-brand-indigo/5' 
                  : 'text-brand-slate hover:text-foreground group-active:scale-95'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            
            <span
              className={`text-[9px] font-bold mt-1 tracking-tight transition-all duration-300 ${
                isActive 
                  ? 'text-brand-indigo font-extrabold' 
                  : 'text-brand-slate'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

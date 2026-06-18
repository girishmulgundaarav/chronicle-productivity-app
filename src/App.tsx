import { useState } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { DashboardView } from './components/Dashboard/DashboardView';
import { PlannerView } from './components/Planner/PlannerView';
import { AISummaryView } from './components/AI/AISummaryView';
import { SettingsView } from './components/Settings/SettingsView';
import { AuthModal } from './components/Auth/AuthModal';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  
  // Shared date context (Format: YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'planner':
        return <PlannerView selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
      case 'ai-summary':
        return <AISummaryView selectedDate={selectedDate} />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex bg-theme-bg min-h-screen text-foreground selection:bg-brand-indigo/10">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Main workspace container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Header 
          activeTab={activeTab} 
          efficiencyScore={84} // Default baseline efficiency
          onOpenAuthModal={() => setAuthModalOpen(true)}
        />

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-8 max-w-7xl w-full mx-auto print:p-0 print:max-w-none">
          {renderContent()}
        </main>
      </div>

      {/* Authentication Dialog overlay */}
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
      />
    </div>
  );
}

export default App;

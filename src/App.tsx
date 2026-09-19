import React, { useState } from 'react';
import { Sidebar, AppView } from './components/Sidebar';
import { StudentKiosk } from './components/StudentKiosk';
import { HoursLeaderboard } from './components/HoursLeaderboard';
import { AdminDashboard } from './components/AdminDashboard';
import { HoursEditor } from './components/HoursEditor';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { Github } from 'lucide-react';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('signin');
  const [pendingAdminView, setPendingAdminView] = useState<AppView | null>(null);

  // Handle navigation requests from Sidebar
  const handleViewChange = (view: AppView): void => {
    if (view === 'signin' || view === 'leaderboard') {
      // Both Student Attendance and Top 5 Leaderboard are public for everyone
      setCurrentView(view);
      setPendingAdminView(null);
    } else {
      // Require admin password every time an admin tab (reports or hours) is accessed
      setPendingAdminView(view);
    }
  };

  const handleAdminSuccess = (): void => {
    if (pendingAdminView) {
      setCurrentView(pendingAdminView);
      setPendingAdminView(null);
    }
  };

  const handleAdminCancel = (): void => {
    setPendingAdminView(null);
  };

  return (
    <div className="h-screen w-screen bg-[#121215] text-zinc-100 flex font-sans select-none overflow-hidden">
      {/* 
        PERSISTENT SIDEBAR:
        Mounted on the left side and remains visible across all views and tabs.
      */}
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <main className="flex-1 flex flex-col justify-start overflow-y-auto">
          {currentView === 'signin' ? (
            <StudentKiosk />
          ) : currentView === 'leaderboard' ? (
            <HoursLeaderboard
              onExit={() => setCurrentView('signin')}
              onGoToEditor={() => setCurrentView('hours')}
            />
          ) : currentView === 'reports' ? (
            <AdminDashboard />
          ) : (
            <HoursEditor
              onExit={() => setCurrentView('signin')}
              onGoToLeaderboard={() => setCurrentView('leaderboard')}
            />
          )}
        </main>

        {/* Persistent Bottom Credits Bar */}
        <footer className="h-10 border-t border-[#27272a] bg-[#121215] px-6 flex items-center justify-between text-[11px] font-mono text-zinc-400 flex-shrink-0 z-30">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-200">Shaker Robotics</span>
            <span className="text-zinc-600">•</span>
            <span className="text-cyan-400 font-bold">Team 2791</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-zinc-500 hidden sm:inline">FRC Attendance System</span>
            <a
              href="https://codeberg.org/tendulkar/attendance"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-500 hover:text-white transition-colors"
              title="View on Codeberg"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </footer>
      </div>

      {/* Admin Password Modal - appears whenever an admin tab is clicked */}
      {pendingAdminView && (
        <AdminPasswordModal
          targetTabName={
            pendingAdminView === 'reports' ? 'Activity & Reports' : 'Edit Hours'
          }
          onSuccess={handleAdminSuccess}
          onCancel={handleAdminCancel}
        />
      )}
    </div>
  );
};

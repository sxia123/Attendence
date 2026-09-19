import React, { useState } from 'react';
import { Sidebar, AppView } from './components/Sidebar';
import { StudentKiosk } from './components/StudentKiosk';
import { AdminDashboard } from './components/AdminDashboard';
import { HoursEditor } from './components/HoursEditor';
import { AuthScreen } from './components/AuthScreen';
import { Heart, Github } from 'lucide-react';

export const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<AppView>('kiosk');
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Handle student login from AuthScreen
  const handleStudentAuth = (studentId: string): void => {
    setShowAuthScreen(false);
    setCurrentView('kiosk');
    // Trigger punch directly via API
    void fetch('/api/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: studentId }),
    });
  };

  // Handle admin login from AuthScreen
  const handleAdminAuth = async (passcode: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/developer/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: passcode }),
      });

      if (res.ok) {
        setIsAdmin(true);
        setShowAuthScreen(false);
        setCurrentView('dashboard');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Handle navigation requests
  const handleViewChange = (view: AppView): void => {
    if ((view === 'dashboard' || view === 'editor') && !isAdmin) {
      setShowAuthScreen(true);
      return;
    }
    setCurrentView(view);
  };

  // Handle logout
  const handleLogout = (): void => {
    setIsAdmin(false);
    setShowAuthScreen(true);
  };

  return (
    <div className="h-screen w-screen bg-[#121215] text-zinc-100 flex flex-col font-sans select-none overflow-hidden">
      {/* If AuthScreen is active */}
      {showAuthScreen ? (
        <AuthScreen
          onStudentAuth={handleStudentAuth}
          onAdminAuth={handleAdminAuth}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Slim Left Navigation Sidebar (Matching sc-attendance.png & sc-dashboard.png) */}
          <Sidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onLogout={handleLogout}
            isAdmin={isAdmin}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <main className="flex-1 flex flex-col justify-start">
              {currentView === 'kiosk' && (
                <StudentKiosk sessionTitle="Build Season" />
              )}
              {currentView === 'dashboard' && (
                <AdminDashboard />
              )}
              {currentView === 'editor' && (
                <HoursEditor onExit={() => setCurrentView('kiosk')} />
              )}
            </main>

            {/* Bottom Credits Bar (Matching screenshots) */}
            <footer className="h-10 border-t border-[#27272a] bg-[#121215] px-6 flex items-center justify-between text-[11px] font-mono text-zinc-500 flex-shrink-0 z-30">
              <div className="flex items-center gap-1.5">
                <span>Made with</span>
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
                <span>by</span>
                <span className="text-zinc-300 underline underline-offset-4 decoration-zinc-600">
                  Angad
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-zinc-600 hidden sm:inline">FRC Attendance System</span>
                <a
                  href="https://codeberg.org/tendulkar/attendance"
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono">
          <div className="w-full max-w-md bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <h3 className="text-base font-bold text-white">System Settings</h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-zinc-400 block mb-1">Session Mode</span>
                <div className="p-3 bg-[#121214] border border-[#27272a] rounded-xl text-white font-semibold">
                  Build Season (Active)
                </div>
              </div>

              <div>
                <span className="text-zinc-400 block mb-1">Database Provider</span>
                <div className="p-3 bg-[#121214] border border-[#27272a] rounded-xl text-zinc-300">
                  SQLite Local / Turso LibSQL (attendance.db)
                </div>
              </div>

              <div>
                <span className="text-zinc-400 block mb-1">Admin Passcode</span>
                <div className="p-3 bg-[#121214] border border-[#27272a] rounded-xl text-zinc-300">
                  Configured via LEAD_PIN (Default: 9999)
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-2.5 bg-white text-zinc-950 font-bold rounded-xl text-xs hover:bg-zinc-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

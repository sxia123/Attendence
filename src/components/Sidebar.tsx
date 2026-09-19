import React from 'react';
import { LayoutGrid, Clock, FileEdit, Settings, LogOut, Radio } from 'lucide-react';

export type AppView = 'kiosk' | 'dashboard' | 'editor';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onOpenSettings?: () => void;
  onLogout: () => void;
  isAdmin: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  onOpenSettings,
  onLogout,
  isAdmin,
}) => {
  return (
    <aside className="w-16 bg-[#121215] border-r border-[#27272a] flex flex-col items-center justify-between py-4 select-none flex-shrink-0 z-40">
      {/* Top Logo Badge */}
      <div className="flex flex-col items-center gap-6">
        <div
          onClick={() => onViewChange('kiosk')}
          className="w-10 h-10 rounded-full border-2 border-cyan-500 bg-cyan-950/40 text-cyan-400 flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.35)] hover:scale-105 transition-all"
          title="Attendance System"
        >
          <Radio className="w-5 h-5" />
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col items-center gap-3">
          {/* 1. Kiosk View (Clock) */}
          <button
            type="button"
            onClick={() => onViewChange('kiosk')}
            title="Attendance Kiosk"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              currentView === 'kiosk'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
            }`}
          >
            <Clock className="w-5 h-5" />
          </button>

          {/* 2. Admin Dashboard (LayoutGrid) */}
          <button
            type="button"
            onClick={() => onViewChange('dashboard')}
            title={isAdmin ? 'Telemetry & Dashboard' : 'Admin Dashboard (Passcode required)'}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              currentView === 'dashboard'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          {/* 3. Hours Editor (FileEdit) */}
          <button
            type="button"
            onClick={() => onViewChange('editor')}
            title={isAdmin ? 'Hours Spreadsheet' : 'Hours Editor (Passcode required)'}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              currentView === 'editor'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
            }`}
          >
            <FileEdit className="w-5 h-5" />
          </button>
        </nav>
      </div>

      {/* Bottom Icons */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings"
          className="w-10 h-10 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 flex items-center justify-center transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onLogout}
          title="Exit / Lock"
          className="w-10 h-10 rounded-lg border border-rose-950 bg-rose-950/20 text-rose-400 hover:bg-rose-900/40 hover:text-rose-300 flex items-center justify-center transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};

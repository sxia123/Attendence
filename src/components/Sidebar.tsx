import React from 'react';
import { LayoutGrid, Clock, FileEdit, Radio, Trophy } from 'lucide-react';

export type AppView = 'signin' | 'leaderboard' | 'reports' | 'hours';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  return (
    <aside className="w-16 bg-[#121215] border-r border-[#27272a] flex flex-col items-center py-5 select-none flex-shrink-0 z-40">
      {/* Top Logo Badge */}
      <div
        onClick={() => onViewChange('signin')}
        className="w-10 h-10 rounded-full border-2 border-cyan-500 bg-cyan-950/40 text-cyan-400 flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.35)] hover:scale-105 transition-all mb-8"
        title="Student Attendance (Home)"
      >
        <Radio className="w-5 h-5" />
      </div>

      {/* Main Navigation Items */}
      <nav className="flex flex-col items-center gap-3.5">
        {/* 1. Student Sign In (Clock) */}
        <button
          type="button"
          onClick={() => onViewChange('signin')}
          title="Student Attendance"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            currentView === 'signin'
              ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
          }`}
        >
          <Clock className="w-5 h-5" />
        </button>

        {/* 2. Top 5 Leaderboard (Trophy - Public) */}
        <button
          type="button"
          onClick={() => onViewChange('leaderboard')}
          title="Top 5 Leaderboard"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            currentView === 'leaderboard'
              ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
          }`}
        >
          <Trophy className="w-5 h-5 text-amber-400" />
        </button>

        {/* 3. Activity & Reports (LayoutGrid) */}
        <button
          type="button"
          onClick={() => onViewChange('reports')}
          title="Activity & Reports (Admin password required)"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            currentView === 'reports'
              ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
        </button>

        {/* 4. Edit Hours (FileEdit) */}
        <button
          type="button"
          onClick={() => onViewChange('hours')}
          title="Edit Hours (Admin password required)"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            currentView === 'hours'
              ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
          }`}
        >
          <FileEdit className="w-5 h-5" />
        </button>
      </nav>
    </aside>
  );
};

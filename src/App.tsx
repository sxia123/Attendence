import React, { useState, useEffect, useCallback } from 'react';
import { LeadLockBar } from './components/LeadLockBar';
import { InstantPunchKiosk } from './components/InstantPunchKiosk';
import { TimesheetDatabase } from './components/TimesheetDatabase';
import { RosterDirectoryModal } from './components/RosterDirectoryModal';
import { Member, AttendanceEntry } from './types/attendance';
import { Clock, Database, Users } from 'lucide-react';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'kiosk' | 'database'>('kiosk');
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRosterOpen, setIsRosterOpen] = useState<boolean>(false);

  // Fetch terminal lock status
  const fetchLockStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/terminal/status');
      if (res.ok) {
        const data = await res.json() as { isLocked: boolean };
        setIsLocked(data.isLocked);
      }
    } catch (error) {
      void error;
    }
  }, []);

  // Fetch members
  const fetchMembers = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json() as Member[];
        setMembers(data);
      }
    } catch (error) {
      void error;
    }
  }, []);

  // Fetch attendance entries
  const fetchEntries = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/entries');
      if (res.ok) {
        const data = await res.json() as AttendanceEntry[];
        setEntries(data);
      }
    } catch (error) {
      void error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLockStatus();
    void fetchMembers();
    void fetchEntries();
  }, [fetchLockStatus, fetchMembers, fetchEntries]);

  const handleLockToggle = async (): Promise<void> => {
    try {
      const res = await fetch('/api/terminal/lock', { method: 'POST' });
      if (res.ok) {
        setIsLocked(true);
      }
    } catch (error) {
      void error;
    }
  };

  const handleUnlockSuccess = (): void => {
    setIsLocked(false);
  };

  const handlePunchSuccess = (): void => {
    void fetchMembers();
    void fetchEntries();
  };

  return (
    <div className="min-h-screen bg-white text-notion-text flex flex-col selection:bg-[#E8DEEE]">
      {/* Top Header & Lead Lock Bar */}
      <LeadLockBar
        isLocked={isLocked}
        onLockToggle={handleLockToggle}
        onUnlockSuccess={handleUnlockSuccess}
      />

      {/* Main Notion Page Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col space-y-6">
        {/* Navigation Bar between Sign In Kiosk and Database */}
        <div className="flex items-center justify-between border-b border-notion-border pb-3">
          <div className="flex items-center space-x-1 bg-notion-surface/60 p-1 border border-notion-border rounded-md">
            <button
              type="button"
              onClick={() => setCurrentPage('kiosk')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-all ${
                currentPage === 'kiosk'
                  ? 'bg-white text-notion-text font-semibold shadow-sm'
                  : 'text-notion-muted hover:text-notion-text'
              }`}
            >
              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Punch Kiosk</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage('database')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-all ${
                currentPage === 'database'
                  ? 'bg-white text-notion-text font-semibold shadow-sm'
                  : 'text-notion-muted hover:text-notion-text'
              }`}
            >
              <Database className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Database & Reports</span>
              <span className="font-mono text-[10px] text-notion-muted">({entries.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsRosterOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-notion-text border border-notion-border rounded hover:bg-notion-surface hover:border-notion-borderDark transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-notion-muted" strokeWidth={1.5} />
            <span>Team Roster ({members.length})</span>
          </button>
        </div>

        {/* PAGE 1: SIGN IN KIOSK */}
        {currentPage === 'kiosk' && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded border border-notion-border bg-notion-surface flex items-center justify-center text-notion-text mx-auto">
                <Clock className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-notion-text font-sans">
                Attendance Kiosk
              </h1>
              <p className="text-xs text-notion-muted leading-relaxed">
                Enter your 5-digit ID to instantly clock in or clock out. Only authorized Leads can unlock the terminal.
              </p>
            </div>

            <InstantPunchKiosk
              isLocked={isLocked}
              onPunchSuccess={handlePunchSuccess}
            />
          </div>
        )}

        {/* PAGE 2: DATABASE & REPORTS */}
        {currentPage === 'database' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-notion-text font-sans flex items-center gap-2">
                  <Database className="w-5 h-5 text-notion-muted" strokeWidth={1.5} />
                  Attendance Database
                </h1>
                <p className="text-xs text-notion-muted mt-0.5">
                  View individual punch records or aggregated total hours by person. Click any header to sort.
                </p>
              </div>
              <div className="text-[11px] text-notion-muted font-mono bg-notion-surface px-2 py-1 rounded border border-notion-border">
                Storage: SQLite / Turso
              </div>
            </div>

            <TimesheetDatabase
              entries={entries}
              members={members}
              isLoading={isLoading}
              onRefresh={() => {
                void fetchEntries();
                void fetchMembers();
              }}
            />
          </div>
        )}
      </div>

      {/* Team Roster Directory Modal */}
      <RosterDirectoryModal
        isOpen={isRosterOpen}
        onClose={() => setIsRosterOpen(false)}
        members={members}
        isLocked={isLocked}
        onMemberAdded={() => {
          void fetchMembers();
        }}
      />
    </div>
  );
};

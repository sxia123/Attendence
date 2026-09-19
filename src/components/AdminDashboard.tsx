import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student, AttendanceEntry, PunchResponse } from '../types/attendance';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
} from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: string;
  timestamp: string;
  studentName?: string;
  studentId?: string;
}

export const AdminDashboard: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [sessionCategory, setSessionCategory] = useState<'regular' | 'event'>('regular');
  const [filterType, setFilterType] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch Students
  const fetchStudents = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/developer/students');
      if (res.ok) {
        const data = (await res.json()) as Student[];
        setStudents(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Attendance Entries
  const fetchEntries = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/developer/entries');
      if (res.ok) {
        const data = (await res.json()) as AttendanceEntry[];
        setEntries(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
    void fetchEntries();
  }, [fetchStudents, fetchEntries]);

  // Construct activity events from entries
  const activityEvents = useMemo<ActivityEvent[]>(() => {
    const list: ActivityEvent[] = [];

    entries.forEach((e) => {
      // Clock in event
      list.push({
        id: `${e.id}-in`,
        type: 'Student Signed In',
        timestamp: e.timeIn,
        studentName: e.studentName,
        studentId: e.studentId,
      });

      // Clock out event if completed
      if (e.status === 'completed' && e.timeOut) {
        list.push({
          id: `${e.id}-out`,
          type: 'Student Signed Out',
          timestamp: e.timeOut,
          studentName: e.studentName,
          studentId: e.studentId,
        });
      }

      if (e.note && e.note.includes('adjustment')) {
        list.push({
          id: `${e.id}-adj`,
          type: 'Hours Adjusted',
          timestamp: e.timeIn,
          studentName: e.studentName,
          studentId: e.studentId,
        });
      }
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries]);

  // Quick Sign In / Sign Out from Dashboard
  const handleQuickAction = async (targetId: string, actionType: 'in' | 'out'): Promise<void> => {
    if (!targetId) return;

    try {
      const student = students.find((s) => s.id === targetId);
      if (!student) return;

      if (actionType === 'in' && student.isClockedIn) {
        setActionSuccess(`${student.name} is already signed in.`);
        return;
      }
      if (actionType === 'out' && !student.isClockedIn) {
        setActionSuccess(`${student.name} is already signed out.`);
        return;
      }

      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId }),
      });

      if (res.ok) {
        const data = (await res.json()) as PunchResponse;
        setActionSuccess(
          data.action === 'clock_in'
            ? `Signed in ${data.student.name}`
            : `Signed out ${data.student.name} (${data.durationFormatted})`
        );
        void fetchStudents();
        void fetchEntries();
      }
    } catch {
      // ignore
    }
  };

  // Filtered activity
  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return activityEvents;
    return activityEvents.filter((ev) => ev.type.toLowerCase().includes(filterType.toLowerCase()));
  }, [activityEvents, filterType]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  // Present vs Absent calculation
  const presentCount = students.filter((s) => s.isClockedIn).length;
  const absentCount = Math.max(0, students.length - presentCount);
  const presentPercentage = students.length > 0 ? (presentCount / students.length) * 100 : 0;

  const filterButtons = [
    { label: 'All Activity', key: 'all' },
    { label: 'Signed In', key: 'signed in' },
    { label: 'Signed Out', key: 'signed out' },
    { label: 'Hours Adjusted', key: 'adjusted' },
  ];

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full select-none text-zinc-100">
      {/* Action Notification */}
      {actionSuccess && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-mono text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left 2/3 (Filters & Activity Log), Right 1/3 (Quick Actions & Stats) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ======================================================== */}
        {/* LEFT COLUMN: ACTIVITY FILTERS & HISTORY TABLE */}
        {/* ======================================================== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Activity Filter Buttons Grid */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">
              Filter Activity
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              {filterButtons.map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => {
                    setFilterType(btn.key);
                    setCurrentPage(1);
                  }}
                  className={`py-2 px-3 rounded-lg text-center font-medium transition-all ${
                    filterType === btn.key
                      ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                      : 'bg-[#121214] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-[#27272a]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card 2: Activity Event Log Table */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-xl overflow-hidden flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#27272a] text-zinc-500 font-medium">
                    <th className="py-3 px-5">Activity</th>
                    <th className="py-3 px-5">Date &amp; Time</th>
                    <th className="py-3 px-5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {paginatedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-zinc-500">
                        No activity recorded yet.
                      </td>
                    </tr>
                  ) : (
                    paginatedEvents.map((event) => {
                      const formatTime = (iso: string): string => {
                        try {
                          const d = new Date(iso);
                          return d.toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                        } catch {
                          return iso;
                        }
                      };

                      return (
                        <tr key={event.id} className="hover:bg-zinc-850/50 transition-colors">
                          <td className="py-3.5 px-5 font-semibold text-zinc-200">
                            {event.type}
                            {event.studentName && (
                              <span className="text-zinc-500 font-normal ml-2">
                                ({event.studentName})
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-zinc-400">
                            {formatTime(event.timestamp)}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="text-zinc-500 text-[11px]">
                              {event.studentId ? `ID: ${event.studentId}` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="p-4 border-t border-[#27272a] flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <span>Page Size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#121214] border border-[#27272a] rounded px-2 py-1 text-white focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div>
                <span>
                  {filteredEvents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                  {Math.min(currentPage * pageSize, filteredEvents.length)} of {filteredEvents.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: QUICK ACTIONS, STATS & DAILY ATTENDANCE */}
        {/* ======================================================== */}
        <div className="space-y-6">
          {/* Card 1: Quick Sign In / Out */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl space-y-4">
            <div className="bg-[#121214] p-1 rounded-xl border border-[#27272a] grid grid-cols-2 gap-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setSessionCategory('regular')}
                className={`py-2 rounded-lg font-medium transition-all ${
                  sessionCategory === 'regular' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400'
                }`}
              >
                Regular Meeting
              </button>
              <button
                type="button"
                onClick={() => setSessionCategory('event')}
                className={`py-2 rounded-lg font-medium transition-all ${
                  sessionCategory === 'event' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400'
                }`}
              >
                Special Event
              </button>
            </div>

            {/* Choose a student dropdown */}
            <div>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-4 py-3 bg-[#121214] border border-[#27272a] rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Choose a student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id}) - {s.isClockedIn ? '🟢 Signed In' : '⚪ Signed Out'}
                  </option>
                ))}
              </select>
            </div>

            {/* Sign In & Sign Out buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickAction(selectedStudentId, 'in')}
                disabled={!selectedStudentId}
                className="w-full py-2.5 rounded-xl bg-[#064e3b]/70 hover:bg-[#064e3b] text-emerald-300 font-mono text-xs font-semibold border border-emerald-800 transition-colors disabled:opacity-40"
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction(selectedStudentId, 'out')}
                disabled={!selectedStudentId}
                className="w-full py-2.5 rounded-xl bg-[#4c0519]/70 hover:bg-[#4c0519] text-rose-300 font-mono text-xs font-semibold border border-rose-900 transition-colors disabled:opacity-40"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Card 2: Present vs Absent Visual Ratio */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl">
            <div className="grid grid-cols-2 text-center font-mono">
              <div className="border-r border-[#27272a] pr-4">
                <div className="text-xs text-zinc-400">Present Today</div>
                <div className="text-3xl font-bold text-white mt-1">{presentCount}</div>
              </div>
              <div className="pl-4">
                <div className="text-xs text-zinc-400">Absent</div>
                <div className="text-3xl font-bold text-white mt-1">{absentCount}</div>
              </div>
            </div>

            {/* Split Progress Bar */}
            <div className="w-full h-3 bg-rose-950 rounded-full mt-6 overflow-hidden flex border border-[#27272a]">
              <div
                style={{ width: `${presentPercentage}%` }}
                className="bg-emerald-600 h-full transition-all duration-500"
              />
            </div>
          </div>

          {/* Card 3: Daily Attendance Chart */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl">
            <h3 className="text-xs font-mono text-zinc-300 uppercase tracking-wider mb-4">
              Daily Attendance
            </h3>

            <div className="w-full h-36 relative">
              <svg viewBox="0 0 300 120" className="w-full h-full overflow-visible">
                <line x1="30" y1="20" x2="290" y2="20" stroke="#27272a" strokeWidth="1" />
                <line x1="30" y1="50" x2="290" y2="50" stroke="#27272a" strokeWidth="1" />
                <line x1="30" y1="80" x2="290" y2="80" stroke="#27272a" strokeWidth="1" />
                <line x1="30" y1="105" x2="290" y2="105" stroke="#3f3f46" strokeWidth="1" />

                <text x="5" y="24" fill="#71717a" fontSize="8" fontFamily="monospace">40</text>
                <text x="5" y="54" fill="#71717a" fontSize="8" fontFamily="monospace">20</text>
                <text x="5" y="84" fill="#71717a" fontSize="8" fontFamily="monospace">10</text>
                <text x="12" y="108" fill="#71717a" fontSize="8" fontFamily="monospace">0</text>

                <polyline
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="45,105 105,105 165,105 225,105 285,30"
                />

                <circle cx="45" cy="105" r="3.5" fill="#ffffff" />
                <circle cx="105" cy="105" r="3.5" fill="#ffffff" />
                <circle cx="165" cy="105" r="3.5" fill="#ffffff" />
                <circle cx="225" cy="105" r="3.5" fill="#ffffff" />
                <circle cx="285" cy="30" r="4.5" fill="#ffffff" stroke="#121215" strokeWidth="2" />
              </svg>

              <div className="flex justify-between pl-8 pr-2 text-[9px] font-mono text-zinc-500 mt-1">
                <span>4 Days Ago</span>
                <span>3 Days Ago</span>
                <span>2 Days Ago</span>
                <span>Yesterday</span>
                <span className="text-white font-semibold">Today</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

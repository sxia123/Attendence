import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student, AttendanceEntry, PunchResponse } from '../types/attendance';
import {
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface TelemetryEvent {
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
  const [hourType, setHourType] = useState<'build' | 'outreach'>('build');
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

  // Construct telemetry events from entries
  const telemetryEvents = useMemo<TelemetryEvent[]>(() => {
    const list: TelemetryEvent[] = [];

    entries.forEach((e) => {
      // Clock in event
      list.push({
        id: `${e.id}-in`,
        type: 'Student Login',
        timestamp: e.timeIn,
        studentName: e.studentName,
        studentId: e.studentId,
      });

      // Clock out event if completed
      if (e.status === 'completed' && e.timeOut) {
        list.push({
          id: `${e.id}-out`,
          type: 'Student Logout',
          timestamp: e.timeOut,
          studentName: e.studentName,
          studentId: e.studentId,
        });
      }

      if (e.note && e.note.includes('adjustment')) {
        list.push({
          id: `${e.id}-adj`,
          type: 'Record Edited',
          timestamp: e.timeIn,
          studentName: e.studentName,
          studentId: e.studentId,
        });
      }
    });

    // Sort by timestamp desc
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries]);

  // Quick Sign In / Sign Out from Dashboard
  const handleQuickAction = async (targetId: string, actionType: 'in' | 'out'): Promise<void> => {
    if (!targetId) return;

    try {
      const student = students.find((s) => s.id === targetId);
      if (!student) return;

      // Only trigger if action matches need
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

  // Filtered telemetry
  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return telemetryEvents;
    return telemetryEvents.filter((ev) => ev.type.toLowerCase().includes(filterType.toLowerCase()));
  }, [telemetryEvents, filterType]);

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
    { label: 'All Telemetry', key: 'all' },
    { label: 'New Invite', key: 'invite' },
    { label: 'Invite Used', key: 'invite_used' },
    { label: 'Student Login', key: 'login' },
    { label: 'Student Logout', key: 'logout' },
    { label: 'Admin Login', key: 'admin_login' },
    { label: 'Permissions', key: 'permissions' },
    { label: 'Admin Edited', key: 'admin_edited' },
    { label: 'Admin Removed', key: 'admin_removed' },
    { label: 'New Record', key: 'new_record' },
    { label: 'Record Edited', key: 'record_edited' },
    { label: 'Record Removed', key: 'record_removed' },
    { label: 'New Student', key: 'new_student' },
    { label: 'Student Edited', key: 'student_edited' },
    { label: 'Student Removed', key: 'student_removed' },
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

      {/* Main Grid: Left 2/3 (Telemetry & Logs), Right 1/3 (Actions, Stats, Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ======================================================== */}
        {/* LEFT COLUMN: TELEMETRY FILTERS & EVENT LOG TABLE */}
        {/* ======================================================== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Telemetry Filter Buttons Grid (Matching sc-dashboard.png) */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">
              Telemetry Filter
            </h2>

            <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
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

          {/* Card 2: Activity Event Log Table (Matching sc-dashboard.png) */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-xl overflow-hidden flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#27272a] text-zinc-500 font-medium">
                    <th className="py-3 px-5">Event Type</th>
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-5 text-right">Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {paginatedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-zinc-500">
                        No telemetry events recorded yet.
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
                            <button
                              type="button"
                              className="w-16 py-1 rounded bg-[#121214] border border-[#27272a] text-zinc-400 hover:text-white inline-flex items-center justify-center gap-1 hover:border-zinc-500 transition-colors"
                              title="View event payload"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Pagination matching screenshot */}
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
        {/* RIGHT COLUMN: QUICK ACTIONS, STATS & DAILY LOGINS CHART */}
        {/* ======================================================== */}
        <div className="space-y-6">
          {/* Card 1: Quick Sign In / Out (Matching sc-dashboard.png) */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl space-y-4">
            {/* Build vs Outreach toggle */}
            <div className="bg-[#121214] p-1 rounded-xl border border-[#27272a] grid grid-cols-2 gap-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setHourType('build')}
                className={`py-2 rounded-lg font-medium transition-all ${
                  hourType === 'build' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400'
                }`}
              >
                Build
              </button>
              <button
                type="button"
                onClick={() => setHourType('outreach')}
                className={`py-2 rounded-lg font-medium transition-all ${
                  hourType === 'outreach' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400'
                }`}
              >
                Outreach
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

          {/* Card 2: Present vs Absent Visual Ratio (Matching sc-dashboard.png) */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl">
            <div className="grid grid-cols-2 text-center font-mono">
              <div className="border-r border-[#27272a] pr-4">
                <div className="text-xs text-zinc-400">Present</div>
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

          {/* Card 3: Daily Logins Interactive Line Chart (Matching sc-dashboard.png) */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl">
            <h3 className="text-xs font-mono text-zinc-300 uppercase tracking-wider mb-4">
              Daily Logins
            </h3>

            {/* SVG Line Chart */}
            <div className="w-full h-36 relative">
              <svg viewBox="0 0 300 120" className="w-full h-full overflow-visible">
                {/* Horizontal Grid lines */}
                <line x1="30" y1="20" x2="290" y2="20" stroke="#27272a" strokeWidth="1" />
                <line x1="30" y1="50" x2="290" y2="50" stroke="#27272a" strokeWidth="1" />
                <line x1="30" y1="80" x2="290" y2="80" stroke="#27272a" strokeWidth="1" />
                <line x1="30" y1="105" x2="290" y2="105" stroke="#3f3f46" strokeWidth="1" />

                {/* Y-axis labels */}
                <text x="5" y="24" fill="#71717a" fontSize="8" fontFamily="monospace">40</text>
                <text x="5" y="54" fill="#71717a" fontSize="8" fontFamily="monospace">20</text>
                <text x="5" y="84" fill="#71717a" fontSize="8" fontFamily="monospace">10</text>
                <text x="12" y="108" fill="#71717a" fontSize="8" fontFamily="monospace">0</text>

                {/* The Activity Line */}
                <polyline
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="45,105 105,105 165,105 225,105 285,30"
                />

                {/* Data Points */}
                <circle cx="45" cy="105" r="3.5" fill="#ffffff" />
                <circle cx="105" cy="105" r="3.5" fill="#ffffff" />
                <circle cx="165" cy="105" r="3.5" fill="#ffffff" />
                <circle cx="225" cy="105" r="3.5" fill="#ffffff" />
                <circle cx="285" cy="30" r="4.5" fill="#ffffff" stroke="#121215" strokeWidth="2" />
              </svg>

              {/* X-axis labels */}
              <div className="flex justify-between pl-8 pr-2 text-[9px] font-mono text-zinc-500 mt-1">
                <span>Day -4</span>
                <span>Day -3</span>
                <span>Day -2</span>
                <span>Yesterday</span>
                <span className="text-white font-semibold">Today</span>
              </div>
            </div>
          </div>

          {/* Card 4: Quick Lookup Card */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl flex flex-col items-center justify-center min-h-[7rem] text-zinc-500 font-mono text-xs">
            <Eye className="w-6 h-6 text-zinc-600 mb-1" />
            <span>Select student above to view profile</span>
          </div>
        </div>
      </div>
    </div>
  );
};

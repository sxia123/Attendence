import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student, AttendanceEntry, PunchResponse } from '../types/attendance';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Users,
  Clock,
  CalendarCheck2,
  Sparkles,
  Search,
  LogIn,
  LogOut,
} from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'Signed In' | 'Signed Out' | 'Hours Adjusted';
  category: string;
  timestamp: string;
  studentName?: string;
  studentId?: string;
  durationFormatted?: string;
}

export const AdminDashboard: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [sessionCategory, setSessionCategory] = useState<'regular' | 'demo'>('regular');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
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
      const noteLower = (e.note || '').toLowerCase();
      const isDemo =
        noteLower.includes('demo') ||
        noteLower.includes('outreach') ||
        noteLower.includes('event');
      const catLabel = isDemo ? 'Demo' : e.note || 'Regular Meeting';

      // Clock in event
      list.push({
        id: `${e.id}-in`,
        type: 'Signed In',
        category: catLabel,
        timestamp: e.timeIn,
        studentName: e.studentName,
        studentId: e.studentId,
      });

      // Clock out event if completed
      if (e.status === 'completed' && e.timeOut) {
        const mins = e.durationMinutes || 0;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const durationFormatted = h > 0 ? `${h}h ${m}m` : `${m}m`;

        list.push({
          id: `${e.id}-out`,
          type: 'Signed Out',
          category: catLabel,
          timestamp: e.timeOut,
          studentName: e.studentName,
          studentId: e.studentId,
          durationFormatted,
        });
      }

      if (e.note && (noteLower.includes('adjust') || noteLower.includes('manual'))) {
        list.push({
          id: `${e.id}-adj`,
          type: 'Hours Adjusted',
          category: 'Adjustment',
          timestamp: e.timeIn,
          studentName: e.studentName,
          studentId: e.studentId,
          durationFormatted: `${((e.durationMinutes || 0) / 60).toFixed(1)} hrs`,
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
        body: JSON.stringify({
          id: targetId,
          category: sessionCategory === 'demo' ? 'Demo' : 'Build',
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as PunchResponse;
        setActionSuccess(
          data.action === 'clock_in'
            ? `Signed in ${data.student.name} (${sessionCategory === 'demo' ? 'Demo' : 'Regular Meeting'})`
            : `Signed out ${data.student.name} (${data.durationFormatted || 'recorded'})`
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
    return activityEvents.filter((ev) => {
      // Filter by type pill
      if (filterType === 'signed in' && ev.type !== 'Signed In') return false;
      if (filterType === 'signed out' && ev.type !== 'Signed Out') return false;
      if (filterType === 'adjusted' && ev.type !== 'Hours Adjusted') return false;
      if (filterType === 'demo' && !ev.category.toLowerCase().includes('demo')) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = ev.studentName?.toLowerCase().includes(q);
        const matchId = ev.studentId?.includes(q);
        if (!matchName && !matchId) return false;
      }

      return true;
    });
  }, [activityEvents, filterType, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  // Attendance metrics
  const currentlyPresentStudents = students.filter((s) => s.isClockedIn);
  const presentCount = currentlyPresentStudents.length;
  const absentCount = Math.max(0, students.length - presentCount);
  const presentPercentage = students.length > 0 ? (presentCount / students.length) * 100 : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySessionsCount = entries.filter((e) => e.date === todayStr).length;
  const totalTeamHours = (
    students.reduce((sum, s) => sum + (s.totalMinutes || 0), 0) / 60
  ).toFixed(1);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const filterButtons = [
    { label: 'All Activity', key: 'all' },
    { label: 'Signed In', key: 'signed in' },
    { label: 'Signed Out', key: 'signed out' },
    { label: 'Demos', key: 'demo' },
    { label: 'Hours Adjusted', key: 'adjusted' },
  ];

  const formatEventTime = (iso: string): string => {
    try {
      const d = new Date(iso);
      const isToday = d.toISOString().slice(0, 10) === todayStr;
      const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `Today, ${timePart}`;
      }
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
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full select-none text-zinc-100 font-mono space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-wide">
          Activity &amp; Reports
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Real-time workshop attendance tracking and team check-in history.
        </p>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Present in Shop */}
        <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
              Currently Present
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {presentCount} <span className="text-xs font-normal text-zinc-400">members</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* KPI 2: Total Registered Members */}
        <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
              Total Members
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {students.length} <span className="text-xs font-normal text-zinc-400">students</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Total Accumulated Hours */}
        <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
              Total Team Hours
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {totalTeamHours} <span className="text-xs font-normal text-zinc-400">hrs</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Today's Sessions */}
        <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
              Today's Sessions
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {todaySessionsCount} <span className="text-xs font-normal text-zinc-400">logs</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800 flex items-center justify-center text-purple-400">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-white px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left 2/3 (Activity Log), Right 1/3 (Manual Sign In / Out & Shop Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ======================================================== */}
        {/* LEFT COLUMN: ACTIVITY FILTERS & TABLE */}
        {/* ======================================================== */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-xl overflow-hidden flex flex-col justify-between">
            {/* Filter Header & Search Bar */}
            <div className="p-5 border-b border-[#27272a] bg-[#151518] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                  Activity History Log
                </h2>

                {/* Search Box */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by student..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#121214] border border-[#27272a] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-zinc-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {filterButtons.map((btn) => (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => {
                      setFilterType(btn.key);
                      setCurrentPage(1);
                    }}
                    className={`py-1.5 px-3 rounded-lg text-center font-medium transition-all ${
                      filterType === btn.key
                        ? 'bg-white text-zinc-950 font-bold shadow-sm'
                        : 'bg-[#121214] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-[#27272a]'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#27272a] text-zinc-500 font-medium bg-[#121214]">
                    <th className="py-3 px-5">Student</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5 text-right">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {paginatedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-zinc-500 font-sans">
                        No activity found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-zinc-850/40 transition-colors">
                        {/* Student Name & ID */}
                        <td className="py-3 px-5">
                          <div className="font-semibold text-white">
                            {event.studentName || 'Unknown Student'}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            ID: {event.studentId || '—'}
                          </div>
                        </td>

                        {/* Action Status Badge */}
                        <td className="py-3 px-5">
                          {event.type === 'Signed In' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/60 border border-emerald-800/80 text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Signed In
                            </span>
                          )}
                          {event.type === 'Signed Out' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-950/60 border border-rose-900/80 text-rose-300">
                              Signed Out {event.durationFormatted ? `(${event.durationFormatted})` : ''}
                            </span>
                          )}
                          {event.type === 'Hours Adjusted' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-950/60 border border-cyan-800/80 text-cyan-300">
                              Adjusted ({event.durationFormatted})
                            </span>
                          )}
                        </td>

                        {/* Session Category */}
                        <td className="py-3 px-5">
                          {event.category.toLowerCase().includes('demo') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/50 border border-amber-800/80 text-amber-300">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              Demo
                            </span>
                          ) : event.category.toLowerCase().includes('learning') ? (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-blue-950/40 border border-blue-800/60 text-blue-300">
                              Learning Day
                            </span>
                          ) : event.category.toLowerCase().includes('preseason') ? (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-purple-950/40 border border-purple-800/60 text-purple-300">
                              Preseason
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">
                              Regular Meeting
                            </span>
                          )}
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-5 text-right text-zinc-400">
                          {formatEventTime(event.timestamp)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="p-4 border-t border-[#27272a] bg-[#151518] flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
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
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                  title="Previous Page"
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
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: MANUAL SIGN IN / OUT & SHOP ATTENDANCE */}
        {/* ======================================================== */}
        <div className="space-y-6">
          {/* Card 1: Manual Sign In / Out */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-xs uppercase tracking-wider font-semibold text-white">
                Manual Sign In / Sign Out
              </h2>
              <p className="text-[11px] text-zinc-400 mt-1 font-sans">
                Sign a student in or out if they forgot their PIN.
              </p>
            </div>

            {/* Category Segmented Selector: Regular Meeting vs Demos */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400 block font-semibold">
                Session Type:
              </label>
              <div className="bg-[#121214] p-1 rounded-xl border border-[#27272a] grid grid-cols-2 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSessionCategory('regular')}
                  className={`py-2 rounded-lg font-medium transition-all ${
                    sessionCategory === 'regular'
                      ? 'bg-white text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Regular Meeting
                </button>
                <button
                  type="button"
                  onClick={() => setSessionCategory('demo')}
                  className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                    sessionCategory === 'demo'
                      ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Demos</span>
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 font-sans mt-1">
                {sessionCategory === 'demo'
                  ? '⭐ Demos will automatically credit towards Demo Hours in the Hours Editor.'
                  : '🔧 Regular meetings credit towards standard Build Hours.'}
              </p>
            </div>

            {/* Student Dropdown Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400 block font-semibold">
                Select Student:
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Choose a student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id}) — {s.isClockedIn ? '🟢 Signed In' : '⚪ Signed Out'}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Student Status & Contextual Action */}
            {selectedStudent && (
              <div className="p-3 rounded-xl bg-[#121214] border border-[#27272a] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Current Status:</span>
                  {selectedStudent.isClockedIn ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Currently Signed In
                    </span>
                  ) : (
                    <span className="text-zinc-500">Currently Signed Out</span>
                  )}
                </div>

                {selectedStudent.isClockedIn ? (
                  <button
                    type="button"
                    onClick={() => handleQuickAction(selectedStudent.id, 'out')}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out {selectedStudent.name}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleQuickAction(selectedStudent.id, 'in')}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>
                      Sign In to {sessionCategory === 'demo' ? 'Demo' : 'Regular Meeting'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Shop Attendance & Who Is Present */}
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs uppercase tracking-wider font-semibold text-white">
                  Shop Attendance
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5 font-sans">
                  {presentCount} present • {absentCount} signed out ({presentPercentage.toFixed(0)}%)
                </p>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold text-lg">{presentCount}</span>
                <span className="text-zinc-500 text-xs"> / {students.length}</span>
              </div>
            </div>

            {/* Split Progress Bar */}
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden flex border border-[#27272a]">
              <div
                style={{ width: `${presentPercentage}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
              />
            </div>

            {/* List of Who is Currently Present */}
            <div className="space-y-2 pt-2">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Members in Shop ({currentlyPresentStudents.length}):</span>
              </div>

              {currentlyPresentStudents.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a] text-center text-zinc-500 text-xs font-sans">
                  No members currently signed in.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {currentlyPresentStudents.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-[#121214] border border-[#27272a] flex items-center justify-between text-xs hover:border-zinc-700 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-white truncate">{s.name}</div>
                        <div className="text-[10px] text-zinc-500">ID: {s.id}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickAction(s.id, 'out')}
                        className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-semibold transition-colors flex-shrink-0"
                        title="Sign Out Student"
                      >
                        Sign Out
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student, AttendanceEntry, PunchResponse, HourCategory } from '../types/attendance';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wrench,
  BookOpen,
  Calendar,
  Activity,
  FileSpreadsheet,
  Download,
} from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'Signed In' | 'Signed Out' | 'Hours Adjusted';
  category: HourCategory;
  timestamp: string;
  studentName?: string;
  studentId?: string;
  durationFormatted?: string;
}

export const AdminDashboard: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [sessionCategory, setSessionCategory] = useState<HourCategory>('Build Season');

  // Active view inside the reports card: 'hoursByCategory' or 'activityLog'
  const [activeReportTab, setActiveReportTab] = useState<'hoursByCategory' | 'activityLog'>('hoursByCategory');

  // Activity Log filters & search
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [activitySearch, setActivitySearch] = useState<string>('');
  const [activityPageSize, setActivityPageSize] = useState<number>(15);
  const [activityCurrentPage, setActivityCurrentPage] = useState<number>(1);

  // Hours by Category table search, sort & pagination
  const [hoursSearch, setHoursSearch] = useState<string>('');
  type HoursSortKey = 'name' | 'id' | 'build' | 'learning' | 'preseason' | 'demo' | 'total';
  const [hoursSortKey, setHoursSortKey] = useState<HoursSortKey>('total');
  const [hoursSortOrder, setHoursSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hoursPageSize, setHoursPageSize] = useState<number>(15);
  const [hoursCurrentPage, setHoursCurrentPage] = useState<number>(1);

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

  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => {
        setActionSuccess(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  // Helper to categorize attendance entry note
  const getEntryCategory = useCallback((note?: string): HourCategory => {
    const text = (note || '').toLowerCase();
    if (text.includes('learning')) return 'Learning Days';
    if (text.includes('pre') || text.includes('offseason')) return 'Pre-Season';
    if (text.includes('demo') || text.includes('outreach') || text.includes('event')) return 'Demo';
    return 'Build Season';
  }, []);

  // Construct activity events from entries
  const activityEvents = useMemo<ActivityEvent[]>(() => {
    const list: ActivityEvent[] = [];

    entries.forEach((e) => {
      const cat = getEntryCategory(e.note);

      // Clock in event
      list.push({
        id: `${e.id}-in`,
        type: 'Signed In',
        category: cat,
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
          category: cat,
          timestamp: e.timeOut,
          studentName: e.studentName,
          studentId: e.studentId,
          durationFormatted,
        });
      }

      if (e.note && (e.note.toLowerCase().includes('adjust') || e.note.toLowerCase().includes('manual'))) {
        list.push({
          id: `${e.id}-adj`,
          type: 'Hours Adjusted',
          category: cat,
          timestamp: e.timeIn,
          studentName: e.studentName,
          studentId: e.studentId,
          durationFormatted: `${((e.durationMinutes || 0) / 60).toFixed(1)} hrs`,
        });
      }
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries, getEntryCategory]);

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
          category: sessionCategory,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as PunchResponse;
        setActionSuccess(
          data.action === 'clock_in'
            ? `Signed in ${data.student.name} (${sessionCategory})`
            : `Signed out ${data.student.name} (${data.durationFormatted || 'recorded'})`
        );
        void fetchStudents();
        void fetchEntries();
      }
    } catch {
      // ignore
    }
  };

  // Filtered Activity Events
  const filteredEvents = useMemo(() => {
    return activityEvents.filter((ev) => {
      // Filter by type or category
      if (activityFilter === 'signed in' && ev.type !== 'Signed In') return false;
      if (activityFilter === 'signed out' && ev.type !== 'Signed Out') return false;
      if (activityFilter === 'adjusted' && ev.type !== 'Hours Adjusted') return false;
      if (activityFilter === 'build' && ev.category !== 'Build Season') return false;
      if (activityFilter === 'learning' && ev.category !== 'Learning Days') return false;
      if (activityFilter === 'preseason' && ev.category !== 'Pre-Season') return false;
      if (activityFilter === 'demo' && ev.category !== 'Demo') return false;

      // Filter by search query
      if (activitySearch.trim()) {
        const q = activitySearch.trim().toLowerCase();
        const matchName = ev.studentName?.toLowerCase().includes(q);
        const matchId = ev.studentId?.includes(q);
        if (!matchName && !matchId) return false;
      }

      return true;
    });
  }, [activityEvents, activityFilter, activitySearch]);

  const activityTotalPages = Math.max(1, Math.ceil(filteredEvents.length / activityPageSize));
  const paginatedEvents = useMemo(() => {
    const start = (activityCurrentPage - 1) * activityPageSize;
    return filteredEvents.slice(start, start + activityPageSize);
  }, [filteredEvents, activityCurrentPage, activityPageSize]);

  // Hours by Category: Filtered, Sorted, and Paginated Students
  const filteredAndSortedStudents = useMemo(() => {
    let result = [...students];

    // Search filter
    if (hoursSearch.trim()) {
      const q = hoursSearch.trim().toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.id.includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (hoursSortKey) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'id':
          valA = a.id;
          valB = b.id;
          break;
        case 'build':
          valA = a.buildMinutes || 0;
          valB = b.buildMinutes || 0;
          break;
        case 'learning':
          valA = a.learningMinutes || 0;
          valB = b.learningMinutes || 0;
          break;
        case 'preseason':
          valA = a.preseasonMinutes || 0;
          valB = b.preseasonMinutes || 0;
          break;
        case 'demo':
          valA = a.demoMinutes || 0;
          valB = b.demoMinutes || 0;
          break;
        case 'total':
        default:
          valA = a.totalMinutes || 0;
          valB = b.totalMinutes || 0;
          break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB);
        return hoursSortOrder === 'asc' ? cmp : -cmp;
      }
      return hoursSortOrder === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });

    return result;
  }, [students, hoursSearch, hoursSortKey, hoursSortOrder]);

  const hoursTotalPages = Math.max(1, Math.ceil(filteredAndSortedStudents.length / hoursPageSize));
  const paginatedStudents = useMemo(() => {
    const start = (hoursCurrentPage - 1) * hoursPageSize;
    return filteredAndSortedStudents.slice(start, start + hoursPageSize);
  }, [filteredAndSortedStudents, hoursCurrentPage, hoursPageSize]);

  const handleHoursSort = (key: HoursSortKey): void => {
    if (hoursSortKey === key) {
      setHoursSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setHoursSortKey(key);
      setHoursSortOrder(key === 'name' || key === 'id' ? 'asc' : 'desc');
    }
  };

  const renderSortArrow = (key: HoursSortKey) => {
    if (hoursSortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-500 opacity-60" />;
    }
    return hoursSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400" />
    );
  };

  // Metrics
  const currentlyPresentStudents = students.filter((s) => s.isClockedIn);
  const presentCount = currentlyPresentStudents.length;
  const absentCount = Math.max(0, students.length - presentCount);
  const presentPercentage = students.length > 0 ? (presentCount / students.length) * 100 : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySessionsCount = entries.filter((e) => e.date === todayStr).length;

  const totalTeamHours = (
    students.reduce((sum, s) => sum + (s.totalMinutes || 0), 0) / 60
  ).toFixed(1);
  const totalBuildHours = (
    students.reduce((sum, s) => sum + (s.buildMinutes || 0), 0) / 60
  ).toFixed(1);
  const totalLearningHours = (
    students.reduce((sum, s) => sum + (s.learningMinutes || 0), 0) / 60
  ).toFixed(1);
  const totalPreseasonHours = (
    students.reduce((sum, s) => sum + (s.preseasonMinutes || 0), 0) / 60
  ).toFixed(1);
  const totalDemoHours = (
    students.reduce((sum, s) => sum + (s.demoMinutes || 0), 0) / 60
  ).toFixed(1);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const activityFilterButtons = [
    { label: 'All Activity', key: 'all' },
    { label: 'Build Season', key: 'build' },
    { label: 'Learning Days', key: 'learning' },
    { label: 'Pre-Season', key: 'preseason' },
    { label: 'Demos', key: 'demo' },
    { label: 'Signed In', key: 'signed in' },
    { label: 'Signed Out', key: 'signed out' },
    { label: 'Adjusted', key: 'adjusted' },
  ];

  const formatMinutesToHours = (mins?: number): string => {
    return `${((mins || 0) / 60).toFixed(1)} hrs`;
  };

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

  const renderCategoryBadge = (cat: HourCategory) => {
    switch (cat) {
      case 'Demo':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/50 border border-amber-800/80 text-amber-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Demo
          </span>
        );
      case 'Learning Days':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-950/50 border border-blue-800/80 text-blue-300">
            <BookOpen className="w-3 h-3 text-blue-400" />
            Learning Days
          </span>
        );
      case 'Pre-Season':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-950/50 border border-purple-800/80 text-purple-300">
            <Calendar className="w-3 h-3 text-purple-400" />
            Pre-Season
          </span>
        );
      case 'Build Season':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950/50 border border-emerald-800/80 text-emerald-300">
            <Wrench className="w-3 h-3 text-emerald-400" />
            Build Season
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full select-none text-zinc-100 font-mono space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Activity &amp; Reports
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Workshop attendance tracking and hours breakdown by category.
          </p>
        </div>

        {/* CSV Export Button */}
        <a
          href="/api/developer/export-csv"
          download
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1c1c1f] hover:bg-zinc-800 border border-[#27272a] text-xs text-zinc-300 hover:text-white transition-colors self-start sm:self-auto shadow-sm"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Export Summary CSV</span>
        </a>
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

        {/* KPI 3: Total Accumulated Hours with category badges */}
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

      {/* Category Totals Banner */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider">
          Hours Breakdown:
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-400">Build Season:</span>
            <span className="font-bold text-white">{totalBuildHours} hrs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-zinc-400">Learning Days:</span>
            <span className="font-bold text-white">{totalLearningHours} hrs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-zinc-400">Pre-Season:</span>
            <span className="font-bold text-white">{totalPreseasonHours} hrs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-zinc-400">Demo:</span>
            <span className="font-bold text-white">{totalDemoHours} hrs</span>
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

      {/* Main Grid: Left 2/3 (Reports & Logs), Right 1/3 (Manual Sign In / Out & Shop Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ======================================================== */}
        {/* LEFT COLUMN: HOURS BY CATEGORY REPORT / ACTIVITY LOG */}
        {/* ======================================================== */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-xl overflow-hidden flex flex-col justify-between">
            {/* View Tab Switcher Header */}
            <div className="p-4 border-b border-[#27272a] bg-[#151518] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 bg-[#101012] p-1 rounded-xl border border-[#27272a] self-start">
                <button
                  type="button"
                  onClick={() => setActiveReportTab('hoursByCategory')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeReportTab === 'hoursByCategory'
                      ? 'bg-white text-zinc-950 shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Hours by Category</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReportTab('activityLog')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeReportTab === 'activityLog'
                      ? 'bg-white text-zinc-950 shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Activity Log</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    activeReportTab === 'hoursByCategory'
                      ? 'Search students...'
                      : 'Search activity...'
                  }
                  value={activeReportTab === 'hoursByCategory' ? hoursSearch : activitySearch}
                  onChange={(e) => {
                    if (activeReportTab === 'hoursByCategory') {
                      setHoursSearch(e.target.value);
                      setHoursCurrentPage(1);
                    } else {
                      setActivitySearch(e.target.value);
                      setActivityCurrentPage(1);
                    }
                  }}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#121214] border border-[#27272a] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
                {(activeReportTab === 'hoursByCategory' ? hoursSearch : activitySearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeReportTab === 'hoursByCategory') {
                        setHoursSearch('');
                      } else {
                        setActivitySearch('');
                      }
                    }}
                    className="absolute right-2.5 top-2 text-zinc-500 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* ======================================================== */}
            {/* VIEW 1: HOURS BY CATEGORY REPORT TABLE */}
            {/* ======================================================== */}
            {activeReportTab === 'hoursByCategory' && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#27272a] text-zinc-400 font-medium bg-[#121214]">
                        {/* Student Name */}
                        <th
                          onClick={() => handleHoursSort('name')}
                          className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Student</span>
                            {renderSortArrow('name')}
                          </div>
                        </th>

                        {/* Student ID */}
                        <th
                          onClick={() => handleHoursSort('id')}
                          className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>ID</span>
                            {renderSortArrow('id')}
                          </div>
                        </th>

                        {/* Build Season Hours */}
                        <th
                          onClick={() => handleHoursSort('build')}
                          className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1 text-emerald-400">
                            <span>Build Season</span>
                            {renderSortArrow('build')}
                          </div>
                        </th>

                        {/* Learning Days Hours */}
                        <th
                          onClick={() => handleHoursSort('learning')}
                          className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1 text-blue-400">
                            <span>Learning Days</span>
                            {renderSortArrow('learning')}
                          </div>
                        </th>

                        {/* Pre-Season Hours */}
                        <th
                          onClick={() => handleHoursSort('preseason')}
                          className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1 text-purple-400">
                            <span>Pre-Season</span>
                            {renderSortArrow('preseason')}
                          </div>
                        </th>

                        {/* Demo Hours */}
                        <th
                          onClick={() => handleHoursSort('demo')}
                          className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1 text-amber-400">
                            <span>Demo</span>
                            {renderSortArrow('demo')}
                          </div>
                        </th>

                        {/* Total Hours */}
                        <th
                          onClick={() => handleHoursSort('total')}
                          className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1 font-bold text-white">
                            <span>Total</span>
                            {renderSortArrow('total')}
                          </div>
                        </th>

                        {/* Status */}
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]">
                      {paginatedStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-zinc-500 font-sans">
                            No students found matching your search.
                          </td>
                        </tr>
                      ) : (
                        paginatedStudents.map((s) => (
                          <tr key={s.id} className="hover:bg-zinc-850/40 transition-colors">
                            {/* Student Name */}
                            <td className="py-3 px-4 font-semibold text-white truncate max-w-[150px]">
                              {s.name}
                            </td>

                            {/* Student ID */}
                            <td className="py-3 px-3 text-zinc-400 font-mono">
                              {s.id}
                            </td>

                            {/* Build Season Hours */}
                            <td className="py-3 px-3 text-emerald-400 font-semibold">
                              {formatMinutesToHours(s.buildMinutes)}
                            </td>

                            {/* Learning Days Hours */}
                            <td className="py-3 px-3 text-blue-400">
                              {formatMinutesToHours(s.learningMinutes)}
                            </td>

                            {/* Pre-Season Hours */}
                            <td className="py-3 px-3 text-purple-400">
                              {formatMinutesToHours(s.preseasonMinutes)}
                            </td>

                            {/* Demo Hours */}
                            <td className="py-3 px-3 text-amber-400">
                              {formatMinutesToHours(s.demoMinutes)}
                            </td>

                            {/* Total Hours */}
                            <td className="py-3 px-4 text-right font-bold text-white">
                              {formatMinutesToHours(s.totalMinutes)}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">
                              {s.isClockedIn ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Present
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
                                  Out
                                </span>
                              )}
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
                      value={hoursPageSize}
                      onChange={(e) => {
                        setHoursPageSize(Number(e.target.value));
                        setHoursCurrentPage(1);
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
                      {filteredAndSortedStudents.length > 0
                        ? (hoursCurrentPage - 1) * hoursPageSize + 1
                        : 0}{' '}
                      to {Math.min(hoursCurrentPage * hoursPageSize, filteredAndSortedStudents.length)} of{' '}
                      {filteredAndSortedStudents.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={hoursCurrentPage <= 1}
                      onClick={() => setHoursCurrentPage(1)}
                      className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={hoursCurrentPage <= 1}
                      onClick={() => setHoursCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2">
                      Page {hoursCurrentPage} of {hoursTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={hoursCurrentPage >= hoursTotalPages}
                      onClick={() => setHoursCurrentPage((p) => Math.min(hoursTotalPages, p + 1))}
                      className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={hoursCurrentPage >= hoursTotalPages}
                      onClick={() => setHoursCurrentPage(hoursTotalPages)}
                      className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ======================================================== */}
            {/* VIEW 2: LIVE ACTIVITY STREAM */}
            {/* ======================================================== */}
            {activeReportTab === 'activityLog' && (
              <>
                {/* Filter Pills */}
                <div className="p-3 border-b border-[#27272a] bg-[#121214] flex items-center gap-2 flex-wrap text-xs">
                  {activityFilterButtons.map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => {
                        setActivityFilter(btn.key);
                        setActivityCurrentPage(1);
                      }}
                      className={`py-1.5 px-3 rounded-lg text-center font-medium transition-all ${
                        activityFilter === btn.key
                          ? 'bg-white text-zinc-950 font-bold shadow-sm'
                          : 'bg-[#18181b] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-[#27272a]'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
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

                            {/* Session Category Badge */}
                            <td className="py-3 px-5">
                              {renderCategoryBadge(event.category)}
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
                      value={activityPageSize}
                      onChange={(e) => {
                        setActivityPageSize(Number(e.target.value));
                        setActivityCurrentPage(1);
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
                      {filteredEvents.length > 0 ? (activityCurrentPage - 1) * activityPageSize + 1 : 0} to{' '}
                      {Math.min(activityCurrentPage * activityPageSize, filteredEvents.length)} of {filteredEvents.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={activityCurrentPage <= 1}
                      onClick={() => setActivityCurrentPage(1)}
                      className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={activityCurrentPage <= 1}
                      onClick={() => setActivityCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2">
                      Page {activityCurrentPage} of {activityTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={activityCurrentPage >= activityTotalPages}
                      onClick={() => setActivityCurrentPage((p) => Math.min(activityTotalPages, p + 1))}
                      className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={activityCurrentPage >= activityTotalPages}
                      onClick={() => setActivityCurrentPage(activityTotalPages)}
                      className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
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
                Sign a student in or out manually for a specific session category.
              </p>
            </div>

            {/* Category Selector: 4 Session Categories */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400 block font-semibold">
                Session Category:
              </label>
              <div className="bg-[#121214] p-1.5 rounded-xl border border-[#27272a] grid grid-cols-2 gap-1.5 text-xs">
                {/* 1. Build Season */}
                <button
                  type="button"
                  onClick={() => setSessionCategory('Build Season')}
                  className={`py-2 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-center ${
                    sessionCategory === 'Build Season'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white bg-[#18181b]'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Build Season</span>
                </button>

                {/* 2. Learning Days */}
                <button
                  type="button"
                  onClick={() => setSessionCategory('Learning Days')}
                  className={`py-2 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-center ${
                    sessionCategory === 'Learning Days'
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white bg-[#18181b]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Learning Days</span>
                </button>

                {/* 3. Pre-Season */}
                <button
                  type="button"
                  onClick={() => setSessionCategory('Pre-Season')}
                  className={`py-2 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-center ${
                    sessionCategory === 'Pre-Season'
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white bg-[#18181b]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Pre-Season</span>
                </button>

                {/* 4. Demo */}
                <button
                  type="button"
                  onClick={() => setSessionCategory('Demo')}
                  className={`py-2 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-center ${
                    sessionCategory === 'Demo'
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white bg-[#18181b]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Demo</span>
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 font-sans mt-1">
                Hours will automatically credit towards {sessionCategory} in the hours report.
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
                    <span>Sign In to {sessionCategory}</span>
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

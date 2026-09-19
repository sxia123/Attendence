import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student } from '../types/attendance';
import {
  Trophy,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  LogOut,
  FileEdit,
  Clock,
  Users,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

interface HoursLeaderboardProps {
  onExit: () => void;
  onGoToEditor?: () => void;
}

type SortField = 'rank' | 'name' | 'id' | 'status' | 'sessions' | 'totalMinutes' | 'avgMinutes';
type SortOrder = 'asc' | 'desc';

export const HoursLeaderboard: React.FC<HoursLeaderboardProps> = ({
  onExit,
  onGoToEditor,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Hours Concealment State (default: concealed per request)
  const [isHoursConcealed, setIsHoursConcealed] = useState<boolean>(true);

  // Column Filters
  const [filterRank, setFilterRank] = useState<'top5' | 'top3' | 'all'>('top5');
  const [filterName, setFilterName] = useState<string>('');
  const [filterId, setFilterId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in' | 'out'>('all');
  const [filterSessions, setFilterSessions] = useState<'all' | 'gte_1' | 'gte_3' | 'gte_5'>('all');

  // Column Sorting
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Fetch Students
  const fetchStudents = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/developer/students');
      if (res.ok) {
        const data = (await res.json()) as Student[];
        setStudents(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  // Overall ranked list (strictly sorted by total hours desc to calculate base ranks)
  const rankedBase = useMemo(() => {
    const list = [...students].sort((a, b) => b.totalMinutes - a.totalMinutes);
    return list.map((student, idx) => ({
      ...student,
      baseRank: idx + 1,
      avgMinutes:
        student.sessionsCount && student.sessionsCount > 0
          ? Math.round(student.totalMinutes / student.sessionsCount)
          : student.totalMinutes,
    }));
  }, [students]);

  // Top 5 Students
  const top5Students = useMemo(() => {
    return rankedBase.slice(0, 5);
  }, [rankedBase]);

  // Overall Statistics
  const totalTeamMinutes = useMemo(() => {
    return students.reduce((acc, s) => acc + s.totalMinutes, 0);
  }, [students]);

  const activeCount = useMemo(() => {
    return students.filter((s) => s.isClockedIn).length;
  }, [students]);

  // Sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(
        field === 'totalMinutes' || field === 'sessions' || field === 'avgMinutes' ? 'desc' : 'asc'
      );
    }
  };

  // Filter & Sort Logic for Leaderboard Table
  const filteredAndSorted = useMemo(() => {
    // Start with the ranked list
    let source = rankedBase;
    if (filterRank === 'top5') {
      source = rankedBase.slice(0, 5);
    } else if (filterRank === 'top3') {
      source = rankedBase.slice(0, 3);
    }

    return source
      .filter((student) => {
        // 1. Name filter
        if (
          filterName.trim() &&
          !student.name.toLowerCase().includes(filterName.trim().toLowerCase())
        ) {
          return false;
        }

        // 2. ID filter
        if (filterId.trim() && !student.id.includes(filterId.trim())) {
          return false;
        }

        // 3. Status filter
        if (filterStatus === 'in' && !student.isClockedIn) return false;
        if (filterStatus === 'out' && student.isClockedIn) return false;

        // 4. Sessions filter
        const sess = student.sessionsCount || 0;
        if (filterSessions === 'gte_1' && sess < 1) return false;
        if (filterSessions === 'gte_3' && sess < 3) return false;
        if (filterSessions === 'gte_5' && sess < 5) return false;

        return true;
      })
      .sort((a, b) => {
        let valA: string | number = 0;
        let valB: string | number = 0;

        switch (sortField) {
          case 'rank':
            valA = a.baseRank;
            valB = b.baseRank;
            break;
          case 'name':
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            break;
          case 'id':
            valA = a.id;
            valB = b.id;
            break;
          case 'status':
            valA = a.isClockedIn ? 1 : 0;
            valB = b.isClockedIn ? 1 : 0;
            break;
          case 'sessions':
            valA = a.sessionsCount || 0;
            valB = b.sessionsCount || 0;
            break;
          case 'totalMinutes':
            valA = a.totalMinutes;
            valB = b.totalMinutes;
            break;
          case 'avgMinutes':
            valA = a.avgMinutes;
            valB = b.avgMinutes;
            break;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [rankedBase, filterRank, filterName, filterId, filterStatus, filterSessions, sortField, sortOrder]);

  const hasActiveFilters =
    filterRank !== 'top5' ||
    Boolean(filterName.trim()) ||
    Boolean(filterId.trim()) ||
    filterStatus !== 'all' ||
    filterSessions !== 'all';

  const clearAllFilters = () => {
    setFilterRank('top5');
    setFilterName('');
    setFilterId('');
    setFilterStatus('all');
    setFilterSessions('all');
    setSortField('rank');
    setSortOrder('asc');
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-600 inline ml-1 opacity-60 hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-400 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400 inline ml-1" />
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full select-none text-zinc-100 p-6 overflow-y-auto font-mono">
      {/* Top Action & Navigation Bar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-700 text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>← Back to Student Attendance</span>
          </button>

          {onGoToEditor && (
            <button
              type="button"
              onClick={onGoToEditor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-[#1c1c1f] text-zinc-300 hover:text-white text-xs transition-colors"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Open Hours Editor</span>
            </button>
          )}

          <a
            href="/api/developer/export-csv"
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#27272a] bg-[#1c1c1f] text-zinc-300 hover:text-white text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </a>
        </div>

        {/* Right Toolbar Controls: Hours Concealment Toggle & Reset Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Conceal / Reveal Hours Button */}
          <button
            type="button"
            onClick={() => setIsHoursConcealed((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              isHoursConcealed
                ? 'border-amber-700/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
                : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title="Toggle hours privacy concealment"
          >
            {isHoursConcealed ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Hours Concealed</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Hours Visible</span>
              </>
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 hover:bg-rose-900/50 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Header Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-white tracking-wide">Top 5 Hours Leaderboard</h1>
            {isHoursConcealed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800 text-amber-300 text-[10px] font-semibold">
                <Lock className="w-3 h-3" />
                Hours Concealed
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Displaying the top 5 student rankings with accumulated hours concealed.
          </p>
        </div>

        {/* Quick Team Summary */}
        <div className="flex items-center gap-4 text-xs text-zinc-400 bg-[#151518] px-4 py-2 rounded-xl border border-[#27272a]">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Present: <strong className="text-white">{activeCount}</strong> / {students.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Team Hours: <strong className="text-white">{isHoursConcealed ? '•••• hrs' : `${(totalTeamMinutes / 60).toFixed(1)} hrs`}</strong></span>
          </div>
        </div>
      </div>

      {/* Top 5 Showcase Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
        {top5Students.map((student) => {
          const rank = student.baseRank;
          const isFirst = rank === 1;
          const isSecond = rank === 2;
          const isThird = rank === 3;

          const cardBorder = isFirst
            ? 'border-amber-500/80 bg-gradient-to-b from-amber-950/30 to-[#1c1c1f]'
            : isSecond
            ? 'border-zinc-500/70 bg-gradient-to-b from-zinc-800/30 to-[#1c1c1f]'
            : isThird
            ? 'border-amber-800/70 bg-gradient-to-b from-amber-900/20 to-[#1c1c1f]'
            : 'border-[#27272a] bg-[#1c1c1f]';

          const badgeIcon = isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : '🏅';

          return (
            <div
              key={student.id}
              className={`rounded-2xl border p-4 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:scale-[1.02] ${cardBorder}`}
            >
              {/* Header: Badge & Status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <span className="text-xl">{badgeIcon}</span>
                  <span
                    className={
                      isFirst
                        ? 'text-amber-300'
                        : isSecond
                        ? 'text-zinc-300'
                        : isThird
                        ? 'text-amber-500'
                        : 'text-zinc-400'
                    }
                  >
                    #{rank}
                  </span>
                </div>

                {student.isClockedIn ? (
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    Present
                  </span>
                ) : (
                  <span className="text-[10px] bg-zinc-900 text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded">
                    Signed Out
                  </span>
                )}
              </div>

              {/* Student Details */}
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white truncate" title={student.name}>
                  {student.name}
                </h3>
                <div className="text-xs text-zinc-400">ID: {student.id}</div>
              </div>

              {/* Concealed Hours Footer */}
              <div className="mt-4 pt-3 border-t border-[#27272a] flex justify-between items-end">
                <span className="text-[11px] text-zinc-500">{student.sessionsCount || 0} sessions</span>
                <div className="text-right">
                  {isHoursConcealed ? (
                    <span className="text-sm font-bold text-zinc-400 tracking-widest bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                      •••• hrs
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-white">
                      {(student.totalMinutes / 60).toFixed(1)} hrs
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top 5 Leaderboard Table Container */}
      <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-2xl overflow-hidden flex flex-col">
        {/* Table Header Filter Status Bar */}
        <div className="px-5 py-3 border-b border-[#27272a] bg-[#151518] flex items-center justify-between text-xs text-zinc-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Top 5 Rankings Table</span>
            <span>•</span>
            <span>
              Showing <strong className="text-white">{filteredAndSorted.length}</strong> of{' '}
              <strong className="text-white">5</strong> students
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isHoursConcealed && (
              <span className="text-amber-400/90 text-[11px] flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Hours Concealed
              </span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-zinc-400 hover:text-white underline text-[11px]"
              >
                Reset table filters
              </button>
            )}
          </div>
        </div>

        {/* The Main Table with Per-Column Headers and Per-Column Filters */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              {/* Row 1: Header Titles with Sort Buttons */}
              <tr className="border-b border-[#27272a] bg-[#121214] text-zinc-400 font-semibold select-none">
                {/* 1. Rank */}
                <th
                  onClick={() => handleSort('rank')}
                  className="py-3 px-4 w-24 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Rank</span>
                    {renderSortIcon('rank')}
                  </div>
                </th>

                {/* 2. Student Name */}
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Student Name</span>
                    {renderSortIcon('name')}
                  </div>
                </th>

                {/* 3. Student ID */}
                <th
                  onClick={() => handleSort('id')}
                  className="py-3 px-4 w-28 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    {renderSortIcon('id')}
                  </div>
                </th>

                {/* 4. Status */}
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 w-28 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* 5. Sessions Count */}
                <th
                  onClick={() => handleSort('sessions')}
                  className="py-3 px-4 w-28 cursor-pointer hover:text-white transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Sessions</span>
                    {renderSortIcon('sessions')}
                  </div>
                </th>

                {/* 6. Total Hours (Concealed) */}
                <th className="py-3 px-4 w-36 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Hours</span>
                    {isHoursConcealed && <Lock className="w-3 h-3 text-amber-400" />}
                  </div>
                </th>

                {/* 7. Avg Hours (Concealed) */}
                <th className="py-3 px-4 w-32 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>Avg/Session</span>
                    {isHoursConcealed && <Lock className="w-3 h-3 text-amber-400" />}
                  </div>
                </th>
              </tr>

              {/* Row 2: Per-Column Interactive Filters */}
              <tr className="border-b border-[#27272a] bg-[#151518]/90 py-2">
                {/* 1. Filter Rank */}
                <th className="py-2 px-3">
                  <select
                    value={filterRank}
                    onChange={(e) => setFilterRank(e.target.value as 'top5' | 'top3' | 'all')}
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="top5">Top 5</option>
                    <option value="top3">Top 3</option>
                    <option value="all">All Ranks</option>
                  </select>
                </th>

                {/* 2. Filter Name */}
                <th className="py-2 px-3">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2 top-2 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter name..."
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      className="w-full pl-6 pr-5 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-white focus:outline-none focus:border-zinc-500"
                    />
                    {filterName && (
                      <button
                        type="button"
                        onClick={() => setFilterName('')}
                        className="absolute right-1.5 top-1.5 text-zinc-500 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>

                {/* 3. Filter ID */}
                <th className="py-2 px-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filter ID..."
                      value={filterId}
                      onChange={(e) => setFilterId(e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-white focus:outline-none focus:border-zinc-500"
                    />
                    {filterId && (
                      <button
                        type="button"
                        onClick={() => setFilterId('')}
                        className="absolute right-1.5 top-1.5 text-zinc-500 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>

                {/* 4. Filter Status */}
                <th className="py-2 px-3">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'in' | 'out')}
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="in">Signed In</option>
                    <option value="out">Signed Out</option>
                  </select>
                </th>

                {/* 5. Filter Sessions */}
                <th className="py-2 px-3 text-right">
                  <select
                    value={filterSessions}
                    onChange={(e) =>
                      setFilterSessions(e.target.value as 'all' | 'gte_1' | 'gte_3' | 'gte_5')
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="gte_1">≥ 1 Session</option>
                    <option value="gte_3">≥ 3 Sessions</option>
                    <option value="gte_5">≥ 5 Sessions</option>
                  </select>
                </th>

                {/* 6. Hours Column Header (Concealed Note) */}
                <th className="py-2 px-3 text-right text-zinc-500 text-[10px]">
                  {isHoursConcealed ? '🔒 Concealed' : 'Visible'}
                </th>

                {/* 7. Avg Hours Column Header (Concealed Note) */}
                <th className="py-2 px-3 text-right text-zinc-500 text-[10px]">
                  {isHoursConcealed ? '🔒 Concealed' : 'Visible'}
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#27272a] text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    Loading top 5 student rankings...
                  </td>
                </tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <div>No students match your filter criteria.</div>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="mt-2 text-cyan-400 hover:underline"
                    >
                      Reset all filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((student) => {
                  const hrs = (student.totalMinutes / 60).toFixed(1);
                  const avgHrs = (student.avgMinutes / 60).toFixed(1);

                  // Badges for ranks
                  const rankBadge =
                    student.baseRank === 1 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                        <span>🥇</span> #1
                      </span>
                    ) : student.baseRank === 2 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-zinc-300">
                        <span>🥈</span> #2
                      </span>
                    ) : student.baseRank === 3 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                        <span>🥉</span> #3
                      </span>
                    ) : student.baseRank === 4 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-cyan-400">
                        <span>🏅</span> #4
                      </span>
                    ) : student.baseRank === 5 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-indigo-400">
                        <span>🏅</span> #5
                      </span>
                    ) : (
                      <span className="text-zinc-500 font-medium">#{student.baseRank}</span>
                    );

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-zinc-850/50 transition-colors ${
                        student.baseRank === 1 ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3 px-4">{rankBadge}</td>

                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{student.name}</span>
                          {student.isClockedIn && (
                            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                              Present
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ID */}
                      <td className="py-3 px-4 text-zinc-400">{student.id}</td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {student.isClockedIn ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Signed In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-zinc-500">
                            <span className="w-2 h-2 rounded-full bg-zinc-600" />
                            Signed Out
                          </span>
                        )}
                      </td>

                      {/* Sessions */}
                      <td className="py-3 px-4 text-right text-zinc-300">
                        {student.sessionsCount || 0}
                      </td>

                      {/* Total Hours (Concealed) */}
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        {isHoursConcealed ? (
                          <span className="text-zinc-400 tracking-widest bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                            •••• hrs
                          </span>
                        ) : (
                          <span className="text-white">{hrs} hrs</span>
                        )}
                      </td>

                      {/* Avg Hours / Session (Concealed) */}
                      <td className="py-3 px-4 text-right text-zinc-400">
                        {isHoursConcealed ? (
                          <span className="text-zinc-500 tracking-widest">••••</span>
                        ) : (
                          <span>{avgHrs} hrs</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

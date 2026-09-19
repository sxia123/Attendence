import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student } from '../types/attendance';
import {
  Trophy,
  Medal,
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

  // Column Filters
  const [filterRank, setFilterRank] = useState<'all' | 'top3' | 'top5' | 'top10' | 'top25'>('all');
  const [filterName, setFilterName] = useState<string>('');
  const [filterId, setFilterId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in' | 'out'>('all');
  const [filterSessions, setFilterSessions] = useState<'all' | 'gte_1' | 'gte_3' | 'gte_5' | 'gte_10'>('all');
  const [filterHours, setFilterHours] = useState<'all' | 'gt_0' | 'gte_5' | 'gte_10' | 'gte_25' | 'gte_50'>('all');
  const [filterAvg, setFilterAvg] = useState<'all' | 'gte_1' | 'gte_2' | 'gte_3'>('all');

  // Column Sorting
  const [sortField, setSortField] = useState<SortField>('totalMinutes');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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
      avgMinutes: student.sessionsCount && student.sessionsCount > 0
        ? Math.round(student.totalMinutes / student.sessionsCount)
        : student.totalMinutes,
    }));
  }, [students]);

  // Top 3 Podium
  const top1 = rankedBase[0];
  const top2 = rankedBase[1];
  const top3 = rankedBase[2];

  // Overall Statistics
  const totalTeamMinutes = useMemo(() => {
    return students.reduce((acc, s) => acc + s.totalMinutes, 0);
  }, [students]);

  const activeCount = useMemo(() => {
    return students.filter((s) => s.isClockedIn).length;
  }, [students]);

  const avgMinutesPerStudent = useMemo(() => {
    return students.length > 0 ? Math.round(totalTeamMinutes / students.length) : 0;
  }, [students, totalTeamMinutes]);

  // Sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'totalMinutes' || field === 'sessions' || field === 'avgMinutes' ? 'desc' : 'asc');
    }
  };

  // Filter & Sort Logic
  const filteredAndSorted = useMemo(() => {
    return rankedBase
      .filter((student) => {
        // 1. Rank filter
        if (filterRank === 'top3' && student.baseRank > 3) return false;
        if (filterRank === 'top5' && student.baseRank > 5) return false;
        if (filterRank === 'top10' && student.baseRank > 10) return false;
        if (filterRank === 'top25' && student.baseRank > 25) return false;

        // 2. Name filter
        if (filterName.trim() && !student.name.toLowerCase().includes(filterName.trim().toLowerCase())) {
          return false;
        }

        // 3. ID filter
        if (filterId.trim() && !student.id.includes(filterId.trim())) {
          return false;
        }

        // 4. Status filter
        if (filterStatus === 'in' && !student.isClockedIn) return false;
        if (filterStatus === 'out' && student.isClockedIn) return false;

        // 5. Sessions filter
        const sess = student.sessionsCount || 0;
        if (filterSessions === 'gte_1' && sess < 1) return false;
        if (filterSessions === 'gte_3' && sess < 3) return false;
        if (filterSessions === 'gte_5' && sess < 5) return false;
        if (filterSessions === 'gte_10' && sess < 10) return false;

        // 6. Hours filter
        const hrs = student.totalMinutes / 60;
        if (filterHours === 'gt_0' && hrs <= 0) return false;
        if (filterHours === 'gte_5' && hrs < 5) return false;
        if (filterHours === 'gte_10' && hrs < 10) return false;
        if (filterHours === 'gte_25' && hrs < 25) return false;
        if (filterHours === 'gte_50' && hrs < 50) return false;

        // 7. Avg Hours filter
        const avgHrs = student.avgMinutes / 60;
        if (filterAvg === 'gte_1' && avgHrs < 1) return false;
        if (filterAvg === 'gte_2' && avgHrs < 2) return false;
        if (filterAvg === 'gte_3' && avgHrs < 3) return false;

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
  }, [
    rankedBase,
    filterRank,
    filterName,
    filterId,
    filterStatus,
    filterSessions,
    filterHours,
    filterAvg,
    sortField,
    sortOrder,
  ]);

  const hasActiveFilters =
    filterRank !== 'all' ||
    Boolean(filterName.trim()) ||
    Boolean(filterId.trim()) ||
    filterStatus !== 'all' ||
    filterSessions !== 'all' ||
    filterHours !== 'all' ||
    filterAvg !== 'all';

  const clearAllFilters = () => {
    setFilterRank('all');
    setFilterName('');
    setFilterId('');
    setFilterStatus('all');
    setFilterSessions('all');
    setFilterHours('all');
    setFilterAvg('all');
    setSortField('totalMinutes');
    setSortOrder('desc');
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-800 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 text-xs transition-colors"
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
            <span>Download Leaderboard (CSV)</span>
          </a>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 hover:bg-rose-900/50 text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Column Filters</span>
          </button>
        )}
      </div>

      {/* Top Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1c1c1f] border border-[#27272a] rounded-xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-lg bg-amber-950/50 border border-amber-800 flex items-center justify-center text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Top Hours Record</div>
            <div className="text-lg font-bold text-white">
              {top1 ? `${(top1.totalMinutes / 60).toFixed(1)} hrs` : '0 hrs'}
            </div>
          </div>
        </div>

        <div className="bg-[#1c1c1f] border border-[#27272a] rounded-xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/50 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Total Team Hours</div>
            <div className="text-lg font-bold text-white">
              {(totalTeamMinutes / 60).toFixed(1)} hrs
            </div>
          </div>
        </div>

        <div className="bg-[#1c1c1f] border border-[#27272a] rounded-xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-lg bg-emerald-950/50 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Active Students</div>
            <div className="text-lg font-bold text-white">
              {activeCount} / {students.length}
            </div>
          </div>
        </div>

        <div className="bg-[#1c1c1f] border border-[#27272a] rounded-xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
            <Medal className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Avg Hours / Student</div>
            <div className="text-lg font-bold text-white">
              {(avgMinutesPerStudent / 60).toFixed(1)} hrs
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Highlights */}
      {students.length >= 3 && !hasActiveFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 2nd Place */}
          {top2 && (
            <div className="bg-[#1c1c1f] border border-zinc-600/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between order-2 md:order-1 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🥈</span>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700">
                  2nd Place
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{top2.name}</h3>
                <div className="text-xs text-zinc-400">ID: {top2.id}</div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#27272a] flex justify-between items-end">
                <span className="text-xs text-zinc-500">{top2.sessionsCount || 0} sessions</span>
                <span className="text-xl font-bold text-zinc-200">
                  {(top2.totalMinutes / 60).toFixed(1)} hrs
                </span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {top1 && (
            <div className="bg-gradient-to-b from-amber-950/30 to-[#1c1c1f] border-2 border-amber-500/70 rounded-2xl p-6 shadow-2xl flex flex-col justify-between order-1 md:order-2 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">🥇</span>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-widest bg-amber-900/60 px-3 py-1 rounded-full border border-amber-600 shadow-sm">
                  1st Place Leader
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{top1.name}</h3>
                <div className="text-xs text-amber-400/80">ID: {top1.id}</div>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-800/40 flex justify-between items-end">
                <span className="text-xs text-amber-300/70">{top1.sessionsCount || 0} sessions logged</span>
                <span className="text-2xl font-extrabold text-amber-300">
                  {(top1.totalMinutes / 60).toFixed(1)} hrs
                </span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3 && (
            <div className="bg-[#1c1c1f] border border-amber-800/50 rounded-2xl p-5 shadow-xl flex flex-col justify-between order-3 md:order-3 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🥉</span>
                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-900">
                  3rd Place
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{top3.name}</h3>
                <div className="text-xs text-zinc-400">ID: {top3.id}</div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#27272a] flex justify-between items-end">
                <span className="text-xs text-zinc-500">{top3.sessionsCount || 0} sessions</span>
                <span className="text-xl font-bold text-amber-200">
                  {(top3.totalMinutes / 60).toFixed(1)} hrs
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Table Container */}
      <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-2xl overflow-hidden flex flex-col">
        {/* Table Header Filter Status Bar */}
        <div className="px-5 py-3 border-b border-[#27272a] bg-[#151518] flex items-center justify-between text-xs text-zinc-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Hours Leaderboard Table</span>
            <span>•</span>
            <span>
              Showing <strong className="text-white">{filteredAndSorted.length}</strong> of{' '}
              <strong className="text-white">{students.length}</strong> students
            </span>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-[11px]">Filters active</span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-zinc-400 hover:text-white underline text-[11px]"
              >
                Clear all
              </button>
            </div>
          )}
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
                  className="py-3 px-4 w-20 cursor-pointer hover:text-white transition-colors"
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
                  className="py-3 px-4 w-32 cursor-pointer hover:text-white transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Sessions</span>
                    {renderSortIcon('sessions')}
                  </div>
                </th>

                {/* 6. Total Hours */}
                <th
                  onClick={() => handleSort('totalMinutes')}
                  className="py-3 px-4 w-36 cursor-pointer hover:text-white transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Hours</span>
                    {renderSortIcon('totalMinutes')}
                  </div>
                </th>

                {/* 7. Avg Hours */}
                <th
                  onClick={() => handleSort('avgMinutes')}
                  className="py-3 px-4 w-32 cursor-pointer hover:text-white transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Avg/Session</span>
                    {renderSortIcon('avgMinutes')}
                  </div>
                </th>
              </tr>

              {/* Row 2: Per-Column Interactive Filters */}
              <tr className="border-b border-[#27272a] bg-[#151518]/90 py-2">
                {/* 1. Filter Rank */}
                <th className="py-2 px-3">
                  <select
                    value={filterRank}
                    onChange={(e) =>
                      setFilterRank(e.target.value as 'all' | 'top3' | 'top5' | 'top10' | 'top25')
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="top3">Top 3</option>
                    <option value="top5">Top 5</option>
                    <option value="top10">Top 10</option>
                    <option value="top25">Top 25</option>
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
                      setFilterSessions(
                        e.target.value as 'all' | 'gte_1' | 'gte_3' | 'gte_5' | 'gte_10'
                      )
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="gte_1">≥ 1 Session</option>
                    <option value="gte_3">≥ 3 Sessions</option>
                    <option value="gte_5">≥ 5 Sessions</option>
                    <option value="gte_10">≥ 10 Sessions</option>
                  </select>
                </th>

                {/* 6. Filter Total Hours */}
                <th className="py-2 px-3 text-right">
                  <select
                    value={filterHours}
                    onChange={(e) =>
                      setFilterHours(
                        e.target.value as 'all' | 'gt_0' | 'gte_5' | 'gte_10' | 'gte_25' | 'gte_50'
                      )
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All Hours</option>
                    <option value="gt_0">&gt; 0 hrs</option>
                    <option value="gte_5">≥ 5 hrs</option>
                    <option value="gte_10">≥ 10 hrs</option>
                    <option value="gte_25">≥ 25 hrs</option>
                    <option value="gte_50">≥ 50 hrs</option>
                  </select>
                </th>

                {/* 7. Filter Avg Hours */}
                <th className="py-2 px-3 text-right">
                  <select
                    value={filterAvg}
                    onChange={(e) =>
                      setFilterAvg(e.target.value as 'all' | 'gte_1' | 'gte_2' | 'gte_3')
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="gte_1">≥ 1 hr/session</option>
                    <option value="gte_2">≥ 2 hrs/session</option>
                    <option value="gte_3">≥ 3 hrs/session</option>
                  </select>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#27272a] text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    Loading student leaderboard...
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

                  // Medal badges for top 3
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

                      {/* Total Hours */}
                      <td className="py-3 px-4 text-right font-bold text-white text-sm">
                        {hrs} hrs
                      </td>

                      {/* Avg Hours / Session */}
                      <td className="py-3 px-4 text-right text-zinc-400">
                        {avgHrs} hrs
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

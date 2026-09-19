import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student, AttendanceEntry } from '../types/attendance';
import {
  LogOut,
  Download,
  UserPlus,
  CalendarPlus,
  Trash2,
  Edit3,
  Clock,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Trophy,
} from 'lucide-react';

interface HoursEditorProps {
  onExit: () => void;
  onGoToLeaderboard?: () => void;
}

interface ActiveEditSession {
  student: Student;
  dateStr: string;
  durationMinutes: number;
  timeIn: string;
  timeOut: string;
  hourType: 'Build' | 'Learning' | 'Outreach' | 'Offseason';
  entryId?: string;
}

export const HoursEditor: React.FC<HoursEditorProps> = ({ onExit, onGoToLeaderboard }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [activeSessionModal, setActiveSessionModal] = useState<ActiveEditSession | null>(null);

  // Column Filters
  const [filterName, setFilterName] = useState<string>('');
  const [filterId, setFilterId] = useState<string>('');
  const [filterToday, setFilterToday] = useState<'all' | 'has_hours' | 'active' | 'no_hours'>('all');
  const [filterYesterday, setFilterYesterday] = useState<'all' | 'has_hours' | 'no_hours'>('all');
  const [filterTotalHours, setFilterTotalHours] = useState<'all' | 'gt_0' | 'gte_5' | 'gte_10' | 'gte_20'>('all');

  // Column Sort
  type SortColumn = 'name' | 'id' | 'today' | 'yesterday' | 'total' | null;
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal states for toolbar buttons
  const [isAddStudentOpen, setIsAddStudentOpen] = useState<boolean>(false);
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [addStudentError, setAddStudentError] = useState<string | null>(null);

  // Time picker state inside edit session modal
  const [editInHour, setEditInHour] = useState<string>('05');
  const [editInMin, setEditInMin] = useState<string>('00');
  const [editInAmPm, setEditInAmPm] = useState<'AM' | 'PM'>('PM');

  const [editOutHour, setEditOutHour] = useState<string>('08');
  const [editOutMin, setEditOutMin] = useState<string>('00');
  const [editOutAmPm, setEditOutAmPm] = useState<'AM' | 'PM'>('PM');

  // Fetch Students & Entries
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

  // Today and Yesterday date strings
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Sorting helper
  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'today' || col === 'yesterday' || col === 'total' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (col: SortColumn) => {
    if (sortColumn !== col) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-600 inline ml-1 opacity-60 hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-400 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400 inline ml-1" />
    );
  };

  // Filter & Sort Logic
  const filteredAndSortedStudents = useMemo(() => {
    return students
      .filter((student) => {
        // 1. Name filter
        if (filterName.trim() && !student.name.toLowerCase().includes(filterName.trim().toLowerCase())) {
          return false;
        }
        // 2. ID filter
        if (filterId.trim() && !student.id.includes(filterId.trim())) {
          return false;
        }
        // 3. Today filter
        const todayEntry = entries.find((e) => e.studentId === student.id && e.date === todayStr);
        if (filterToday === 'has_hours' && (!todayEntry || (todayEntry.durationMinutes || 0) <= 0)) {
          return false;
        }
        if (filterToday === 'active' && todayEntry?.status !== 'active') {
          return false;
        }
        if (filterToday === 'no_hours' && todayEntry && (todayEntry.durationMinutes || 0) > 0) {
          return false;
        }
        // 4. Yesterday filter
        const yestEntry = entries.find((e) => e.studentId === student.id && e.date === yesterdayStr);
        if (filterYesterday === 'has_hours' && (!yestEntry || (yestEntry.durationMinutes || 0) <= 0)) {
          return false;
        }
        if (filterYesterday === 'no_hours' && yestEntry && (yestEntry.durationMinutes || 0) > 0) {
          return false;
        }
        // 5. Total Hours filter
        const totalHrs = student.totalMinutes / 60;
        if (filterTotalHours === 'gt_0' && totalHrs <= 0) {
          return false;
        }
        if (filterTotalHours === 'gte_5' && totalHrs < 5) {
          return false;
        }
        if (filterTotalHours === 'gte_10' && totalHrs < 10) {
          return false;
        }
        if (filterTotalHours === 'gte_20' && totalHrs < 20) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (!sortColumn) return 0;
        let valA: string | number = 0;
        let valB: string | number = 0;

        if (sortColumn === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortColumn === 'id') {
          valA = a.id;
          valB = b.id;
        } else if (sortColumn === 'today') {
          const eA = entries.find((e) => e.studentId === a.id && e.date === todayStr);
          const eB = entries.find((e) => e.studentId === b.id && e.date === todayStr);
          valA = eA?.durationMinutes || 0;
          valB = eB?.durationMinutes || 0;
        } else if (sortColumn === 'yesterday') {
          const eA = entries.find((e) => e.studentId === a.id && e.date === yesterdayStr);
          const eB = entries.find((e) => e.studentId === b.id && e.date === yesterdayStr);
          valA = eA?.durationMinutes || 0;
          valB = eB?.durationMinutes || 0;
        } else if (sortColumn === 'total') {
          valA = a.totalMinutes;
          valB = b.totalMinutes;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [
    students,
    entries,
    filterName,
    filterId,
    filterToday,
    filterYesterday,
    filterTotalHours,
    sortColumn,
    sortDirection,
    todayStr,
    yesterdayStr,
  ]);

  const hasActiveFilters =
    Boolean(filterName.trim()) ||
    Boolean(filterId.trim()) ||
    filterToday !== 'all' ||
    filterYesterday !== 'all' ||
    filterTotalHours !== 'all';

  const clearAllFilters = () => {
    setFilterName('');
    setFilterId('');
    setFilterToday('all');
    setFilterYesterday('all');
    setFilterTotalHours('all');
    setSortColumn(null);
  };

  // Select all or individual based on filtered results
  const toggleSelectAll = (): void => {
    if (
      selectedStudentIds.length === filteredAndSortedStudents.length &&
      filteredAndSortedStudents.length > 0
    ) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredAndSortedStudents.map((s) => s.id));
    }
  };

  const toggleSelectStudent = (id: string): void => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Delete selected students
  const handleDeleteSelected = async (): Promise<void> => {
    if (selectedStudentIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedStudentIds.length} student(s) and their records?`)) return;

    for (const id of selectedStudentIds) {
      await fetch(`/api/developer/students/${id}`, { method: 'DELETE' });
    }
    setSelectedStudentIds([]);
    void fetchStudents();
    void fetchEntries();
  };

  // Add new student
  const handleAddStudent = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setAddStudentError(null);

    if (!newStudentId || !/^\d{5}$/.test(newStudentId.trim())) {
      setAddStudentError('Student ID must be 5 numeric digits.');
      return;
    }
    if (!newStudentName.trim()) {
      setAddStudentError('Student name is required.');
      return;
    }

    try {
      const res = await fetch('/api/developer/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newStudentId.trim(), name: newStudentName.trim() }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || 'Failed to add student');
      }

      setIsAddStudentOpen(false);
      setNewStudentName('');
      setNewStudentId('');
      void fetchStudents();
    } catch (err) {
      setAddStudentError(err instanceof Error ? err.message : 'Error adding student');
    }
  };

  // Open Edit Session Modal
  const openEditSession = (student: Student, dateStr: string): void => {
    const existing = entries.find((e) => e.studentId === student.id && e.date === dateStr);
    const duration = existing?.durationMinutes || 180;

    setActiveSessionModal({
      student,
      dateStr,
      durationMinutes: duration,
      timeIn: existing?.timeIn || `${dateStr}T17:00:00.000Z`,
      timeOut: existing?.timeOut || `${dateStr}T20:00:00.000Z`,
      hourType: 'Build',
      entryId: existing?.id,
    });

    setEditInHour('05');
    setEditInMin('00');
    setEditInAmPm('PM');
    setEditOutHour('08');
    setEditOutMin('00');
    setEditOutAmPm('PM');
  };

  // Save Session changes
  const handleSaveSession = async (): Promise<void> => {
    if (!activeSessionModal) return;

    // Calculate duration
    let inH = parseInt(editInHour, 10) % 12;
    if (editInAmPm === 'PM') inH += 12;
    let outH = parseInt(editOutHour, 10) % 12;
    if (editOutAmPm === 'PM') outH += 12;

    const inTotalMin = inH * 60 + parseInt(editInMin, 10);
    const outTotalMin = outH * 60 + parseInt(editOutMin, 10);
    let diffMinutes = outTotalMin - inTotalMin;
    if (diffMinutes <= 0) diffMinutes += 24 * 60; // next day wrap if applicable

    try {
      if (activeSessionModal.entryId) {
        await fetch(`/api/developer/entries/${activeSessionModal.entryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            durationMinutes: diffMinutes,
            date: activeSessionModal.dateStr,
            note: `${activeSessionModal.hourType} Season session`,
          }),
        });
      } else {
        await fetch('/api/developer/adjust-hours', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: activeSessionModal.student.id,
            minutes: diffMinutes,
            date: activeSessionModal.dateStr,
            note: `${activeSessionModal.hourType} Season session`,
          }),
        });
      }

      setActiveSessionModal(null);
      void fetchStudents();
      void fetchEntries();
    } catch {
      // ignore
    }
  };

  // Delete current session entry
  const handleDeleteSession = async (): Promise<void> => {
    if (!activeSessionModal?.entryId) {
      setActiveSessionModal(null);
      return;
    }

    try {
      await fetch(`/api/developer/entries/${activeSessionModal.entryId}`, { method: 'DELETE' });
      setActiveSessionModal(null);
      void fetchStudents();
      void fetchEntries();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full select-none text-zinc-100 p-6 overflow-hidden">
      {/* Top Action Bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-700 font-mono text-xs transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>← Back to Student Attendance</span>
        </button>

        {onGoToLeaderboard && (
          <button
            type="button"
            onClick={onGoToLeaderboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-800 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 font-mono text-xs transition-colors"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Hours Leaderboard</span>
          </button>
        )}

        <a
          href="/api/developer/export-csv"
          download
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#27272a] bg-[#1c1c1f] text-zinc-300 hover:text-white font-mono text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Spreadsheet (CSV)</span>
        </a>

        <button
          type="button"
          onClick={() => setIsAddStudentOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#27272a] bg-[#1c1c1f] text-zinc-300 hover:text-white font-mono text-xs transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Student</span>
        </button>

        <button
          type="button"
          onClick={() => alert('New date column added to attendance sheet.')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#27272a] bg-[#1c1c1f] text-zinc-300 hover:text-white font-mono text-xs transition-colors"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>Add Date</span>
        </button>

        <button
          type="button"
          onClick={handleDeleteSelected}
          disabled={selectedStudentIds.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-rose-900/60 bg-rose-950/20 text-rose-400 hover:bg-rose-950/50 disabled:opacity-30 font-mono text-xs transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete {selectedStudentIds.length} Students</span>
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-800 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 font-mono text-xs transition-colors ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Main Spreadsheet Table Card */}
      <div className="flex-1 bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-2xl overflow-hidden flex flex-col relative">
        {/* Table Filter Status Header */}
        <div className="px-4 py-2.5 border-b border-[#27272a] bg-[#151518] flex items-center justify-between text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Attendance Editor Table</span>
            <span>•</span>
            <span>
              Showing <strong className="text-white">{filteredAndSortedStudents.length}</strong> of{' '}
              <strong className="text-white">{students.length}</strong> students
            </span>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-[11px]">Column filters active</span>
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

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              {/* Group Header Row */}
              <tr className="border-b border-[#27272a] bg-[#151518] text-zinc-500 font-medium text-[11px]">
                <th className="py-2 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedStudentIds.length === filteredAndSortedStudents.length &&
                      filteredAndSortedStudents.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="accent-zinc-400 rounded"
                  />
                </th>
                <th colSpan={2} className="py-2 px-4">
                  Student Info &gt;
                </th>
                <th colSpan={2} className="py-2 px-4">
                  Hours
                </th>
                <th className="py-2 px-4 text-right">
                  Totals &gt;
                </th>
              </tr>

              {/* Sub Columns Row with Sorting Buttons */}
              <tr className="border-b border-[#27272a] bg-[#121214] text-zinc-400 font-normal">
                <th className="py-2.5 px-4 w-10"></th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Student Name</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('id')}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    {renderSortIcon('id')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('today')}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Today ({todayStr.slice(5)})</span>
                    {renderSortIcon('today')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('yesterday')}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Yesterday ({yesterdayStr.slice(5)})</span>
                    {renderSortIcon('yesterday')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('total')}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Hours</span>
                    {renderSortIcon('total')}
                  </div>
                </th>
              </tr>

              {/* Row 3: Per-Column Filter Inputs & Dropdowns */}
              <tr className="border-b border-[#27272a] bg-[#151518]/90">
                <th className="py-2 px-4 w-10 text-center">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      title="Clear all filters"
                      className="text-rose-400 hover:text-white text-[11px]"
                    >
                      ✕
                    </button>
                  ) : (
                    <Search className="w-3 h-3 text-zinc-600 mx-auto" />
                  )}
                </th>

                {/* 1. Name Filter */}
                <th className="py-2 px-4">
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

                {/* 2. ID Filter */}
                <th className="py-2 px-4">
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

                {/* 3. Today Filter */}
                <th className="py-2 px-4">
                  <select
                    value={filterToday}
                    onChange={(e) =>
                      setFilterToday(e.target.value as 'all' | 'has_hours' | 'active' | 'no_hours')
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="has_hours">Has Hours</option>
                    <option value="active">Ongoing</option>
                    <option value="no_hours">No Hours</option>
                  </select>
                </th>

                {/* 4. Yesterday Filter */}
                <th className="py-2 px-4">
                  <select
                    value={filterYesterday}
                    onChange={(e) =>
                      setFilterYesterday(e.target.value as 'all' | 'has_hours' | 'no_hours')
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="has_hours">Has Hours</option>
                    <option value="no_hours">No Hours</option>
                  </select>
                </th>

                {/* 5. Total Hours Filter */}
                <th className="py-2 px-4 text-right">
                  <select
                    value={filterTotalHours}
                    onChange={(e) =>
                      setFilterTotalHours(
                        e.target.value as 'all' | 'gt_0' | 'gte_5' | 'gte_10' | 'gte_20'
                      )
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All Hours</option>
                    <option value="gt_0">&gt; 0 Hours</option>
                    <option value="gte_5">≥ 5 Hours</option>
                    <option value="gte_10">≥ 10 Hours</option>
                    <option value="gte_20">≥ 20 Hours</option>
                  </select>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#27272a] text-zinc-300">
              {filteredAndSortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    {students.length === 0 ? (
                      'No students found. Click "Add Student" above.'
                    ) : (
                      <div>
                        <div>No students match the current column filters.</div>
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="mt-2 text-cyan-400 hover:underline"
                        >
                          Reset all column filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAndSortedStudents.map((student) => {
                  const todayEntry = entries.find(
                    (e) => e.studentId === student.id && e.date === todayStr
                  );
                  const yestEntry = entries.find(
                    (e) => e.studentId === student.id && e.date === yesterdayStr
                  );

                  const isChecked = selectedStudentIds.includes(student.id);
                  const totalHrs = (student.totalMinutes / 60).toFixed(1);

                  return (
                    <tr key={student.id} className="hover:bg-zinc-850/40 transition-colors">
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectStudent(student.id)}
                          className="accent-zinc-400 rounded"
                        />
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-white">
                        {student.name}
                      </td>

                      {/* ID */}
                      <td className="py-3 px-4 text-zinc-400">
                        {student.id}
                      </td>

                      {/* Today's Hours */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              todayEntry?.status === 'active'
                                ? 'text-emerald-400 font-bold animate-pulse'
                                : todayEntry
                                ? 'text-zinc-200'
                                : 'text-zinc-500'
                            }
                          >
                            {todayEntry?.status === 'active'
                              ? 'Ongoing'
                              : todayEntry
                              ? `${((todayEntry.durationMinutes || 0) / 60).toFixed(1)} Hours`
                              : 'No data'}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditSession(student, todayStr)}
                            className="p-1 text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                            title="Edit session"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Yesterday's Hours */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={yestEntry ? 'text-zinc-200' : 'text-zinc-500'}>
                            {yestEntry
                              ? `${((yestEntry.durationMinutes || 0) / 60).toFixed(1)} Hours`
                              : 'No data'}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditSession(student, yesterdayStr)}
                            className="p-1 text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                            title="Edit session"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Accumulated Total Hours */}
                      <td className="py-3 px-4 text-right font-bold text-white text-sm">
                        {totalHrs} Hours
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SESSION EDIT MODAL POPUP (Matching sc-editor-censored.png) */}
      {/* ======================================================== */}
      {activeSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-2xl p-6 space-y-6 font-mono">
            {/* Header: Delete Button on left, Total on right, Close X */}
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <button
                type="button"
                onClick={handleDeleteSession}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-950 text-rose-400 text-xs border border-rose-900 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-zinc-200 font-bold text-sm">
                  {(activeSessionModal.durationMinutes / 60).toFixed(2)} Hours
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSessionModal(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Hour Type Segmented Buttons */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                Hour Type
              </label>
              <div className="grid grid-cols-4 gap-1 bg-[#121214] p-1 rounded-xl border border-[#27272a] text-xs">
                {(['Build', 'Learning', 'Outreach', 'Offseason'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setActiveSessionModal((prev) => (prev ? { ...prev, hourType: type } : null))
                    }
                    className={`py-2 rounded-lg font-medium transition-all ${
                      activeSessionModal.hourType === type
                        ? 'bg-white text-zinc-950 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Sign In Time Row matching screenshot */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                Sign In
              </label>
              <div className="flex items-center gap-2 bg-[#121214] p-3 rounded-xl border border-[#27272a]">
                <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <input
                  type="text"
                  maxLength={2}
                  value={editInHour}
                  onChange={(e) => setEditInHour(e.target.value)}
                  className="w-10 text-center bg-[#1c1c1f] border border-[#27272a] rounded py-1 text-white font-bold"
                />
                <span className="text-zinc-500">:</span>
                <input
                  type="text"
                  maxLength={2}
                  value={editInMin}
                  onChange={(e) => setEditInMin(e.target.value)}
                  className="w-10 text-center bg-[#1c1c1f] border border-[#27272a] rounded py-1 text-white font-bold"
                />
                <button
                  type="button"
                  onClick={() => setEditInAmPm((p) => (p === 'AM' ? 'PM' : 'AM'))}
                  className="px-2 py-1 rounded bg-[#1c1c1f] border border-[#27272a] text-xs text-zinc-300 font-bold ml-auto"
                >
                  {editInAmPm}
                </button>
              </div>
            </div>

            {/* Sign Out Time Row matching screenshot */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                Sign Out
              </label>
              <div className="flex items-center gap-2 bg-[#121214] p-3 rounded-xl border border-[#27272a]">
                <LogOut className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <input
                  type="text"
                  maxLength={2}
                  value={editOutHour}
                  onChange={(e) => setEditOutHour(e.target.value)}
                  className="w-10 text-center bg-[#1c1c1f] border border-[#27272a] rounded py-1 text-white font-bold"
                />
                <span className="text-zinc-500">:</span>
                <input
                  type="text"
                  maxLength={2}
                  value={editOutMin}
                  onChange={(e) => setEditOutMin(e.target.value)}
                  className="w-10 text-center bg-[#1c1c1f] border border-[#27272a] rounded py-1 text-white font-bold"
                />
                <button
                  type="button"
                  onClick={() => setEditOutAmPm((p) => (p === 'AM' ? 'PM' : 'AM'))}
                  className="px-2 py-1 rounded bg-[#1c1c1f] border border-[#27272a] text-xs text-zinc-300 font-bold ml-auto"
                >
                  {editOutAmPm}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveSessionModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#27272a] text-zinc-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSession}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-md"
              >
                Save Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD STUDENT */}
      {/* ======================================================== */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in font-mono">
          <div className="w-full max-w-sm bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Add New Student</h3>

            {addStudentError && (
              <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {addStudentError}
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. David Chen"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#121214] border border-[#27272a] text-white focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">5-Digit Student ID</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="e.g. 10106"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#121214] border border-[#27272a] text-white font-mono text-base focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-[#27272a] text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-white text-zinc-950 font-bold"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

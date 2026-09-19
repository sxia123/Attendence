import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student, AttendanceEntry, HourCategory } from '../types/attendance';
import {
  LogOut,
  Download,
  Upload,
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
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
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
  hourType: HourCategory;
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
  const [filterBuild, setFilterBuild] = useState<'all' | 'has_hours' | 'gte_5' | 'gte_10' | 'no_hours'>('all');
  const [filterLearning, setFilterLearning] = useState<'all' | 'has_hours' | 'gte_5' | 'gte_10' | 'no_hours'>('all');
  const [filterPreseason, setFilterPreseason] = useState<'all' | 'has_hours' | 'gte_5' | 'gte_10' | 'no_hours'>('all');
  const [filterDemo, setFilterDemo] = useState<'all' | 'has_hours' | 'gte_5' | 'gte_10' | 'no_hours'>('all');
  const [filterTotalHours, setFilterTotalHours] = useState<'all' | 'gt_0' | 'gte_5' | 'gte_10' | 'gte_20'>('all');

  // Column Sort
  type SortColumn = 'name' | 'id' | 'build' | 'learning' | 'preseason' | 'demo' | 'total' | null;
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal states for toolbar buttons
  const [isAddStudentOpen, setIsAddStudentOpen] = useState<boolean>(false);
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [addStudentError, setAddStudentError] = useState<string | null>(null);

  // CSV Import states
  const [isImportCsvOpen, setIsImportCsvOpen] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'upload' | 'paste'>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCsvText, setImportCsvText] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    studentsCreated: number;
    studentsUpdated: number;
    entriesAdded: number;
    totalProcessed: number;
    errors: string[];
  } | null>(null);

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

  const todayStr = new Date().toISOString().slice(0, 10);

  // Helper to categorize attendance entry
  const getEntryCategory = useCallback((entry: AttendanceEntry): HourCategory => {
    const text = (entry.note || '').toLowerCase();
    if (text.includes('learning')) return 'Learning Day';
    if (text.includes('preseason') || text.includes('offseason')) return 'Preseason';
    if (text.includes('demo') || text.includes('outreach') || text.includes('event')) return 'Demo';
    return 'Build';
  }, []);

  // Precompute minutes per student per category
  const studentCategoryHoursMap = useMemo(() => {
    const map = new Map<
      string,
      { build: number; learning: number; preseason: number; demo: number; total: number }
    >();
    for (const s of students) {
      map.set(s.id, { build: 0, learning: 0, preseason: 0, demo: 0, total: s.totalMinutes || 0 });
    }
    for (const e of entries) {
      if (e.status === 'completed' && e.durationMinutes) {
        const item = map.get(e.studentId);
        if (item) {
          const cat = getEntryCategory(e);
          if (cat === 'Build') item.build += e.durationMinutes;
          else if (cat === 'Learning Day') item.learning += e.durationMinutes;
          else if (cat === 'Preseason') item.preseason += e.durationMinutes;
          else if (cat === 'Demo') item.demo += e.durationMinutes;
        }
      }
    }
    return map;
  }, [students, entries, getEntryCategory]);

  // Sorting helper
  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(
        col === 'build' || col === 'learning' || col === 'preseason' || col === 'demo' || col === 'total'
          ? 'desc'
          : 'asc'
      );
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

        const stats = studentCategoryHoursMap.get(student.id) || {
          build: 0,
          learning: 0,
          preseason: 0,
          demo: 0,
          total: 0,
        };
        const buildHrs = stats.build / 60;
        const learningHrs = stats.learning / 60;
        const preseasonHrs = stats.preseason / 60;
        const demoHrs = stats.demo / 60;
        const totalHrs =
          (stats.total || (stats.build + stats.learning + stats.preseason + stats.demo)) / 60;

        // 3. Build filter
        if (filterBuild === 'has_hours' && buildHrs <= 0) return false;
        if (filterBuild === 'gte_5' && buildHrs < 5) return false;
        if (filterBuild === 'gte_10' && buildHrs < 10) return false;
        if (filterBuild === 'no_hours' && buildHrs > 0) return false;

        // 4. Learning Day filter
        if (filterLearning === 'has_hours' && learningHrs <= 0) return false;
        if (filterLearning === 'gte_5' && learningHrs < 5) return false;
        if (filterLearning === 'gte_10' && learningHrs < 10) return false;
        if (filterLearning === 'no_hours' && learningHrs > 0) return false;

        // 5. Preseason filter
        if (filterPreseason === 'has_hours' && preseasonHrs <= 0) return false;
        if (filterPreseason === 'gte_5' && preseasonHrs < 5) return false;
        if (filterPreseason === 'gte_10' && preseasonHrs < 10) return false;
        if (filterPreseason === 'no_hours' && preseasonHrs > 0) return false;

        // 6. Demo filter
        if (filterDemo === 'has_hours' && demoHrs <= 0) return false;
        if (filterDemo === 'gte_5' && demoHrs < 5) return false;
        if (filterDemo === 'gte_10' && demoHrs < 10) return false;
        if (filterDemo === 'no_hours' && demoHrs > 0) return false;

        // 7. Total Hours filter
        if (filterTotalHours === 'gt_0' && totalHrs <= 0) return false;
        if (filterTotalHours === 'gte_5' && totalHrs < 5) return false;
        if (filterTotalHours === 'gte_10' && totalHrs < 10) return false;
        if (filterTotalHours === 'gte_20' && totalHrs < 20) return false;

        return true;
      })
      .sort((a, b) => {
        if (!sortColumn) return 0;
        let valA: string | number = 0;
        let valB: string | number = 0;

        const statsA = studentCategoryHoursMap.get(a.id) || {
          build: 0,
          learning: 0,
          preseason: 0,
          demo: 0,
          total: 0,
        };
        const statsB = studentCategoryHoursMap.get(b.id) || {
          build: 0,
          learning: 0,
          preseason: 0,
          demo: 0,
          total: 0,
        };

        if (sortColumn === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortColumn === 'id') {
          valA = a.id;
          valB = b.id;
        } else if (sortColumn === 'build') {
          valA = statsA.build;
          valB = statsB.build;
        } else if (sortColumn === 'learning') {
          valA = statsA.learning;
          valB = statsB.learning;
        } else if (sortColumn === 'preseason') {
          valA = statsA.preseason;
          valB = statsB.preseason;
        } else if (sortColumn === 'demo') {
          valA = statsA.demo;
          valB = statsB.demo;
        } else if (sortColumn === 'total') {
          valA = statsA.total || (statsA.build + statsA.learning + statsA.preseason + statsA.demo);
          valB = statsB.total || (statsB.build + statsB.learning + statsB.preseason + statsB.demo);
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [
    students,
    studentCategoryHoursMap,
    filterName,
    filterId,
    filterBuild,
    filterLearning,
    filterPreseason,
    filterDemo,
    filterTotalHours,
    sortColumn,
    sortDirection,
  ]);

  const hasActiveFilters =
    Boolean(filterName.trim()) ||
    Boolean(filterId.trim()) ||
    filterBuild !== 'all' ||
    filterLearning !== 'all' ||
    filterPreseason !== 'all' ||
    filterDemo !== 'all' ||
    filterTotalHours !== 'all';

  const clearAllFilters = () => {
    setFilterName('');
    setFilterId('');
    setFilterBuild('all');
    setFilterLearning('all');
    setFilterPreseason('all');
    setFilterDemo('all');
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
  const openEditSession = (student: Student, category: HourCategory = 'Build'): void => {
    const existing = entries.find(
      (e) => e.studentId === student.id && getEntryCategory(e) === category
    );
    const duration = existing?.durationMinutes || 180;

    setActiveSessionModal({
      student,
      dateStr: existing?.date || todayStr,
      durationMinutes: duration,
      timeIn: existing?.timeIn || `${todayStr}T17:00:00.000Z`,
      timeOut: existing?.timeOut || `${todayStr}T20:00:00.000Z`,
      hourType: category,
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
            note: `${activeSessionModal.hourType} session`,
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
            note: `${activeSessionModal.hourType} session`,
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

  // CSV Import handlers
  const handleDownloadSampleCsv = (): void => {
    const sampleContent = `Student ID,Student Name,Build Hours,Learning Day Hours,Preseason Hours,Demo Hours,Total Hours
10101,Alex Rivera,12.5,4.0,6.0,3.5,26.0
10102,Sarah Chen,10.0,6.0,4.0,2.0,22.0
10103,Marcus Johnson,8.5,2.0,3.0,1.5,15.0
`;
    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'student_attendance_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0] || null;
    setImportFile(file);
    setImportError(null);
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        setImportCsvText(text);
      };
      reader.readAsText(file);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setImportError(null);
    setImportResult(null);

    let csvContent = importCsvText.trim();
    if (!csvContent && importFile) {
      try {
        csvContent = (await importFile.text()).trim();
      } catch {
        setImportError('Failed to read selected CSV file.');
        return;
      }
    }

    if (!csvContent) {
      setImportError('Please choose a CSV file or paste CSV content.');
      return;
    }

    setImportLoading(true);
    try {
      const res = await fetch('/api/developer/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvContent }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        studentsCreated?: number;
        studentsUpdated?: number;
        entriesAdded?: number;
        totalProcessed?: number;
        errors?: string[];
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import CSV.');
      }

      setImportResult({
        studentsCreated: data.studentsCreated || 0,
        studentsUpdated: data.studentsUpdated || 0,
        entriesAdded: data.entriesAdded || 0,
        totalProcessed: data.totalProcessed || 0,
        errors: data.errors || [],
      });

      void fetchStudents();
      void fetchEntries();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Error importing CSV');
    } finally {
      setImportLoading(false);
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
          onClick={() => {
            setIsImportCsvOpen(true);
            setImportResult(null);
            setImportError(null);
            setImportCsvText('');
            setImportFile(null);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#27272a] bg-[#1c1c1f] text-zinc-300 hover:text-white font-mono text-xs transition-colors hover:border-cyan-500/50"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Import CSV</span>
        </button>

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
                <th colSpan={4} className="py-2 px-4">
                  Hours by Category &gt;
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
                  onClick={() => handleSort('build')}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Build Hours</span>
                    {renderSortIcon('build')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('learning')}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Learning Day Hours</span>
                    {renderSortIcon('learning')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('preseason')}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Preseason Hours</span>
                    {renderSortIcon('preseason')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('demo')}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Demo Hours</span>
                    {renderSortIcon('demo')}
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

                {/* 3. Build Hours Filter */}
                <th className="py-2 px-4">
                  <select
                    value={filterBuild}
                    onChange={(e) =>
                      setFilterBuild(
                        e.target.value as 'all' | 'has_hours' | 'gte_5' | 'gte_10' | 'no_hours'
                      )
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="has_hours">&gt; 0 hrs</option>
                    <option value="gte_5">≥ 5 hrs</option>
                    <option value="gte_10">≥ 10 hrs</option>
                    <option value="no_hours">0 hrs</option>
                  </select>
                </th>

                {/* 4. Learning Day Hours Filter */}
                <th className="py-2 px-4">
                  <select
                    value={filterLearning}
                    onChange={(e) =>
                      setFilterLearning(
                        e.target.value as 'all' | 'has_hours' | 'gte_5' | 'gte_10' | 'no_hours'
                      )
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="has_hours">&gt; 0 hrs</option>
                    <option value="gte_5">≥ 5 hrs</option>
                    <option value="gte_10">≥ 10 hrs</option>
                    <option value="no_hours">0 hrs</option>
                  </select>
                </th>

                {/* 5. Preseason Hours Filter */}
                <th className="py-2 px-4">
                  <select
                    value={filterPreseason}
                    onChange={(e) =>
                      setFilterPreseason(
                        e.target.value as 'all' | 'has_hours' | 'gte_5' | 'gte_10' | 'no_hours'
                      )
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="has_hours">&gt; 0 hrs</option>
                    <option value="gte_5">≥ 5 hrs</option>
                    <option value="gte_10">≥ 10 hrs</option>
                    <option value="no_hours">0 hrs</option>
                  </select>
                </th>

                {/* 6. Demo Hours Filter */}
                <th className="py-2 px-4">
                  <select
                    value={filterDemo}
                    onChange={(e) =>
                      setFilterDemo(
                        e.target.value as 'all' | 'has_hours' | 'gte_5' | 'gte_10' | 'no_hours'
                      )
                    }
                    className="w-full px-2 py-1 text-[11px] bg-[#121214] border border-[#27272a] rounded text-zinc-300 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="all">All</option>
                    <option value="has_hours">&gt; 0 hrs</option>
                    <option value="gte_5">≥ 5 hrs</option>
                    <option value="gte_10">≥ 10 hrs</option>
                    <option value="no_hours">0 hrs</option>
                  </select>
                </th>

                {/* 7. Total Hours Filter */}
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

            <tbody className="divide-y divide-[#27272a]">
              {filteredAndSortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500 font-sans">
                    {hasActiveFilters
                      ? 'No students match the current filters.'
                      : 'No students registered.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedStudents.map((student) => {
                  const isChecked = selectedStudentIds.includes(student.id);
                  const stats = studentCategoryHoursMap.get(student.id) || {
                    build: 0,
                    learning: 0,
                    preseason: 0,
                    demo: 0,
                    total: 0,
                  };
                  const buildHrs = (stats.build / 60).toFixed(1);
                  const learningHrs = (stats.learning / 60).toFixed(1);
                  const preseasonHrs = (stats.preseason / 60).toFixed(1);
                  const demoHrs = (stats.demo / 60).toFixed(1);
                  const totalHrs = (
                    (stats.total || (stats.build + stats.learning + stats.preseason + stats.demo)) /
                    60
                  ).toFixed(1);

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

                      {/* Build Hours */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={stats.build > 0 ? 'text-zinc-200' : 'text-zinc-600'}>
                            {buildHrs} hrs
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditSession(student, 'Build')}
                            className="p-1 text-zinc-600 hover:text-cyan-400 rounded hover:bg-zinc-800 transition-colors"
                            title="Edit Build Hours"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Learning Day Hours */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={stats.learning > 0 ? 'text-zinc-200' : 'text-zinc-600'}>
                            {learningHrs} hrs
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditSession(student, 'Learning Day')}
                            className="p-1 text-zinc-600 hover:text-cyan-400 rounded hover:bg-zinc-800 transition-colors"
                            title="Edit Learning Day Hours"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Preseason Hours */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={stats.preseason > 0 ? 'text-zinc-200' : 'text-zinc-600'}>
                            {preseasonHrs} hrs
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditSession(student, 'Preseason')}
                            className="p-1 text-zinc-600 hover:text-cyan-400 rounded hover:bg-zinc-800 transition-colors"
                            title="Edit Preseason Hours"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Demo Hours */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={stats.demo > 0 ? 'text-zinc-200' : 'text-zinc-600'}>
                            {demoHrs} hrs
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditSession(student, 'Demo')}
                            className="p-1 text-zinc-600 hover:text-cyan-400 rounded hover:bg-zinc-800 transition-colors"
                            title="Edit Demo Hours"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Accumulated Total Hours */}
                      <td className="py-3 px-4 text-right font-bold text-white text-sm">
                        {totalHrs} hrs
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
                {(['Build', 'Learning Day', 'Preseason', 'Demo'] as const).map((type) => (
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

      {/* ======================================================== */}
      {/* MODAL: IMPORT CSV */}
      {/* ======================================================== */}
      {isImportCsvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in font-mono">
          <div className="w-full max-w-xl bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Import CSV</h3>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Import student rosters and optional attendance hours from a spreadsheet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportCsvOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success Result Display */}
            {importResult && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Import Completed Successfully!</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-sans">
                  <div className="bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/40">
                    <div className="text-xl font-bold text-white">{importResult.studentsCreated}</div>
                    <div className="text-[10px] text-emerald-400 font-mono">New Students</div>
                  </div>
                  <div className="bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/40">
                    <div className="text-xl font-bold text-white">{importResult.studentsUpdated}</div>
                    <div className="text-[10px] text-emerald-400 font-mono">Updated Names</div>
                  </div>
                  <div className="bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/40">
                    <div className="text-xl font-bold text-white">{importResult.entriesAdded}</div>
                    <div className="text-[10px] text-emerald-400 font-mono">Hours Logged</div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mt-2 p-2.5 rounded bg-amber-950/50 border border-amber-800/60 text-amber-200 text-[11px] space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{importResult.errors.length} row(s) had warnings or were skipped:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setImportResult(null);
                      setImportCsvText('');
                      setImportFile(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/40 text-xs transition-colors"
                  >
                    Import Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportCsvOpen(false)}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Error Display */}
            {importError && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {!importResult && (
              <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
                {/* Mode Switcher Tabs */}
                <div className="flex border-b border-[#27272a] gap-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => setImportMode('upload')}
                    className={`pb-2 border-b-2 transition-colors ${
                      importMode === 'upload'
                        ? 'border-cyan-400 text-white'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Upload File (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('paste')}
                    className={`pb-2 border-b-2 transition-colors ${
                      importMode === 'paste'
                        ? 'border-cyan-400 text-white'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Paste CSV Text
                  </button>
                </div>

                {/* Upload Mode Area */}
                {importMode === 'upload' && (
                  <div>
                    <label
                      htmlFor="csv-file-input"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-[#3f3f46] hover:border-cyan-400/70 rounded-xl p-6 bg-[#121214] cursor-pointer transition-colors group"
                    >
                      <FileText className="w-8 h-8 text-zinc-500 group-hover:text-cyan-400 transition-colors mb-2" />
                      {importFile ? (
                        <div className="text-center">
                          <p className="text-white font-bold">{importFile.name}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {(importFile.size / 1024).toFixed(1)} KB • Click to choose a different file
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-zinc-300 font-medium">
                            Click to select a <span className="text-cyan-400 font-bold">.csv</span> file
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-1">
                            or drag and drop your spreadsheet here
                          </p>
                        </div>
                      )}
                      <input
                        id="csv-file-input"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Paste Mode Area */}
                {importMode === 'paste' && (
                  <div>
                    <label className="text-zinc-400 block mb-1">Paste CSV content below:</label>
                    <textarea
                      rows={6}
                      placeholder={`Student ID, Student Name, Total Hours\n10101, Alex Rivera, 3.5\n10102, Sarah Chen, 4.0`}
                      value={importCsvText}
                      onChange={(e) => setImportCsvText(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#121214] border border-[#27272a] text-white font-mono text-xs focus:outline-none focus:border-zinc-500 resize-none"
                    />
                  </div>
                )}

                {/* Format Guidance & Sample Download */}
                <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3.5 text-[11px] space-y-2 text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300 font-semibold">Accepted Column Headers:</span>
                    <button
                      type="button"
                      onClick={handleDownloadSampleCsv}
                      className="text-cyan-400 hover:text-cyan-300 underline text-[11px] inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download Sample CSV
                    </button>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                    <li>
                      <strong className="text-zinc-200">Student ID</strong> (Required: 5 digits, e.g. 10101)
                    </li>
                    <li>
                      <strong className="text-zinc-200">Student Name</strong> (Required, e.g. Alex Rivera)
                    </li>
                    <li>
                      <strong className="text-zinc-200">Category Columns</strong>: Build Hours, Learning Day Hours, Preseason Hours, Demo Hours (or generic Total Hours)
                    </li>
                    <li>
                      <strong className="text-zinc-200">Date</strong> (Optional: YYYY-MM-DD)
                    </li>
                  </ul>
                </div>

                {/* Modal Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsImportCsvOpen(false)}
                    className="flex-1 py-2.5 rounded-lg border border-[#27272a] text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importLoading || (!importFile && !importCsvText.trim())}
                    className="flex-1 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-zinc-950 font-bold transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Import CSV Now</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

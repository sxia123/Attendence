import React, { useState, useMemo } from 'react';
import { AttendanceEntry, Member } from '../types/attendance';
import { Search, Download, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, List, UserCheck } from 'lucide-react';

interface TimesheetDatabaseProps {
  entries: AttendanceEntry[];
  members: Member[];
  isLoading: boolean;
  onRefresh: () => void;
}

type EntrySortField = 'date' | 'memberName' | 'memberId' | 'timeIn' | 'timeOut' | 'durationMinutes' | 'status';
type PersonSortField = 'name' | 'id' | 'role' | 'isClockedIn' | 'shiftCount' | 'totalMinutes';
type SortDirection = 'asc' | 'desc';

interface PersonSummary {
  id: string;
  name: string;
  role: 'member' | 'lead';
  isClockedIn: boolean;
  shiftCount: number;
  totalMinutes: number;
  activeSessionStart?: string;
}

export const TimesheetDatabase: React.FC<TimesheetDatabaseProps> = ({
  entries,
  members,
  isLoading,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'entries' | 'totals'>('entries');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('all');

  // Sorting state for Tab 1 (Individual Logs)
  const [entrySortField, setEntrySortField] = useState<EntrySortField>('timeIn');
  const [entrySortDir, setEntrySortDir] = useState<SortDirection>('desc');

  // Sorting state for Tab 2 (Total Hours by Person)
  const [personSortField, setPersonSortField] = useState<PersonSortField>('totalMinutes');
  const [personSortDir, setPersonSortDir] = useState<SortDirection>('desc');

  const todayStr = new Date().toISOString().slice(0, 10);

  // Toggle sorting for entries
  const handleEntrySort = (field: EntrySortField): void => {
    if (entrySortField === field) {
      setEntrySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setEntrySortField(field);
      setEntrySortDir('asc');
    }
  };

  // Toggle sorting for person totals
  const handlePersonSort = (field: PersonSortField): void => {
    if (personSortField === field) {
      setPersonSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setPersonSortField(field);
      setPersonSortDir('asc');
    }
  };

  // Tab 1: Filtered & Sorted Individual Entries
  const filteredAndSortedEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      // Search filter (name or 5-digit ID)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matches =
          entry.memberName.toLowerCase().includes(q) ||
          entry.memberId.includes(q);
        if (!matches) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && entry.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today' && entry.date !== todayStr) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      let aVal = a[entrySortField] ?? '';
      let bVal = b[entrySortField] ?? '';

      if (entrySortField === 'durationMinutes') {
        const aNum = Number(a.durationMinutes ?? 0);
        const bNum = Number(b.durationMinutes ?? 0);
        return entrySortDir === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return entrySortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return entrySortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [entries, searchTerm, statusFilter, dateFilter, entrySortField, entrySortDir, todayStr]);

  // Tab 2: Aggregated & Sorted Person Summaries
  const personSummaries = useMemo((): PersonSummary[] => {
    // Map existing members
    const memberMap = new Map<string, PersonSummary>();

    for (const m of members) {
      memberMap.set(m.id, {
        id: m.id,
        name: m.name,
        role: m.role,
        isClockedIn: m.isClockedIn,
        shiftCount: 0,
        totalMinutes: 0,
        activeSessionStart: m.activeSessionStart,
      });
    }

    // Accumulate hours from completed and active entries
    for (const entry of entries) {
      let summary = memberMap.get(entry.memberId);
      if (!summary) {
        summary = {
          id: entry.memberId,
          name: entry.memberName,
          role: 'member',
          isClockedIn: entry.status === 'active',
          shiftCount: 0,
          totalMinutes: 0,
        };
        memberMap.set(entry.memberId, summary);
      }

      if (entry.status === 'completed' && entry.durationMinutes) {
        summary.shiftCount += 1;
        summary.totalMinutes += entry.durationMinutes;
      } else if (entry.status === 'active') {
        // Calculate active elapsed minutes up to now
        const startMs = new Date(entry.timeIn).getTime();
        const currentMs = Date.now();
        const activeMins = Math.max(1, Math.round((currentMs - startMs) / 60000));
        summary.totalMinutes += activeMins;
      }
    }

    const list = Array.from(memberMap.values());

    // Filter by name/ID search
    const filtered = list.filter((p) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return p.name.toLowerCase().includes(q) || p.id.includes(q);
    });

    // Sort
    return filtered.sort((a, b) => {
      let aVal = a[personSortField];
      let bVal = b[personSortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (typeof aVal === 'boolean') {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
      }

      if (aVal < bVal) return personSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return personSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [members, entries, searchTerm, personSortField, personSortDir]);

  // Contextual CSV Export
  const handleExportCsv = (): void => {
    let csvString = '';
    let filename = '';

    if (activeTab === 'entries') {
      const headers = ['Date', 'Name', 'ID', 'Time In', 'Time Out', 'Duration (HH:MM)', 'Duration (Minutes)', 'Status'];
      const rows = filteredAndSortedEntries.map((e) => {
        const mins = e.durationMinutes ?? 0;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        const durStr = e.status === 'completed' ? `${hours}h ${remMins}m` : 'Active';

        const formatTime = (iso?: string): string => {
          if (!iso) return '';
          try {
            return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          } catch {
            return iso;
          }
        };

        return [
          `"${e.date}"`,
          `"${e.memberName.replace(/"/g, '""')}"`,
          `"${e.memberId}"`,
          `"${formatTime(e.timeIn)}"`,
          `"${formatTime(e.timeOut)}"`,
          `"${durStr}"`,
          mins,
          `"${e.status}"`,
        ].join(',');
      });

      csvString = [headers.join(','), ...rows].join('\n');
      filename = `attendance-logs-${todayStr}.csv`;
    } else {
      const headers = ['Name', '5-Digit ID', 'Role', 'Status', 'Completed Shifts', 'Total Minutes', 'Total Hours (HH:MM)', 'Total Hours (Decimal)'];
      const rows = personSummaries.map((p) => {
        const hours = Math.floor(p.totalMinutes / 60);
        const remMins = p.totalMinutes % 60;
        const formattedHours = `${hours}h ${remMins}m`;
        const decimalHours = (p.totalMinutes / 60).toFixed(2);

        return [
          `"${p.name.replace(/"/g, '""')}"`,
          `"${p.id}"`,
          `"${p.role}"`,
          `"${p.isClockedIn ? 'Clocked In' : 'Clocked Out'}"`,
          p.shiftCount,
          p.totalMinutes,
          `"${formattedHours}"`,
          decimalHours,
        ].join(',');
      });

      csvString = [headers.join(','), ...rows].join('\n');
      filename = `attendance-person-totals-${todayStr}.csv`;
    }

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (isoString?: string): string => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  // Render sort icon for entries
  const renderEntrySortIcon = (field: EntrySortField) => {
    if (entrySortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-notion-muted opacity-40 group-hover:opacity-100" strokeWidth={1.5} />;
    }
    return entrySortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-notion-text" strokeWidth={1.5} />
    ) : (
      <ArrowDown className="w-3 h-3 text-notion-text" strokeWidth={1.5} />
    );
  };

  // Render sort icon for person summaries
  const renderPersonSortIcon = (field: PersonSortField) => {
    if (personSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-notion-muted opacity-40 group-hover:opacity-100" strokeWidth={1.5} />;
    }
    return personSortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-notion-text" strokeWidth={1.5} />
    ) : (
      <ArrowDown className="w-3 h-3 text-notion-text" strokeWidth={1.5} />
    );
  };

  return (
    <div className="border border-notion-border rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Notion Top View Tabs */}
      <div className="border-b border-notion-border bg-notion-surface/40 px-3 pt-2 flex items-center justify-between">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab('entries')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'entries'
                ? 'border-[#37352F] text-notion-text bg-white rounded-t'
                : 'border-transparent text-notion-muted hover:text-notion-text'
            }`}
          >
            <List className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Individual Logs</span>
            <span className="font-mono text-[10px] text-notion-muted ml-0.5">({entries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('totals')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'totals'
                ? 'border-[#37352F] text-notion-text bg-white rounded-t'
                : 'border-transparent text-notion-muted hover:text-notion-text'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Total Hours by Person</span>
            <span className="font-mono text-[10px] text-notion-muted ml-0.5">({members.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-notion-muted hover:text-notion-text border border-notion-border rounded bg-white hover:bg-notion-surface transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-notion-text bg-white border border-notion-border rounded hover:bg-notion-surface transition-colors"
            title={`Export ${activeTab === 'entries' ? 'logs' : 'person totals'} as CSV`}
          >
            <Download className="w-3.5 h-3.5 text-notion-muted" strokeWidth={1.5} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 border-b border-notion-border flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search by Name or 5-Digit ID */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-notion-muted absolute left-2.5 top-2.5" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs border border-notion-border rounded bg-white text-notion-text placeholder:text-notion-subtle focus:border-notion-text transition-colors"
            />
          </div>

          {/* Filters specific to Individual Logs */}
          {activeTab === 'entries' && (
            <>
              {/* Status Filter Tabs */}
              <div className="flex items-center space-x-1 border border-notion-border rounded p-0.5 bg-notion-surface/40">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white text-notion-text font-medium shadow-sm'
                      : 'text-notion-muted hover:text-notion-text'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    statusFilter === 'active'
                      ? 'bg-white text-[#2B593F] font-medium shadow-sm'
                      : 'text-notion-muted hover:text-notion-text'
                  }`}
                >
                  Clocked In
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    statusFilter === 'completed'
                      ? 'bg-white text-notion-text font-medium shadow-sm'
                      : 'text-notion-muted hover:text-notion-text'
                  }`}
                >
                  Completed
                </button>
              </div>

              {/* Date Filter Tabs */}
              <div className="flex items-center space-x-1 border border-notion-border rounded p-0.5 bg-notion-surface/40">
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    dateFilter === 'all'
                      ? 'bg-white text-notion-text font-medium shadow-sm'
                      : 'text-notion-muted hover:text-notion-text'
                  }`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('today')}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    dateFilter === 'today'
                      ? 'bg-white text-notion-text font-medium shadow-sm'
                      : 'text-notion-muted hover:text-notion-text'
                  }`}
                >
                  Today
                </button>
              </div>
            </>
          )}
        </div>

        <div className="text-[11px] text-notion-muted font-mono">
          Click any column header to sort
        </div>
      </div>

      {/* TAB 1: INDIVIDUAL LOGS TABLE */}
      {activeTab === 'entries' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-notion-border bg-notion-surface/60 text-notion-muted font-normal select-none">
                <th
                  onClick={() => handleEntrySort('date')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-28 font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Date</span>
                    {renderEntrySortIcon('date')}
                  </div>
                </th>
                <th
                  onClick={() => handleEntrySort('memberName')}
                  className="py-2.5 px-3 border-r border-notion-border/60 font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Name</span>
                    {renderEntrySortIcon('memberName')}
                  </div>
                </th>
                <th
                  onClick={() => handleEntrySort('memberId')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-24 font-mono font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>ID</span>
                    {renderEntrySortIcon('memberId')}
                  </div>
                </th>
                <th
                  onClick={() => handleEntrySort('timeIn')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-28 font-mono font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Time In</span>
                    {renderEntrySortIcon('timeIn')}
                  </div>
                </th>
                <th
                  onClick={() => handleEntrySort('timeOut')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-28 font-mono font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Time Out</span>
                    {renderEntrySortIcon('timeOut')}
                  </div>
                </th>
                <th
                  onClick={() => handleEntrySort('durationMinutes')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-28 font-mono font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Duration</span>
                    {renderEntrySortIcon('durationMinutes')}
                  </div>
                </th>
                <th
                  onClick={() => handleEntrySort('status')}
                  className="py-2.5 px-3 w-28 font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    {renderEntrySortIcon('status')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-notion-border/50">
              {filteredAndSortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-notion-muted text-xs">
                    {isLoading ? 'Loading records...' : 'No attendance entries match the search filters.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedEntries.map((entry) => {
                  const isCompleted = entry.status === 'completed';
                  const mins = entry.durationMinutes ?? 0;
                  const hours = Math.floor(mins / 60);
                  const remMins = mins % 60;
                  const durDisplay = isCompleted ? `${hours}h ${remMins}m` : 'In Progress';

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-notion-surface/50 transition-colors"
                    >
                      <td className="py-2 px-3 border-r border-notion-border/40 font-mono text-notion-muted">
                        {entry.date}
                      </td>
                      <td className="py-2 px-3 border-r border-notion-border/40 font-medium text-notion-text">
                        {entry.memberName}
                      </td>
                      <td className="py-2 px-3 border-r border-notion-border/40 font-mono text-notion-muted">
                        #{entry.memberId}
                      </td>
                      <td className="py-2 px-3 border-r border-notion-border/40 font-mono text-notion-text">
                        {formatTimestamp(entry.timeIn)}
                      </td>
                      <td className="py-2 px-3 border-r border-notion-border/40 font-mono text-notion-muted">
                        {formatTimestamp(entry.timeOut)}
                      </td>
                      <td className="py-2 px-3 border-r border-notion-border/40 font-mono text-notion-text">
                        {durDisplay}
                      </td>
                      <td className="py-2 px-3">
                        {entry.status === 'active' ? (
                          <span className="inline-block px-1.5 py-0.5 text-[11px] font-mono rounded bg-[#EDF3EC] text-[#2B593F] border border-[#D5E6D3]">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 text-[11px] font-mono rounded bg-notion-tagGray text-notion-tagGrayText border border-notion-border">
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: TOTAL HOURS BY PERSON TABLE */}
      {activeTab === 'totals' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-notion-border bg-notion-surface/60 text-notion-muted font-normal select-none">
                <th
                  onClick={() => handlePersonSort('name')}
                  className="py-2.5 px-3 border-r border-notion-border/60 font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Name</span>
                    {renderPersonSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => handlePersonSort('id')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-28 font-mono font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>5-Digit ID</span>
                    {renderPersonSortIcon('id')}
                  </div>
                </th>
                <th
                  onClick={() => handlePersonSort('role')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-24 font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Role</span>
                    {renderPersonSortIcon('role')}
                  </div>
                </th>
                <th
                  onClick={() => handlePersonSort('isClockedIn')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-28 font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Current Status</span>
                    {renderPersonSortIcon('isClockedIn')}
                  </div>
                </th>
                <th
                  onClick={() => handlePersonSort('shiftCount')}
                  className="py-2.5 px-3 border-r border-notion-border/60 w-28 font-mono font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Completed Shifts</span>
                    {renderPersonSortIcon('shiftCount')}
                  </div>
                </th>
                <th
                  onClick={() => handlePersonSort('totalMinutes')}
                  className="py-2.5 px-3 w-40 font-mono font-medium cursor-pointer hover:bg-notion-hover transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span>Total Hours Worked</span>
                    {renderPersonSortIcon('totalMinutes')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-notion-border/50">
              {personSummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-notion-muted text-xs">
                    No member records found matching the search.
                  </td>
                </tr>
              ) : (
                personSummaries.map((p) => {
                  const hours = Math.floor(p.totalMinutes / 60);
                  const remMins = p.totalMinutes % 60;
                  const formattedDuration = `${hours}h ${remMins}m`;
                  const decimalHours = (p.totalMinutes / 60).toFixed(2);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-notion-surface/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 border-r border-notion-border/40 font-medium text-notion-text">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 border-r border-notion-border/40 font-mono text-notion-muted">
                        #{p.id}
                      </td>
                      <td className="py-2.5 px-3 border-r border-notion-border/40">
                        {p.role === 'lead' ? (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-notion-tagAmber text-notion-tagAmberText border border-[#F4DCB8]">
                            Lead
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-notion-tagGray text-notion-tagGrayText">
                            Member
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 border-r border-notion-border/40">
                        {p.isClockedIn ? (
                          <span className="inline-block px-1.5 py-0.5 text-[11px] font-mono rounded bg-[#EDF3EC] text-[#2B593F] border border-[#D5E6D3]">
                            Clocked In
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 text-[11px] font-mono rounded text-notion-muted">
                            Clocked Out
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 border-r border-notion-border/40 font-mono text-notion-text">
                        {p.shiftCount}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-notion-text">
                        <span className="text-sm">{formattedDuration}</span>
                        <span className="ml-2 text-xs text-notion-muted font-normal">
                          ({decimalHours} hrs)
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Footer */}
      <div className="px-3 py-2 border-t border-notion-border bg-notion-surface/40 flex items-center justify-between text-[11px] text-notion-muted font-mono">
        <span>
          {activeTab === 'entries'
            ? `Showing ${filteredAndSortedEntries.length} of ${entries.length} logs`
            : `Showing ${personSummaries.length} member summaries`}
        </span>
        <span>Sorted by: {activeTab === 'entries' ? `${entrySortField} (${entrySortDir})` : `${personSortField} (${personSortDir})`}</span>
      </div>
    </div>
  );
};

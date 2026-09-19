import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { db, initDb } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database
initDb().catch((err: unknown) => {
  process.stderr.write(`Fatal DB error: ${err instanceof Error ? err.message : String(err)}\n`);
});

// Helper: Get developer passcode from DB or environment
async function getDeveloperCode(): Promise<string> {
  try {
    const res = await db.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['lead_pin'],
    });
    if (res.rows.length > 0 && res.rows[0]?.value) {
      return String(res.rows[0].value).trim();
    }
  } catch {
    // fallback below
  }
  return (process.env.DEVELOPER_PASSCODE || process.env.LEAD_PIN || '9999').trim();
}

// ==========================================
// 1. STUDENT KIOSK ENDPOINTS (SIMPLE & FAST)
// ==========================================

// POST /api/punch - Sign In or Sign Out with 5-digit Student ID
app.post('/api/punch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.body as { id?: string };
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Please enter your 5-digit Student ID.' });
      return;
    }

    const cleanId = id.trim();
    if (!/^\d{5}$/.test(cleanId)) {
      res.status(400).json({ error: 'Student ID must be exactly 5 numbers.' });
      return;
    }

    // Look up student
    const studentResult = await db.execute({
      sql: 'SELECT id, name, is_clocked_in, active_session_start FROM members WHERE id = ?',
      args: [cleanId],
    });

    if (studentResult.rows.length === 0) {
      res.status(404).json({
        error: `Student ID "${cleanId}" was not found. Please ask your teacher or administrator to add you.`,
      });
      return;
    }

    const student = studentResult.rows[0];
    const isClockedIn = Boolean(student.is_clocked_in);
    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.slice(0, 10); // YYYY-MM-DD

    if (!isClockedIn) {
      // -----------------
      // SIGN IN (Clock In)
      // -----------------
      const entryId = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO attendance_entries (id, member_id, member_name, date, time_in, status) VALUES (?, ?, ?, ?, ?, ?)',
        args: [entryId, cleanId, String(student.name), dateStr, nowIso, 'active'],
      });

      await db.execute({
        sql: 'UPDATE members SET is_clocked_in = 1, active_session_start = ? WHERE id = ?',
        args: [nowIso, cleanId],
      });

      res.json({
        action: 'clock_in',
        student: {
          id: cleanId,
          name: String(student.name),
        },
        timeIn: nowIso,
      });
    } else {
      // ------------------
      // SIGN OUT (Clock Out)
      // ------------------
      const activeEntryResult = await db.execute({
        sql: "SELECT id, time_in FROM attendance_entries WHERE member_id = ? AND status = 'active' ORDER BY time_in DESC LIMIT 1",
        args: [cleanId],
      });

      const startTime = activeEntryResult.rows[0]?.time_in
        ? String(activeEntryResult.rows[0].time_in)
        : String(student.active_session_start || nowIso);

      const startMs = new Date(startTime).getTime();
      const endMs = now.getTime();
      // Calculate duration in minutes (minimum 1 minute)
      const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

      if (activeEntryResult.rows.length > 0 && activeEntryResult.rows[0]?.id) {
        await db.execute({
          sql: "UPDATE attendance_entries SET time_out = ?, duration_minutes = ?, status = 'completed' WHERE id = ?",
          args: [nowIso, durationMinutes, String(activeEntryResult.rows[0].id)],
        });
      } else {
        const entryId = crypto.randomUUID();
        await db.execute({
          sql: "INSERT INTO attendance_entries (id, member_id, member_name, date, time_in, time_out, duration_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')",
          args: [entryId, cleanId, String(student.name), dateStr, startTime, nowIso, durationMinutes],
        });
      }

      await db.execute({
        sql: 'UPDATE members SET is_clocked_in = 0, active_session_start = NULL WHERE id = ?',
        args: [cleanId],
      });

      const hours = Math.floor(durationMinutes / 60);
      const remainingMinutes = durationMinutes % 60;
      const durationFormatted = hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;

      res.json({
        action: 'clock_out',
        student: {
          id: cleanId,
          name: String(student.name),
        },
        timeIn: startTime,
        timeOut: nowIso,
        durationMinutes,
        durationFormatted,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record attendance.' });
  }
});

// ==========================================
// 2. DEVELOPER / CREATOR / ADMIN ENDPOINTS
// ==========================================

// POST /api/developer/verify - Check developer passcode
app.post('/api/developer/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ error: 'Please enter the developer code.' });
      return;
    }

    const expectedCode = await getDeveloperCode();
    if (code.trim() !== expectedCode) {
      res.status(401).json({ error: 'Incorrect developer code. Access denied.' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Verification failed' });
  }
});

// GET /api/developer/students - Get all students with accumulated total hours across all days
app.get('/api/developer/students', async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Fetch all students
    const studentsResult = await db.execute('SELECT id, name, is_clocked_in, active_session_start FROM members ORDER BY name ASC');

    // 2. Sum completed attendance duration_minutes for each student across all days
    const totalsResult = await db.execute(`
      SELECT member_id, SUM(duration_minutes) as total_minutes, COUNT(*) as sessions_count
      FROM attendance_entries
      WHERE status = 'completed' AND duration_minutes IS NOT NULL
      GROUP BY member_id
    `);

    const totalsMap = new Map<string, { totalMinutes: number; sessionsCount: number }>();
    for (const row of totalsResult.rows) {
      totalsMap.set(String(row.member_id), {
        totalMinutes: Number(row.total_minutes || 0),
        sessionsCount: Number(row.sessions_count || 0),
      });
    }

    const students = studentsResult.rows.map((row) => {
      const studentId = String(row.id);
      const studentTotal = totalsMap.get(studentId) || { totalMinutes: 0, sessionsCount: 0 };
      const mins = studentTotal.totalMinutes;
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      const totalHoursFormatted = `${hours}h ${remMins}m`;

      return {
        id: studentId,
        name: String(row.name),
        isClockedIn: Boolean(row.is_clocked_in),
        activeSessionStart: row.active_session_start ? String(row.active_session_start) : undefined,
        totalMinutes: mins,
        totalHoursFormatted,
        sessionsCount: studentTotal.sessionsCount,
      };
    });

    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch students' });
  }
});

// POST /api/developer/students - Add a new student
app.post('/api/developer/students', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name } = req.body as { id?: string; name?: string };

    if (!id || !/^\d{5}$/.test(id.trim())) {
      res.status(400).json({ error: 'Student ID must be exactly 5 digits (for example: 10402).' });
      return;
    }

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Please provide the student’s name.' });
      return;
    }

    const cleanId = id.trim();
    const cleanName = name.trim();

    // Check if ID already exists
    const existing = await db.execute({
      sql: 'SELECT id, name FROM members WHERE id = ?',
      args: [cleanId],
    });

    if (existing.rows.length > 0) {
      res.status(409).json({ error: `A student with ID ${cleanId} already exists (${existing.rows[0]?.name}).` });
      return;
    }

    await db.execute({
      sql: 'INSERT INTO members (id, name, role, is_clocked_in) VALUES (?, ?, ?, 0)',
      args: [cleanId, cleanName, 'member'],
    });

    res.status(201).json({
      id: cleanId,
      name: cleanName,
      isClockedIn: false,
      totalMinutes: 0,
      totalHoursFormatted: '0h 0m',
      sessionsCount: 0,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to add student.' });
  }
});

// DELETE /api/developer/students/:id - Remove a student
app.delete('/api/developer/students/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: 'DELETE FROM attendance_entries WHERE member_id = ?',
      args: [id],
    });
    await db.execute({
      sql: 'DELETE FROM members WHERE id = ?',
      args: [id],
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete student.' });
  }
});

// GET /api/developer/entries - Get attendance log entries
app.get('/api/developer/entries', async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, date } = req.query as { studentId?: string; date?: string };

    let query = 'SELECT id, member_id, member_name, date, time_in, time_out, duration_minutes, status, note FROM attendance_entries WHERE 1=1';
    const args: string[] = [];

    if (studentId && studentId.trim() !== '') {
      query += ' AND member_id = ?';
      args.push(studentId.trim());
    }

    if (date && date.trim() !== '') {
      query += ' AND date = ?';
      args.push(date.trim());
    }

    query += ' ORDER BY time_in DESC LIMIT 500';

    const result = await db.execute({ sql: query, args });

    const entries = result.rows.map((row) => ({
      id: String(row.id),
      studentId: String(row.member_id),
      studentName: String(row.member_name),
      date: String(row.date),
      timeIn: String(row.time_in),
      timeOut: row.time_out ? String(row.time_out) : undefined,
      durationMinutes: row.duration_minutes !== null ? Number(row.duration_minutes) : undefined,
      status: String(row.status) as 'active' | 'completed',
      note: row.note ? String(row.note) : undefined,
    }));

    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch attendance history.' });
  }
});

// POST /api/developer/adjust-hours - Add or change hours for a student
app.post('/api/developer/adjust-hours', async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, minutes, date, note } = req.body as {
      studentId?: string;
      minutes?: number;
      date?: string;
      note?: string;
    };

    if (!studentId) {
      res.status(400).json({ error: 'Student ID is required.' });
      return;
    }

    if (typeof minutes !== 'number' || minutes === 0) {
      res.status(400).json({ error: 'Please specify the minutes to adjust (e.g. 60 for 1 hour).' });
      return;
    }

    // Lookup student
    const studentRes = await db.execute({
      sql: 'SELECT id, name FROM members WHERE id = ?',
      args: [studentId.trim()],
    });

    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const student = studentRes.rows[0];
    const nowIso = new Date().toISOString();
    const entryDate = (date && date.trim()) || nowIso.slice(0, 10);
    const entryId = crypto.randomUUID();
    const adjustmentNote = (note && note.trim()) || 'Manual hours adjustment by developer';

    await db.execute({
      sql: `INSERT INTO attendance_entries (id, member_id, member_name, date, time_in, time_out, duration_minutes, status, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      args: [entryId, String(student.id), String(student.name), entryDate, nowIso, nowIso, minutes, adjustmentNote],
    });

    res.json({
      success: true,
      entry: {
        id: entryId,
        studentId: String(student.id),
        studentName: String(student.name),
        date: entryDate,
        durationMinutes: minutes,
        note: adjustmentNote,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to adjust hours.' });
  }
});

// PUT /api/developer/entries/:id - Edit an individual attendance entry
app.put('/api/developer/entries/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { durationMinutes, date, note } = req.body as {
      durationMinutes?: number;
      date?: string;
      note?: string;
    };

    const updates: string[] = [];
    const args: (string | number)[] = [];

    if (typeof durationMinutes === 'number') {
      updates.push('duration_minutes = ?');
      args.push(durationMinutes);
    }
    if (date && date.trim()) {
      updates.push('date = ?');
      args.push(date.trim());
    }
    if (note !== undefined) {
      updates.push('note = ?');
      args.push(note.trim());
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields provided to update.' });
      return;
    }

    args.push(id);
    await db.execute({
      sql: `UPDATE attendance_entries SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update entry.' });
  }
});

// DELETE /api/developer/entries/:id - Delete an attendance record
app.delete('/api/developer/entries/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: 'DELETE FROM attendance_entries WHERE id = ?',
      args: [id],
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete entry.' });
  }
});

// GET /api/developer/export-csv - Download clean attendance CSV report
app.get('/api/developer/export-csv', async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Student totals across all days
    const studentsResult = await db.execute('SELECT id, name FROM members ORDER BY name ASC');
    const totalsResult = await db.execute(`
      SELECT member_id, SUM(duration_minutes) as total_minutes, COUNT(*) as sessions_count
      FROM attendance_entries
      WHERE status = 'completed' AND duration_minutes IS NOT NULL
      GROUP BY member_id
    `);

    const totalsMap = new Map<string, number>();
    for (const row of totalsResult.rows) {
      totalsMap.set(String(row.member_id), Number(row.total_minutes || 0));
    }

    // 2. All attendance entries
    const entriesResult = await db.execute('SELECT date, member_name, member_id, time_in, time_out, duration_minutes, status, note FROM attendance_entries ORDER BY time_in DESC');

    const lines: string[] = [];

    // Summary section
    lines.push('=== TOTAL ACCUMULATED HOURS ACROSS ALL DAYS ===');
    lines.push('Student Name,Student ID,Total Minutes,Total Hours (HH:MM)');
    for (const s of studentsResult.rows) {
      const sId = String(s.id);
      const mins = totalsMap.get(sId) || 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      lines.push(`"${String(s.name).replace(/"/g, '""')}","${sId}",${mins},"${h}h ${m}m"`);
    }

    lines.push('');
    lines.push('=== DETAILED ATTENDANCE LOG ===');
    lines.push('Date,Student Name,Student ID,Sign In Time,Sign Out Time,Duration (Minutes),Duration (Formatted),Status,Note');

    for (const r of entriesResult.rows) {
      const mins = r.duration_minutes !== null ? Number(r.duration_minutes) : 0;
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      const formattedDuration = r.status === 'completed' ? `${hours}h ${remainingMins}m` : 'In Progress';

      const formatTime = (iso?: unknown): string => {
        if (!iso) return '';
        try {
          return new Date(String(iso)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
          return String(iso);
        }
      };

      lines.push([
        `"${String(r.date)}"`,
        `"${String(r.member_name).replace(/"/g, '""')}"`,
        `"${String(r.member_id)}"`,
        `"${formatTime(r.time_in)}"`,
        `"${formatTime(r.time_out)}"`,
        mins,
        `"${formattedDuration}"`,
        `"${String(r.status)}"`,
        `"${String(r.note || '').replace(/"/g, '""')}"`,
      ].join(','));
    }

    const csvContent = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="student-attendance-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'CSV export failed.' });
  }
});

// Backward compatibility helper for /api/members (used if any legacy call exists)
app.get('/api/members', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute('SELECT id, name, is_clocked_in, active_session_start FROM members ORDER BY name ASC');
    const members = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      isClockedIn: Boolean(row.is_clocked_in),
      activeSessionStart: row.active_session_start ? String(row.active_session_start) : undefined,
    }));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.listen(PORT, () => {
  process.stdout.write(`Server running on http://localhost:${PORT}\n`);
});

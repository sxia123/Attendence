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

// GET /api/terminal/status
app.get('/api/terminal/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['terminal_locked'],
    });

    const isLocked = result.rows.length > 0 && result.rows[0]?.value === '1';
    res.json({ isLocked });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Database error' });
  }
});

// POST /api/terminal/unlock
app.post('/api/terminal/unlock', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pin } = req.body as { pin?: string };
    if (!pin) {
      res.status(400).json({ error: 'PIN or Lead ID is required' });
      return;
    }

    const pinSetting = await db.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['lead_pin'],
    });
    const correctPin = (pinSetting.rows[0]?.value as string) || '9999';

    // Check if the pin matches lead_pin OR if it's the 5-digit ID of a Lead
    let isAuthorized = pin.trim() === correctPin.trim();

    if (!isAuthorized) {
      const leadMember = await db.execute({
        sql: 'SELECT id, name FROM members WHERE id = ? AND role = ?',
        args: [pin.trim(), 'lead'],
      });
      if (leadMember.rows.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(401).json({ error: 'Invalid Lead PIN or Lead ID' });
      return;
    }

    await db.execute({
      sql: 'UPDATE settings SET value = ? WHERE key = ?',
      args: ['0', 'terminal_locked'],
    });

    res.json({ success: true, isLocked: false });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unlock failed' });
  }
});

// POST /api/terminal/lock
app.post('/api/terminal/lock', async (_req: Request, res: Response): Promise<void> => {
  try {
    await db.execute({
      sql: 'UPDATE settings SET value = ? WHERE key = ?',
      args: ['1', 'terminal_locked'],
    });
    res.json({ success: true, isLocked: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Lock failed' });
  }
});

// GET /api/members
app.get('/api/members', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute('SELECT id, name, role, is_clocked_in, active_session_start FROM members ORDER BY name ASC');
    const members = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      role: String(row.role) as 'member' | 'lead',
      isClockedIn: Boolean(row.is_clocked_in),
      activeSessionStart: row.active_session_start ? String(row.active_session_start) : undefined,
    }));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch members' });
  }
});

// POST /api/members
app.post('/api/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, role } = req.body as { id?: string; name?: string; role?: string };

    if (!id || !/^\d{5}$/.test(id.trim())) {
      res.status(400).json({ error: 'Member ID must be exactly 5 numeric digits (e.g. 10402)' });
      return;
    }

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Member name is required' });
      return;
    }

    const memberRole = role === 'lead' ? 'lead' : 'member';

    const existing = await db.execute({
      sql: 'SELECT id FROM members WHERE id = ?',
      args: [id.trim()],
    });

    if (existing.rows.length > 0) {
      res.status(409).json({ error: `Member with ID ${id.trim()} already exists` });
      return;
    }

    await db.execute({
      sql: 'INSERT INTO members (id, name, role, is_clocked_in) VALUES (?, ?, ?, 0)',
      args: [id.trim(), name.trim(), memberRole],
    });

    res.status(201).json({
      id: id.trim(),
      name: name.trim(),
      role: memberRole,
      isClockedIn: false,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create member' });
  }
});

// POST /api/punch (Instant Punch-In or Punch-Out)
app.post('/api/punch', async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Verify terminal lock status
    const lockCheck = await db.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['terminal_locked'],
    });
    if (lockCheck.rows.length > 0 && lockCheck.rows[0]?.value === '1') {
      res.status(403).json({ error: 'Terminal is locked. An authorized Lead must unlock it to record hours.' });
      return;
    }

    const { id } = req.body as { id?: string };
    if (!id || id.trim().length === 0) {
      res.status(400).json({ error: 'Member ID is required' });
      return;
    }

    const cleanId = id.trim();

    // 2. Fetch member
    const memberResult = await db.execute({
      sql: 'SELECT id, name, role, is_clocked_in, active_session_start FROM members WHERE id = ?',
      args: [cleanId],
    });

    if (memberResult.rows.length === 0) {
      res.status(404).json({ error: `ID ${cleanId} is not recognized. Please check your 5-digit ID.` });
      return;
    }

    const member = memberResult.rows[0];
    const isClockedIn = Boolean(member.is_clocked_in);
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.slice(0, 10);

    if (!isClockedIn) {
      // Clock IN
      const entryId = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO attendance_entries (id, member_id, member_name, date, time_in, status) VALUES (?, ?, ?, ?, ?, ?)',
        args: [entryId, cleanId, String(member.name), dateStr, nowIso, 'active'],
      });

      await db.execute({
        sql: 'UPDATE members SET is_clocked_in = 1, active_session_start = ? WHERE id = ?',
        args: [nowIso, cleanId],
      });

      res.json({
        action: 'clock_in',
        member: {
          id: cleanId,
          name: String(member.name),
        },
        timeIn: nowIso,
      });
    } else {
      // Clock OUT
      const activeEntryResult = await db.execute({
        sql: "SELECT id, time_in FROM attendance_entries WHERE member_id = ? AND status = 'active' ORDER BY time_in DESC LIMIT 1",
        args: [cleanId],
      });

      const startTime = activeEntryResult.rows[0]?.time_in ? String(activeEntryResult.rows[0].time_in) : String(member.active_session_start);
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(nowIso).getTime();
      const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

      if (activeEntryResult.rows.length > 0 && activeEntryResult.rows[0]?.id) {
        await db.execute({
          sql: "UPDATE attendance_entries SET time_out = ?, duration_minutes = ?, status = 'completed' WHERE id = ?",
          args: [nowIso, durationMinutes, String(activeEntryResult.rows[0].id)],
        });
      } else {
        // Fallback: create completed entry
        const entryId = crypto.randomUUID();
        await db.execute({
          sql: "INSERT INTO attendance_entries (id, member_id, member_name, date, time_in, time_out, duration_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')",
          args: [entryId, cleanId, String(member.name), dateStr, startTime, nowIso, durationMinutes],
        });
      }

      await db.execute({
        sql: 'UPDATE members SET is_clocked_in = 0, active_session_start = NULL WHERE id = ?',
        args: [cleanId],
      });

      res.json({
        action: 'clock_out',
        member: {
          id: cleanId,
          name: String(member.name),
        },
        timeIn: startTime,
        timeOut: nowIso,
        durationMinutes,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Punch action failed' });
  }
});

// GET /api/entries
app.get('/api/entries', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status, date } = req.query as { search?: string; status?: string; date?: string };

    let query = 'SELECT id, member_id, member_name, date, time_in, time_out, duration_minutes, status FROM attendance_entries WHERE 1=1';
    const args: (string | number)[] = [];

    if (search && search.trim() !== '') {
      query += ' AND (member_name LIKE ? OR member_id LIKE ?)';
      const term = `%${search.trim()}%`;
      args.push(term, term);
    }

    if (status && status !== 'all') {
      query += ' AND status = ?';
      args.push(status);
    }

    if (date && date.trim() !== '') {
      query += ' AND date = ?';
      args.push(date.trim());
    }

    query += ' ORDER BY time_in DESC LIMIT 200';

    const result = await db.execute({ sql: query, args });

    const entries = result.rows.map((row) => ({
      id: String(row.id),
      memberId: String(row.member_id),
      memberName: String(row.member_name),
      date: String(row.date),
      timeIn: String(row.time_in),
      timeOut: row.time_out ? String(row.time_out) : undefined,
      durationMinutes: row.duration_minutes !== null ? Number(row.duration_minutes) : undefined,
      status: String(row.status) as 'active' | 'completed',
    }));

    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch entries' });
  }
});

// GET /api/export/csv
app.get('/api/export/csv', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute('SELECT date, member_name, member_id, time_in, time_out, duration_minutes, status FROM attendance_entries ORDER BY time_in DESC');

    const headers = ['Date', 'Name', 'ID', 'Time In', 'Time Out', 'Duration (HH:MM)', 'Duration (Minutes)', 'Status'];
    const rows = result.rows.map((r) => {
      const mins = r.duration_minutes !== null ? Number(r.duration_minutes) : 0;
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      const formattedDuration = r.status === 'completed' ? `${hours}h ${remainingMins}m` : 'In Progress';

      const formatTime = (iso?: unknown): string => {
        if (!iso) return '';
        try {
          return new Date(String(iso)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch {
          return String(iso);
        }
      };

      return [
        `"${String(r.date)}"`,
        `"${String(r.member_name).replace(/"/g, '""')}"`,
        `"${String(r.member_id)}"`,
        `"${formatTime(r.time_in)}"`,
        `"${formatTime(r.time_out)}"`,
        `"${formattedDuration}"`,
        mins,
        `"${String(r.status)}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'CSV export failed' });
  }
});

app.listen(PORT, () => {
  process.stdout.write(`Server running on http://localhost:${PORT}\n`);
});

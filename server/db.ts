import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim() !== ''
  ? process.env.TURSO_DATABASE_URL
  : 'file:attendance.db';

const authToken = process.env.TURSO_AUTH_TOKEN && process.env.TURSO_AUTH_TOKEN.trim() !== ''
  ? process.env.TURSO_AUTH_TOKEN
  : undefined;

export const db = createClient({
  url,
  authToken,
});

export async function initDb(): Promise<void> {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        is_clocked_in INTEGER NOT NULL DEFAULT 0,
        active_session_start TEXT
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS attendance_entries (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        date TEXT NOT NULL,
        time_in TEXT NOT NULL,
        time_out TEXT,
        duration_minutes INTEGER,
        status TEXT NOT NULL,
        note TEXT,
        FOREIGN KEY (member_id) REFERENCES members(id)
      );
    `);

    // Migration check: add note column if it doesn't exist yet in older tables
    try {
      await db.execute('ALTER TABLE attendance_entries ADD COLUMN note TEXT');
    } catch {
      // Column already exists or table freshly created
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Ensure terminal_locked setting exists (default: 1 = locked)
    const lockSetting = await db.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['terminal_locked'],
    });

    if (lockSetting.rows.length === 0) {
      await db.execute({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
        args: ['terminal_locked', '1'],
      });
    }

    // Ensure lead_pin exists (default: 9999)
    const pinSetting = await db.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['lead_pin'],
    });

    if (pinSetting.rows.length === 0) {
      const defaultPin = process.env.LEAD_PIN || '9999';
      await db.execute({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
        args: ['lead_pin', defaultPin],
      });
    }

    // Seed initial members if roster is empty
    const existingMembers = await db.execute('SELECT COUNT(*) as count FROM members');
    const memberCount = Number(existingMembers.rows[0]?.count ?? 0);

    if (memberCount === 0) {
      const initialTeam = [
        { id: '10101', name: 'Sarah Jenkins', role: 'lead' },
        { id: '10102', name: 'David Chen', role: 'member' },
        { id: '10103', name: 'Alex Rivera', role: 'member' },
        { id: '10104', name: 'Emily Watson', role: 'member' },
        { id: '10105', name: 'Marcus Vance', role: 'lead' },
      ];

      for (const m of initialTeam) {
        await db.execute({
          sql: 'INSERT INTO members (id, name, role, is_clocked_in) VALUES (?, ?, ?, 0)',
          args: [m.id, m.name, m.role],
        });
      }
    }
  } catch (error) {
    throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

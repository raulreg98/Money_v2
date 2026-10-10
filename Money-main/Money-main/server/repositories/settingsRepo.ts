import { getDb, scheduleSave } from '../db/database';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const result = db.exec(`SELECT value FROM settings WHERE key = ?`, [key]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return result[0].values[0][0] as string;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  db.run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value]);
  scheduleSave();
}

export async function getSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const result = db.exec(`SELECT key, value FROM settings`);
  const settings: Record<string, string> = {};
  if (result.length > 0) {
    for (const row of result[0].values) {
      settings[row[0] as string] = row[1] as string;
    }
  }
  return settings;
}

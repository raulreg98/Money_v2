import { getDb, persist, getDbPath } from '../db/database';
import { existsSync, mkdirSync, readdirSync, copyFileSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

const BACKUP_DIR = join(dirname(getDbPath()), 'backups');
const MAX_BACKUPS = 20;

export async function createBackup(label?: string): Promise<string> {
  persist();
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}${label ? '-' + label : '.db'}`;
  const backupPath = join(BACKUP_DIR, filename.endsWith('.db') ? filename : filename + '.db');
  copyFileSync(getDbPath(), backupPath);
  pruneBackups();
  return backupPath;
}

function pruneBackups() {
  if (!existsSync(BACKUP_DIR)) return;
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
    .sort()
    .reverse();
  if (files.length > MAX_BACKUPS) {
    for (const file of files.slice(MAX_BACKUPS)) {
      unlinkSync(join(BACKUP_DIR, file));
    }
  }
}

export async function listBackups(): Promise<{ filename: string; date: string; size: number }[]> {
  if (!existsSync(BACKUP_DIR)) return [];
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
    .sort()
    .reverse();
  return files.map(f => {
    const stats = readFileSync(join(BACKUP_DIR, f));
    const dateMatch = f.match(/backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    return { filename: f, date: dateMatch ? dateMatch[1].replace(/-/g, (m, i) => i > 9 ? (i === 10 ? 'T' : ':') : '-') : f, size: stats.length };
  });
}

export async function restoreFromBackup(filename: string): Promise<boolean> {
  const backupPath = join(BACKUP_DIR, filename);
  if (!existsSync(backupPath)) return false;
  await createBackup('pre-restore');
  copyFileSync(backupPath, getDbPath());
  return true;
}

export async function exportFullJson(): Promise<Buffer> {
  const db = await getDb();
  const data = db.export();
  return Buffer.from(data);
}

export async function restoreFromJson(data: Buffer): Promise<boolean> {
  const dbPath = getDbPath();
  await createBackup('pre-restore-json');
  writeFileSync(dbPath, data);
  return true;
}

export async function resetDatabase(): Promise<boolean> {
  await createBackup('pre-reset');
  const db = await getDb();
  db.run(`DELETE FROM movements`);
  db.run(`DELETE FROM product_prices`);
  db.run(`DELETE FROM valuations`);
  db.run(`DELETE FROM products`);
  db.run(`DELETE FROM transactions`);
  db.run(`DELETE FROM accounts`);
  db.run(`DELETE FROM tags`);
  db.run(`DELETE FROM chart_widgets`);
  db.run(`DELETE FROM exchange_rates`);
  db.run(`DELETE FROM settings`);
  persist();
  return true;
}

export async function getBackupFile(filename: string): Promise<Buffer | null> {
  const path = join(BACKUP_DIR, filename);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

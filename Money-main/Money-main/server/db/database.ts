import initSqlJs, { type Database } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { EventEmitter } from 'events';
import { MIGRATIONS } from './migrations';

const DB_PATH = process.env.DB_PATH || '/data/app.db';
const SAVE_DELAY_MS = 500;

let db: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let sqlModule: Awaited<ReturnType<typeof initSqlJs>> | null = null;

const events = new EventEmitter();
export const dbEvents = events;

async function loadSqlJs() {
  if (!sqlModule) {
    sqlModule = await initSqlJs({
      locateFile: (file: string) => {
        try {
          if (typeof require !== 'undefined' && require.resolve) {
            return require.resolve('sql.js/dist/' + file);
          }
        } catch {}
        return join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
      },
    });
  }
  return sqlModule;
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await loadSqlJs();

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(buffer));
  } else {
    db = new SQL.Database();
  }

  await runMigrations(db);
  return db;
}

async function runMigrations(database: Database) {
  database.run('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT)');

  const result = database.exec('SELECT MAX(version) as v FROM schema_migrations');
  const currentVersion = result.length > 0 && result[0].values.length > 0 ? (result[0].values[0][0] as number) || 0 : 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      if (currentVersion > 0) {
        try {
          const backupDir = join(dirname(DB_PATH), 'backups');
          if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          copyFileSync(DB_PATH, join(backupDir, `backup-${ts}-pre-migration.db`));
        } catch {}
      }
      database.run(migration.sql);
      database.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
        migration.version,
        new Date().toISOString(),
      ]);
    }
  }
}

export function scheduleSave() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist();
  }, SAVE_DELAY_MS);
}

export function persist() {
  if (!db) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const data = db.export();
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmpPath = DB_PATH + '.tmp';
  writeFileSync(tmpPath, Buffer.from(data));
  renameSync(tmpPath, DB_PATH);
  events.emit('saved');
}

export function getDbPath() {
  return DB_PATH;
}

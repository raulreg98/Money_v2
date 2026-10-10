import { getDb, scheduleSave } from '../db/database';

export interface Account {
  id: number;
  name: string;
  currency: string;
  initial_balance: number;
  color: string;
  type: string;
  archived: number;
  exclude_from_net_worth: number;
  created_at: string;
  updated_at: string;
}

const ACCOUNT_COLS = 'id, name, currency, initial_balance, color, type, archived, exclude_from_net_worth, created_at, updated_at';

function rowToAccount(row: any[]): Account {
  return {
    id: row[0] as number,
    name: row[1] as string,
    currency: row[2] as string,
    initial_balance: row[3] as number,
    color: row[4] as string,
    type: row[5] as string,
    archived: row[6] as number,
    exclude_from_net_worth: row[7] as number,
    created_at: row[8] as string,
    updated_at: row[9] as string,
  };
}

export async function getAllAccounts(): Promise<Account[]> {
  const db = await getDb();
  const result = db.exec(`SELECT ${ACCOUNT_COLS} FROM accounts WHERE archived = 0 ORDER BY name`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToAccount);
}

export async function getAllAccountsWithArchived(): Promise<Account[]> {
  const db = await getDb();
  const result = db.exec(`SELECT ${ACCOUNT_COLS} FROM accounts ORDER BY archived, name`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToAccount);
}

export async function getAccountById(id: number): Promise<Account | null> {
  const db = await getDb();
  const result = db.exec(`SELECT ${ACCOUNT_COLS} FROM accounts WHERE id = ?`, [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToAccount(result[0].values[0]);
}

export async function createAccount(data: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'archived' | 'exclude_from_net_worth'> & { archived?: number; exclude_from_net_worth?: number }): Promise<number> {
  const db = await getDb();
  db.run(
    `INSERT INTO accounts (name, currency, initial_balance, color, type, archived, exclude_from_net_worth) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.currency, data.initial_balance, data.color, data.type, data.archived ?? 0, data.exclude_from_net_worth ?? 0],
  );
  scheduleSave();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

export async function updateAccount(id: number, data: Partial<Account>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (['id', 'created_at'].includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  fields.push(`updated_at = datetime('now')`);
  values.push(id);
  db.run(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values);
  scheduleSave();
}

export async function deleteAccount(id: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM accounts WHERE id = ?`, [id]);
  scheduleSave();
}

export async function archiveAccount(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE accounts SET archived = ?, updated_at = datetime('now') WHERE id = ?`, [archived ? 1 : 0, id]);
  scheduleSave();
}

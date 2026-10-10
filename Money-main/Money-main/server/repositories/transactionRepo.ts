import { getDb, scheduleSave } from '../db/database';

export interface Transaction {
  id: number;
  type: string;
  date: string;
  amount: number;
  account_id: number;
  to_account_id: number | null;
  to_amount: number | null;
  note: string | null;
  tags: string | null;
  category_id: number | null;
  linked_transfer_id: number | null;
  created_at: string;
}

const TX_COLS = 'id, type, date, amount, account_id, to_account_id, to_amount, note, tags, category_id, linked_transfer_id, created_at';

function rowToTx(row: any[]): Transaction {
  return {
    id: row[0] as number,
    type: row[1] as string,
    date: row[2] as string,
    amount: row[3] as number,
    account_id: row[4] as number,
    to_account_id: row[5] as number | null,
    to_amount: row[6] as number | null,
    note: row[7] as string,
    tags: row[8] as string,
    category_id: row[9] as number | null,
    linked_transfer_id: row[10] as number | null,
    created_at: row[11] as string,
  };
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await getDb();
  const result = db.exec(`SELECT ${TX_COLS} FROM transactions ORDER BY date DESC, id DESC`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToTx);
}

export async function getTransactionsByAccount(accountId: number): Promise<Transaction[]> {
  const db = await getDb();
  const result = db.exec(
    `SELECT ${TX_COLS} FROM transactions WHERE account_id = ? OR to_account_id = ? ORDER BY date DESC, id DESC`,
    [accountId, accountId],
  );
  if (result.length === 0) return [];
  return result[0].values.map(rowToTx);
}

export async function createTransaction(data: Omit<Transaction, 'id' | 'created_at' | 'linked_transfer_id'> & {
  linked_transfer_id?: number | null;
  category_id?: number | null;
}): Promise<number> {
  const db = await getDb();
  db.run(
    `INSERT INTO transactions (type, date, amount, account_id, to_account_id, to_amount, note, tags, category_id, linked_transfer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.type, data.date, data.amount, data.account_id, data.to_account_id ?? null, data.to_amount ?? null, data.note ?? null, data.tags ?? null, data.category_id ?? null, data.linked_transfer_id ?? null],
  );
  scheduleSave();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

export async function updateTransaction(id: number, data: Partial<Transaction>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (['id', 'created_at'].includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(id);
  db.run(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, values);
  scheduleSave();
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM transactions WHERE id = ?`, [id]);
  scheduleSave();
}

export async function deleteTransferPair(id: number): Promise<void> {
  const db = await getDb();
  const result = db.exec(`SELECT linked_transfer_id FROM transactions WHERE id = ?`, [id]);
  if (result.length > 0 && result[0].values.length > 0) {
    const linkedId = result[0].values[0][0] as number | null;
    if (linkedId) {
      db.run(`DELETE FROM transactions WHERE id = ?`, [linkedId]);
    }
  }
  db.run(`DELETE FROM transactions WHERE id = ?`, [id]);
  scheduleSave();
}

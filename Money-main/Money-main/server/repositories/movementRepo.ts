import { getDb, scheduleSave } from '../db/database';

export interface Movement {
  id: number;
  product_id: number;
  type: string;
  date: string;
  units: number | null;
  amount_eur: number;
  fee: number | null;
  note: string | null;
  portfolio?: string | null;
  created_at: string;
}

const MOVEMENT_COLS = 'id, product_id, type, date, units, amount_eur, fee, note, portfolio, created_at';

function rowToMovement(row: any[]): Movement {
  return {
    id: row[0] as number,
    product_id: row[1] as number,
    type: row[2] as string,
    date: row[3] as string,
    units: row[4] as number | null,
    amount_eur: row[5] as number,
    fee: row[6] as number | null,
    note: row[7] as string,
    portfolio: row[8] as string | null,
    created_at: row[9] as string,
  };
}

export async function getMovementsByProduct(productId: number): Promise<Movement[]> {
  const db = await getDb();
  const result = db.exec(`SELECT ${MOVEMENT_COLS} FROM movements WHERE product_id = ? ORDER BY date`, [productId]);
  if (result.length === 0) return [];
  return result[0].values.map(rowToMovement);
}

export async function getAllMovements(): Promise<Movement[]> {
  const db = await getDb();
  const result = db.exec(`SELECT ${MOVEMENT_COLS} FROM movements ORDER BY date`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToMovement);
}

export async function createMovement(data: Omit<Movement, 'id' | 'created_at'> & { portfolio?: string | null }): Promise<number> {
  const db = await getDb();
  db.run(
    `INSERT INTO movements (product_id, type, date, units, amount_eur, fee, note, portfolio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.product_id, data.type, data.date, data.units ?? null, data.amount_eur, data.fee ?? null, data.note ?? null, data.portfolio ?? null],
  );
  scheduleSave();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

export async function updateMovement(id: number, data: Partial<Movement>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (['id', 'created_at'].includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(id);
  db.run(`UPDATE movements SET ${fields.join(', ')} WHERE id = ?`, values);
  scheduleSave();
}

export async function deleteMovement(id: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM movements WHERE id = ?`, [id]);
  scheduleSave();
}

export async function deleteMovementsByProduct(productId: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM movements WHERE product_id = ?`, [productId]);
  scheduleSave();
}

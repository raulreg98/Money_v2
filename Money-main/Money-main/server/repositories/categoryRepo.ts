import { getDb, scheduleSave } from '../db/database';

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  parent_id: number | null;
  created_at: string;
}

function rowToCategory(row: any[]): Category {
  return {
    id: row[0] as number,
    name: row[1] as string,
    color: row[2] as string,
    parent_id: row[3] as number | null,
    created_at: row[4] as string,
    icon: (row[5] as string | null) ?? null,
  };
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, name, color, parent_id, created_at, icon FROM categories ORDER BY parent_id IS NULL DESC, parent_id, name`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToCategory);
}

export async function createCategory(data: { name: string; color: string; icon?: string | null; parent_id?: number | null }): Promise<number> {
  const db = await getDb();
  db.run(`INSERT INTO categories (name, color, parent_id, icon) VALUES (?, ?, ?, ?)`, [data.name, data.color, data.parent_id ?? null, data.icon ?? null]);
  scheduleSave();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

export async function updateCategory(id: number, data: { name?: string; color?: string; icon?: string | null; parent_id?: number | null }): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
  if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
  if (data.parent_id !== undefined) { fields.push('parent_id = ?'); values.push(data.parent_id); }
  if (fields.length === 0) return;
  values.push(id);
  const db = await getDb();
  db.run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
  scheduleSave();
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE transactions SET category_id = NULL WHERE category_id = ?`, [id]);
  db.run(`UPDATE categories SET parent_id = NULL WHERE parent_id = ?`, [id]);
  db.run(`DELETE FROM categories WHERE id = ?`, [id]);
  scheduleSave();
}

export async function reassignCategoryTransactions(fromId: number, toId: number | null): Promise<void> {
  const db = await getDb();
  if (toId) {
    db.run(`UPDATE transactions SET category_id = ? WHERE category_id = ?`, [toId, fromId]);
  } else {
    db.run(`UPDATE transactions SET category_id = NULL WHERE category_id = ?`, [fromId]);
  }
  scheduleSave();
}

export async function getCategoryStats(id: number): Promise<{ txCount: number; totalGastos: number; totalIngresos: number }> {
  const db = await getDb();
  const result = db.exec(
    `SELECT COUNT(*), COALESCE(SUM(CASE WHEN type = 'gasto' THEN ABS(amount) ELSE 0 END), 0), COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) FROM transactions WHERE category_id = ?`,
    [id],
  );
  if (result.length === 0) return { txCount: 0, totalGastos: 0, totalIngresos: 0 };
  const row = result[0].values[0];
  return { txCount: row[0] as number, totalGastos: row[1] as number, totalIngresos: row[2] as number };
}

export async function getChildCategoryIds(parentId: number): Promise<number[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id FROM categories WHERE parent_id = ?`, [parentId]);
  if (result.length === 0) return [];
  return result[0].values.map(r => r[0] as number);
}

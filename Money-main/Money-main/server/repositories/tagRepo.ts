import { getDb, scheduleSave } from '../db/database';

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb();
  const result = db.exec(`SELECT * FROM tags ORDER BY name`);
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0] as number,
    name: row[1] as string,
    color: row[2] as string,
    created_at: row[3] as string,
  }));
}

export async function createTag(name: string, color: string): Promise<number> {
  const db = await getDb();
  db.run(`INSERT INTO tags (name, color) VALUES (?, ?)`, [name, color]);
  scheduleSave();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

export async function updateTag(id: number, data: { name?: string; color?: string }): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
  if (fields.length === 0) return;
  values.push(id);
  db.run(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, values);
  scheduleSave();
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  const tag = await getTagById(id);
  if (tag) {
    const allTx = await getAllTransactionsWithTags();
    for (const tx of allTx) {
      if (tx.tags && tx.tags.includes(tag.name)) {
        const newTags = tx.tags.split(',').map(t => t.trim()).filter(t => t !== tag.name).join(',');
        db.run(`UPDATE transactions SET tags = ? WHERE id = ?`, [newTags || null, tx.id]);
      }
    }
  }
  db.run(`DELETE FROM tags WHERE id = ?`, [id]);
  scheduleSave();
}

async function getTagById(id: number): Promise<Tag | null> {
  const db = await getDb();
  const result = db.exec(`SELECT * FROM tags WHERE id = ?`, [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return { id: row[0] as number, name: row[1] as string, color: row[2] as string, created_at: row[3] as string };
}

async function getAllTransactionsWithTags(): Promise<{ id: number; tags: string | null }[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, tags FROM transactions WHERE tags IS NOT NULL`);
  if (result.length === 0) return [];
  return result[0].values.map(row => ({ id: row[0] as number, tags: row[1] as string }));
}

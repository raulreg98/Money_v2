import { getDb, scheduleSave } from '../db/database';

export interface PriceRow {
  id: number;
  product_id: number;
  price: number;
  currency: string;
  source: string | null;
  date: string;
}

export interface ValuationRow {
  id: number;
  product_id: number;
  value_eur: number;
  date: string;
  note: string | null;
  created_at: string;
}

export async function getLatestPrice(productId: number): Promise<PriceRow | null> {
  const db = await getDb();
  const result = db.exec(`SELECT * FROM product_prices WHERE product_id = ? ORDER BY date DESC LIMIT 1`, [productId]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return { id: row[0] as number, product_id: row[1] as number, price: row[2] as number, currency: row[3] as string, source: row[4] as string, date: row[5] as string };
}

export async function getPriceHistory(productId: number, limit = 365): Promise<PriceRow[]> {
  const db = await getDb();
  const result = db.exec(`SELECT * FROM product_prices WHERE product_id = ? ORDER BY date DESC LIMIT ?`, [productId, limit]);
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0] as number, product_id: row[1] as number, price: row[2] as number,
    currency: row[3] as string, source: row[4] as string, date: row[5] as string,
  }));
}

export async function savePrice(productId: number, price: number, currency: string, source: string, date: string): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO product_prices (product_id, price, currency, source, date) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(product_id, date) DO UPDATE SET price = excluded.price, currency = excluded.currency, source = excluded.source`,
    [productId, price, currency, source, date],
  );
  scheduleSave();
}

export async function getAllLatestPrices(): Promise<Map<number, PriceRow>> {
  const db = await getDb();
  const result = db.exec(`
    SELECT pp.* FROM product_prices pp
    INNER JOIN (SELECT product_id, MAX(date) as max_date FROM product_prices GROUP BY product_id) latest
    ON pp.product_id = latest.product_id AND pp.date = latest.max_date
  `);
  const map = new Map<number, PriceRow>();
  if (result.length > 0) {
    for (const row of result[0].values) {
      map.set(row[1] as number, {
        id: row[0] as number, product_id: row[1] as number, price: row[2] as number,
        currency: row[3] as string, source: row[4] as string, date: row[5] as string,
      });
    }
  }
  return map;
}

export async function getValuationsByProduct(productId: number): Promise<ValuationRow[]> {
  const db = await getDb();
  const result = db.exec(`SELECT * FROM valuations WHERE product_id = ? ORDER BY date`, [productId]);
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0] as number, product_id: row[1] as number, value_eur: row[2] as number,
    date: row[3] as string, note: row[4] as string, created_at: row[5] as string,
  }));
}

export async function getAllLatestValuations(): Promise<Map<number, ValuationRow>> {
  const db = await getDb();
  const result = db.exec(`
    SELECT v.* FROM valuations v
    INNER JOIN (SELECT product_id, MAX(date) as max_date FROM valuations GROUP BY product_id) latest
    ON v.product_id = latest.product_id AND v.date = latest.max_date
  `);
  const map = new Map<number, ValuationRow>();
  if (result.length > 0) {
    for (const row of result[0].values) {
      map.set(row[1] as number, {
        id: row[0] as number, product_id: row[1] as number, value_eur: row[2] as number,
        date: row[3] as string, note: row[4] as string, created_at: row[5] as string,
      });
    }
  }
  return map;
}

export async function upsertValuation(productId: number, valueEur: number, date: string, note?: string): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO valuations (product_id, value_eur, date, note) VALUES (?, ?, ?, ?)
     ON CONFLICT(product_id, date) DO UPDATE SET value_eur = excluded.value_eur, note = excluded.note`,
    [productId, valueEur, date, note || null],
  );
  scheduleSave();
}

export async function deleteValuation(id: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM valuations WHERE id = ?`, [id]);
  scheduleSave();
}

export async function savePriceHistory(productId: number, history: { date: string; price: number; currency: string }[]): Promise<void> {
  const db = await getDb();
  for (const h of history) {
    db.run(
      `INSERT INTO product_prices (product_id, price, currency, source, date) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(product_id, date) DO UPDATE SET price = excluded.price, currency = excluded.currency, source = excluded.source`,
      [productId, h.price, h.currency, 'download', h.date],
    );
  }
  scheduleSave();
}

export async function getPriceHistoryBetween(productId: number, fromDate: string, toDate: string): Promise<PriceRow[]> {
  const db = await getDb();
  const result = db.exec(
    `SELECT * FROM product_prices WHERE product_id = ? AND date >= ? AND date <= ? ORDER BY date`,
    [productId, fromDate, toDate],
  );
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0] as number, product_id: row[1] as number, price: row[2] as number,
    currency: row[3] as string, source: row[4] as string, date: row[5] as string,
  }));
}

export async function getPriceAtDate(productId: number, date: string): Promise<PriceRow | null> {
  const db = await getDb();
  const result = db.exec(
    `SELECT * FROM product_prices WHERE product_id = ? AND date <= ? ORDER BY date DESC LIMIT 1`,
    [productId, date],
  );
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return { id: row[0] as number, product_id: row[1] as number, price: row[2] as number, currency: row[3] as string, source: row[4] as string, date: row[5] as string };
}

export async function deletePricesByProduct(productId: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM product_prices WHERE product_id = ?`, [productId]);
  scheduleSave();
}

export async function deletePrice(id: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM product_prices WHERE id = ?`, [id]);
  scheduleSave();
}

export async function countPricesByProduct(productId: number): Promise<number> {
  const db = await getDb();
  const result = db.exec(`SELECT COUNT(*) FROM product_prices WHERE product_id = ?`, [productId]);
  if (result.length === 0) return 0;
  return result[0].values[0][0] as number;
}

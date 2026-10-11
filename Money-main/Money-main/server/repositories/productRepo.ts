import { getDb, scheduleSave } from '../db/database';

export interface Product {
  id: number;
  name: string;
  type: string;
  isin: string | null;
  ticker: string | null;
  currency: string;
  price_source: string | null;
  ter: number | null;
  risk: number | null;
  category: string | null;
  manual_price: number;
  long_term: number;
  archived: number;
  created_at: string;
  updated_at: string;
  alt_source: string | null;
  alt_symbol: string | null;
  account_id: number | null;
  color: string | null;
  country_breakdown: string | null;
  sector_breakdown: string | null;
  top_holdings: string | null;
}

function rowToProduct(row: any[]): Product {
  return {
    id: row[0] as number,
    name: row[1] as string,
    type: row[2] as string,
    isin: row[3] as string | null,
    ticker: row[4] as string | null,
    currency: row[5] as string,
    price_source: row[6] as string | null,
    ter: row[7] as number | null,
    risk: row[8] as number | null,
    category: row[9] as string | null,
    manual_price: row[10] as number,
    long_term: row[11] as number,
    archived: row[12] as number,
    created_at: row[13] as string,
    updated_at: row[14] as string,
    alt_source: (row[15] as string) ?? null,
    alt_symbol: (row[16] as string) ?? null,
    account_id: (row[17] as number) ?? null,
    color: (row[18] as string) ?? null,
    country_breakdown: (row[19] as string) ?? null,
    sector_breakdown: (row[20] as string) ?? null,
    top_holdings: (row[21] as string) ?? null,
  };
}

const PRODUCT_SELECT_COLS = `id, name, type, isin, ticker, currency, price_source, ter, risk, category, manual_price, long_term, archived, created_at, updated_at, alt_source, alt_symbol, account_id, color, country_breakdown, sector_breakdown, top_holdings`;

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDb();
  const result = db.exec(`SELECT ${PRODUCT_SELECT_COLS} FROM products WHERE archived = 0 ORDER BY name`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToProduct);
}

export async function getAllProductsWithArchived(): Promise<Product[]> {
  const db = await getDb();
  const result = db.exec(`SELECT ${PRODUCT_SELECT_COLS} FROM products ORDER BY archived, name`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToProduct);
}

export async function getProductById(id: number): Promise<Product | null> {
  const db = await getDb();
  const result = db.exec(`SELECT ${PRODUCT_SELECT_COLS} FROM products WHERE id = ?`, [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToProduct(result[0].values[0]);
}

export async function createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'archived' | 'manual_price' | 'long_term' | 'alt_source' | 'alt_symbol' | 'account_id' | 'color' | 'country_breakdown' | 'sector_breakdown' | 'top_holdings'> & {
  manual_price?: number; long_term?: number; archived?: number; alt_source?: string | null; alt_symbol?: string | null; account_id?: number | null;
  color?: string | null; country_breakdown?: string | null; sector_breakdown?: string | null; top_holdings?: string | null;
}): Promise<number> {
  const db = await getDb();
  db.run(
    `INSERT INTO products (name, type, isin, ticker, currency, price_source, ter, risk, category, manual_price, long_term, archived, alt_source, alt_symbol, account_id, color, country_breakdown, sector_breakdown, top_holdings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.type, data.isin ?? null, data.ticker ?? null, data.currency, data.price_source ?? null,
      data.ter ?? null, data.risk ?? null, data.category ?? null, data.manual_price ?? 0, data.long_term ?? 1, data.archived ?? 0,
      data.alt_source ?? null, data.alt_symbol ?? null, data.account_id ?? null,
      data.color ?? null, data.country_breakdown ?? null, data.sector_breakdown ?? null, data.top_holdings ?? null,
    ],
  );
  scheduleSave();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

export async function updateProduct(id: number, data: Partial<Product>): Promise<void> {
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
  db.run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
  scheduleSave();
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM products WHERE id = ?`, [id]);
  scheduleSave();
}

export async function archiveProduct(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE products SET archived = ?, updated_at = datetime('now') WHERE id = ?`, [archived ? 1 : 0, id]);
  scheduleSave();
}

import { getDb, scheduleSave } from '../db/database';

interface ExchangeRateRow {
  currency: string;
  rate: number;
  date: string;
  source: string;
}

export async function getRate(currency: string, date?: string): Promise<number> {
  if (currency === 'EUR') return 1;
  const db = await getDb();
  if (date) {
    const result = db.exec(
      `SELECT rate_to_eur FROM exchange_rate_history WHERE currency = ? AND date <= ? ORDER BY date DESC LIMIT 1`,
      [currency, date],
    );
    if (result.length > 0 && result[0].values.length > 0) return result[0].values[0][0] as number;
  }
  const result = db.exec(`SELECT rate FROM exchange_rates WHERE currency = ?`, [currency]);
  if (result.length === 0 || result[0].values.length === 0) return 1;
  return result[0].values[0][0] as number;
}

export async function getAllRates(): Promise<Map<string, number>> {
  const db = await getDb();
  const result = db.exec(`SELECT currency, rate FROM exchange_rates`);
  const rates = new Map<string, number>();
  rates.set('EUR', 1);
  if (result.length > 0) {
    for (const row of result[0].values) {
      rates.set(row[0] as string, row[1] as number);
    }
  }
  return rates;
}

export async function saveRate(currency: string, rate: number, date: string, source: string): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO exchange_rates (currency, rate, date, source) VALUES (?, ?, ?, ?) ON CONFLICT(currency) DO UPDATE SET rate = excluded.rate, date = excluded.date, source = excluded.source`,
    [currency, rate, date, source],
  );
  db.run(
    `INSERT INTO exchange_rate_history (date, currency, rate_to_eur, source) VALUES (?, ?, ?, ?) ON CONFLICT(date, currency) DO UPDATE SET rate_to_eur = excluded.rate_to_eur, source = excluded.source`,
    [date, currency, rate, source],
  );
  scheduleSave();
}

export async function fetchAndSaveBceRates(): Promise<{ success: boolean; error?: string; count: number }> {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=EUR');
    if (!response.ok) throw new Error(`frankfurter.app respondió ${response.status}`);
    const data = await response.json() as any;
    const date = data.date || new Date().toISOString().slice(0, 10);
    let count = 0;
    for (const [currency, rate] of Object.entries(data.rates)) {
      await saveRate(currency, rate as number, date, 'BCE/frankfurter.app');
      count++;
    }
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message, count: 0 };
  }
}

import type { PriceProvider, LatestPrice, HistoricalPrice } from './types';
import { fetchWithTimeout } from './types';
import { getRate } from '../exchangeRates';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetries(url: string, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetchWithTimeout(url, { headers: BROWSER_HEADERS }, 12000);
      if (resp.status === 429 || resp.status >= 500) {
        if (attempt < maxRetries - 1) {
          await sleep(1000 * Math.pow(2, attempt) + Math.random() * 1000);
          continue;
        }
        return null;
      }
      if (!resp.ok) return null;
      return resp;
    } catch {
      if (attempt < maxRetries - 1) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      return null;
    }
  }
  return null;
}

export const yahooProvider: PriceProvider = {
  name: 'Yahoo Finance',

  async fetchLatest(symbol: string): Promise<LatestPrice | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const resp = await fetchWithRetries(url);
      if (!resp) return null;
      const data = await resp.json() as any;
      const result = data?.chart?.result?.[0];
      if (!result) return null;
      const meta = result.meta;
      const price = meta?.regularMarketPrice;
      const currency = meta?.currency || 'USD';
      if (price == null) return null;
      const rate = await getRate(currency);
      return { price: price * rate, currency: 'EUR', source: 'Yahoo Finance' };
    } catch {
      return null;
    }
  },

  async fetchHistory(symbol: string, fromDate: string, toDate: string): Promise<HistoricalPrice[]> {
    try {
      const from = Math.floor(new Date(fromDate).getTime() / 1000);
      const to = Math.ceil(new Date(toDate).getTime() / 1000) + 86400;
      const period1 = Math.min(from, to);
      const period2 = Math.max(from, to);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}`;
      const resp = await fetchWithRetries(url);
      if (!resp) return [];
      const data = await resp.json() as any;
      const result = data?.chart?.result?.[0];
      if (!result) return [];
      const timestamps: number[] = result.timestamp || [];
      const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.close?.[0]?.close || [];
      const currency = result.meta?.currency || 'USD';
      const rate = await getRate(currency);
      const history: HistoricalPrice[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null) {
          history.push({
            date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
            price: closes[i] * rate,
            currency: 'EUR',
          });
        }
      }
      return history;
    } catch {
      return [];
    }
  },
};

import type { PriceProvider, LatestPrice, HistoricalPrice } from './types';
import { fetchWithTimeout } from './types';
import { getRate } from '../exchangeRates';

export const stooqProvider: PriceProvider = {
  name: 'Stooq',

  async fetchLatest(symbol: string, _apiKey?: string): Promise<LatestPrice | null> {
    try {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;
      const resp = await fetchWithTimeout(url);
      if (!resp.ok) return null;
      const text = await resp.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) return null;
      const cols = lines[1].split(',');
      if (cols.length < 5) return null;
      const price = parseFloat(cols[4]);
      if (!price || price <= 0) return null;
      const currency = 'EUR';
      return { price, currency, source: 'Stooq' };
    } catch {
      return null;
    }
  },

  async fetchHistory(symbol: string, fromDate: string, toDate: string, _apiKey?: string): Promise<HistoricalPrice[]> {
    try {
      const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}&d1=${fromDate.replace(/-/g, '')}&d2=${toDate.replace(/-/g, '')}&i=d`;
      const resp = await fetchWithTimeout(url);
      if (!resp.ok) return [];
      const text = await resp.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) return [];
      const header = lines[0].split(',');
      const dateIdx = header.findIndex(h => h.toLowerCase().includes('date'));
      const closeIdx = header.findIndex(h => h.toLowerCase() === 'close');
      if (dateIdx < 0 || closeIdx < 0) return [];
      const rate = await getRate('EUR');
      const history: HistoricalPrice[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const date = cols[dateIdx];
        const price = parseFloat(cols[closeIdx]);
        if (date && price > 0) {
          history.push({ date, price, currency: 'EUR' });
        }
      }
      return history;
    } catch {
      return [];
    }
  },
};

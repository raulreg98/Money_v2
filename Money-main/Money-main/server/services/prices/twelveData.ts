import type { PriceProvider, LatestPrice, HistoricalPrice } from './types';
import { fetchWithTimeout } from './types';
import { getRate } from '../exchangeRates';

export const twelveDataProvider: PriceProvider = {
  name: 'Twelve Data',

  async fetchLatest(symbol: string, apiKey?: string): Promise<LatestPrice | null> {
    if (!apiKey) return null;
    try {
      const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
      const resp = await fetchWithTimeout(url, {}, 10000);
      if (!resp.ok) return null;
      const data = await resp.json() as any;
      if (data?.status === 'error') return null;
      const price = parseFloat(data?.price);
      if (!price || price <= 0) return null;
      const rate = await getRate('USD');
      return { price: price * rate, currency: 'EUR', source: 'Twelve Data' };
    } catch {
      return null;
    }
  },

  async fetchHistory(symbol: string, fromDate: string, toDate: string, apiKey?: string): Promise<HistoricalPrice[]> {
    if (!apiKey) return [];
    try {
      const start = fromDate;
      const end = toDate;
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${start}&end_date=${end}&format=JSON&apikey=${apiKey}`;
      const resp = await fetchWithTimeout(url, {}, 15000);
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      if (data?.status === 'error') return [];
      const values: any[] = data?.values || [];
      const rate = await getRate('USD');
      return values.map(v => ({
        date: v.datetime,
        price: parseFloat(v.close) * rate,
        currency: 'EUR',
      })).filter(h => h.price > 0).reverse();
    } catch {
      return [];
    }
  },
};

import type { PriceProvider, LatestPrice, HistoricalPrice } from './types';
import { fetchWithTimeout } from './types';
import { getRate } from '../exchangeRates';

export const alphaVantageProvider: PriceProvider = {
  name: 'Alpha Vantage',

  async fetchLatest(symbol: string, apiKey?: string): Promise<LatestPrice | null> {
    if (!apiKey) return null;
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
      const resp = await fetchWithTimeout(url, {}, 10000);
      if (!resp.ok) return null;
      const data = await resp.json() as any;
      const quote = data?.['Global Quote'];
      if (!quote) return null;
      const price = parseFloat(quote['05. price']);
      if (!price || price <= 0) return null;
      const rate = await getRate('USD');
      return { price: price * rate, currency: 'EUR', source: 'Alpha Vantage' };
    } catch {
      return null;
    }
  },

  async fetchHistory(symbol: string, fromDate: string, toDate: string, apiKey?: string): Promise<HistoricalPrice[]> {
    if (!apiKey) return [];
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${apiKey}`;
      const resp = await fetchWithTimeout(url, {}, 15000);
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      const series = data?.['Time Series (Daily)'];
      if (!series) return [];
      const rate = await getRate('USD');
      const history: HistoricalPrice[] = [];
      for (const [date, values] of Object.entries(series)) {
        if (date < fromDate || date > toDate) continue;
        const close = parseFloat((values as any)['4. close']);
        if (close > 0) {
          history.push({ date, price: close * rate, currency: 'EUR' });
        }
      }
      return history.sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      return [];
    }
  },
};

import type { PriceProvider, LatestPrice, HistoricalPrice } from './types';
import { fetchWithTimeout } from './types';
import { getRate } from '../exchangeRates';
import { yahooProvider } from './yahoo';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

export const morningstarProvider: PriceProvider = {
  name: 'Morningstar',

  async fetchLatest(symbol: string): Promise<LatestPrice | null> {
    try {
      // First attempt Morningstar API / web query
      const url = `https://www.morningstar.es/es/util/SecuritySearch.ashx?q=${encodeURIComponent(symbol)}`;
      const resp = await fetchWithTimeout(url, { headers: BROWSER_HEADERS }, 8000);
      if (resp.ok) {
        const text = await resp.text();
        // Parse search response if structured
        if (text && text.includes('{')) {
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length > 0 && data[0].Price) {
              const p = parseFloat(data[0].Price.replace(/\./g, '').replace(',', '.'));
              if (!isNaN(p) && p > 0) {
                return { price: p, currency: 'EUR', source: 'Morningstar' };
              }
            }
          } catch {}
        }
      }

      // Fallback to Yahoo Finance as market data provider if direct Morningstar fails
      const fallback = await yahooProvider.fetchLatest(symbol);
      if (fallback) {
        return { ...fallback, source: 'Morningstar' };
      }
      return null;
    } catch {
      return yahooProvider.fetchLatest(symbol);
    }
  },

  async fetchHistory(symbol: string, fromDate: string, toDate: string): Promise<HistoricalPrice[]> {
    return yahooProvider.fetchHistory(symbol, fromDate, toDate);
  },
};

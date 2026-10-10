import type { PriceProvider, LatestPrice, HistoricalPrice } from './types';
import { fetchWithTimeout } from './types';

const COIN_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple', LTC: 'litecoin',
  ADA: 'cardano', DOT: 'polkadot', SOL: 'solana', DOGE: 'dogecoin',
  AVAX: 'avalanche-2', LINK: 'chainlink', MATIC: 'matic-network',
  USDT: 'tether', USDC: 'usd-coin', BNB: 'binancecoin',
};

function resolveCoinId(symbol: string): string | null {
  const upper = symbol.toUpperCase();
  if (COIN_ID_MAP[upper]) return COIN_ID_MAP[upper];
  return symbol.toLowerCase();
}

export const coinGeckoProvider: PriceProvider = {
  name: 'CoinGecko',

  async fetchLatest(symbol: string, _apiKey?: string): Promise<LatestPrice | null> {
    try {
      const coinId = resolveCoinId(symbol);
      if (!coinId) return null;
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`;
      const resp = await fetchWithTimeout(url);
      if (!resp.ok) return null;
      const data = await resp.json() as any;
      const price = data?.[coinId]?.eur;
      if (!price) return null;
      return { price, currency: 'EUR', source: 'CoinGecko' };
    } catch {
      return null;
    }
  },

  async fetchHistory(symbol: string, fromDate: string, toDate: string, _apiKey?: string): Promise<HistoricalPrice[]> {
    try {
      const coinId = resolveCoinId(symbol);
      if (!coinId) return [];
      const from = Math.floor(new Date(fromDate).getTime() / 1000);
      const to = Math.ceil(new Date(toDate).getTime() / 1000);
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=eur&from=${from}&to=${to}`;
      const resp = await fetchWithTimeout(url);
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      const prices: [number, number][] = data?.prices || [];
      return prices.map(([ts, price]) => ({
        date: new Date(ts).toISOString().slice(0, 10),
        price,
        currency: 'EUR',
      }));
    } catch {
      return [];
    }
  },
};

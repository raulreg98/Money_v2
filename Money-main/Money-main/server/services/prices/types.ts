export interface LatestPrice {
  price: number;
  currency: string;
  source: string;
}

export interface HistoricalPrice {
  date: string;
  price: number;
  currency: string;
}

export interface PriceProvider {
  name: string;
  fetchLatest(symbol: string, apiKey?: string): Promise<LatestPrice | null>;
  fetchHistory(symbol: string, fromDate: string, toDate: string, apiKey?: string): Promise<HistoricalPrice[]>;
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function sequentialDelay(): Promise<void> {
  const delay = 1000 + Math.random() * 2000;
  await sleep(delay);
}

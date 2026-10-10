import type { PriceProvider, LatestPrice, HistoricalPrice } from './types';

export const manualProvider: PriceProvider = {
  name: 'Manual',

  async fetchLatest(_symbol: string, _apiKey?: string): Promise<LatestPrice | null> {
    return null;
  },

  async fetchHistory(_symbol: string, _fromDate: string, _toDate: string, _apiKey?: string): Promise<HistoricalPrice[]> {
    return [];
  },
};

export function parseCsvHistory(csvText: string): HistoricalPrice[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
  const dateIdx = header.findIndex(h => h.includes('fecha') || h === 'date');
  const priceIdx = header.findIndex(h => h.includes('precio') || h.includes('close') || h === 'price');
  if (dateIdx < 0 || priceIdx < 0) return [];
  const history: HistoricalPrice[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[;,]/).map(c => c.trim());
    const dateRaw = cols[dateIdx];
    const priceRaw = cols[priceIdx];
    if (!dateRaw || !priceRaw) continue;
    const date = normalizeDate(dateRaw);
    const price = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));
    if (date && price > 0) {
      history.push({ date, price, currency: 'EUR' });
    }
  }
  return history;
}

function normalizeDate(s: string): string | null {
  const parts = s.split(/[/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null;
}

import { getAllProductsWithArchived, getProductById, updateProduct } from '../repositories/productRepo';
import { savePrice, getLatestPrice, savePriceHistory, getPriceHistoryBetween, deletePricesByProduct } from '../repositories/priceRepo';
import { getRate } from './exchangeRates';
import { getMovementsByProduct } from '../repositories/movementRepo';
import type { PriceProvider, LatestPrice, HistoricalPrice } from './prices/types';
import { sequentialDelay } from './prices/types';
import { morningstarProvider } from './prices/morningstar';
import { yahooProvider } from './prices/yahoo';
import { stooqProvider } from './prices/stooq';
import { coinGeckoProvider } from './prices/coingecko';
import { twelveDataProvider } from './prices/twelveData';
import { alphaVantageProvider } from './prices/alphaVantage';
import { parseCsvHistory } from './prices/manual';
import { getSetting, setSetting } from '../repositories/settingsRepo';

const PROVIDERS: Record<string, PriceProvider> = {
  morningstar: morningstarProvider,
  yahoo: yahooProvider,
  stooq: stooqProvider,
  coingecko: coinGeckoProvider,
  'twelve-data': twelveDataProvider,
  'alpha-vantage': alphaVantageProvider,
};

function getProvider(sourceName: string | null): PriceProvider | null {
  if (!sourceName) return null;
  const lower = sourceName.toLowerCase();
  if (PROVIDERS[lower]) return PROVIDERS[lower];
  if (lower === 'morningstar') return morningstarProvider;
  if (lower === 'yahoo finance' || lower === 'yahoo') return yahooProvider;
  if (lower === 'stooq') return stooqProvider;
  if (lower === 'coingecko') return coinGeckoProvider;
  if (lower === 'twelve data' || lower === 'twelvedata') return twelveDataProvider;
  if (lower === 'alpha vantage' || lower === 'alphavantage') return alphaVantageProvider;
  return null;
}

async function getApiKey(providerName: string): Promise<string | undefined> {
  const key = await getSetting(`api_key_${providerName.toLowerCase().replace(/[\s-]/g, '_')}`);
  return key || undefined;
}

interface PriceResult {
  productId: number;
  productName?: string;
  success: boolean;
  price?: number;
  currency?: string;
  source?: string;
  date?: string;
  error?: string;
  estimated?: boolean;
}

export async function searchInstruments(query: string): Promise<any[]> {
  const results: any[] = [];
  const q = query.trim();
  if (!q) return results;

  const isIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(q);
  const isTicker = /^[A-Z]{1,6}([.-][A-Z]{1,3})?$/.test(q);

  if (isIsin || isTicker || (!isIsin && q.length <= 10)) {
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
        });
        if (resp.ok) {
          const data = await resp.json() as any;
          for (const quote of data?.quotes || []) {
            if (results.find(r => r.ticker === quote.symbol)) continue;
            results.push({
              name: quote.longname || quote.shortname || quote.symbol,
              type: mapYahooType(quote.quoteType),
              ticker: quote.symbol,
              isin: quote.isin || null,
              currency: quote.currency || 'EUR',
              source: 'Yahoo Finance',
            });
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {}
  }

  const lowerQ = q.toLowerCase();
  if (lowerQ === 'bitcoin' || lowerQ === 'btc') {
    results.push({ name: 'Bitcoin', type: 'cripto', ticker: 'BTC', isin: null, currency: 'EUR', source: 'CoinGecko' });
  } else if (lowerQ === 'ethereum' || lowerQ === 'eth') {
    results.push({ name: 'Ethereum', type: 'cripto', ticker: 'ETH', isin: null, currency: 'EUR', source: 'CoinGecko' });
  }

  return results;
}

function mapYahooType(quoteType: string): string {
  switch (quoteType) {
    case 'MUTUALFUND': return 'renta_variable';
    case 'ETF': return 'renta_variable';
    case 'EQUITY': return 'accion';
    case 'CRYPTOCURRENCY': return 'cripto';
    case 'INDEX': return 'renta_variable';
    default: return 'accion';
  }
}

function logPrice(productName: string, provider: string, symbol: string, status: string, detail?: string) {
  const ts = new Date().toISOString();
  console.log(`[PRECIO] ${ts} | ${productName} | ${provider} | ${symbol} | ${status}${detail ? ' | ' + detail : ''}`);
}

export async function updateAllPrices(): Promise<{ results: PriceResult[]; errors: string[] }> {
  const products = await getAllProductsWithArchived();
  const results: PriceResult[] = [];
  const errors: string[] = [];

  for (const product of products) {
    if (product.archived || product.manual_price) continue;
    if (!product.ticker && !product.isin && !product.alt_symbol) continue;

    const result = await fetchProductPrice(product);
    results.push(result);

    if (!result.success && result.error) {
      errors.push(`${product.name}: ${result.error}`);
    }

    await sequentialDelay();
  }

  return { results, errors };
}

export async function updateProductPrice(productId: number): Promise<PriceResult> {
  const product = await getProductById(productId);
  if (!product) return { productId, success: false, error: 'Producto no encontrado' };
  return fetchProductPrice(product);
}

export async function fetchAndStoreMarketDetails(productId: number, symbol: string): Promise<void> {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };
    const cookieRes = await fetch('https://fc.yahoo.com', { headers });
    const cookie = cookieRes.headers.get('set-cookie');
    if (!cookie) return;

    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { ...headers, cookie } });
    if (!crumbRes.ok) return;
    const crumb = await crumbRes.text();
    if (!crumb) return;

    const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=topHoldings,assetProfile&crumb=${encodeURIComponent(crumb)}`;
    const summaryRes = await fetch(summaryUrl, { headers: { ...headers, cookie } });
    if (!summaryRes.ok) return;

    const json = await summaryRes.json() as any;
    const res = json?.quoteSummary?.result?.[0];
    if (!res) return;

    let countryBreakdown: { country: string; percentage: number }[] | null = null;
    let sectorBreakdown: { sector: string; percentage: number }[] | null = null;
    let topHoldings: { name: string; percentage: number }[] | null = null;

    if (res.topHoldings) {
      if (Array.isArray(res.topHoldings.holdings) && res.topHoldings.holdings.length > 0) {
        topHoldings = res.topHoldings.holdings.slice(0, 10).map((h: any) => ({
          name: h.holdingName || h.symbol || 'Posición',
          percentage: (h.holdingPercent?.raw || 0) * 100,
        })).filter((h: any) => h.percentage > 0);
      }

      if (Array.isArray(res.topHoldings.sectorWeightings) && res.topHoldings.sectorWeightings.length > 0) {
        const sectorNamesMap: Record<string, string> = {
          realestate: 'Bienes Raíces',
          consumer_cyclical: 'Consumo Cíclico',
          basic_materials: 'Materiales Básicos',
          consumer_defensive: 'Consumo Defensivo',
          technology: 'Tecnología',
          communication_services: 'Servicios de Comunicación',
          financial_services: 'Servicios Financieros',
          utilities: 'Servicios Públicos',
          industrials: 'Industrial',
          energy: 'Energía',
          healthcare: 'Salud',
        };
        sectorBreakdown = res.topHoldings.sectorWeightings.map((sw: any) => {
          const key = Object.keys(sw)[0];
          const val = sw[key]?.raw || 0;
          return {
            sector: sectorNamesMap[key] || key,
            percentage: val * 100,
          };
        }).filter((s: any) => s.percentage > 0).sort((a: any, b: any) => b.percentage - a.percentage);
      }
    }

    if (res.assetProfile) {
      if (res.assetProfile.sector) {
        if (!sectorBreakdown || sectorBreakdown.length === 0) {
          sectorBreakdown = [{ sector: res.assetProfile.sector, percentage: 100 }];
        }
      }
      if (res.assetProfile.country) {
        countryBreakdown = [{ country: res.assetProfile.country, percentage: 100 }];
      }
    }

    const updates: Partial<any> = {};
    if (countryBreakdown && countryBreakdown.length > 0) {
      updates.country_breakdown = countryBreakdown.map(c => `${c.country}: ${c.percentage.toFixed(2)}%`).join('\n');
    }
    if (sectorBreakdown && sectorBreakdown.length > 0) {
      updates.sector_breakdown = sectorBreakdown.map(s => `${s.sector}: ${s.percentage.toFixed(2)}%`).join('\n');
    }
    if (topHoldings && topHoldings.length > 0) {
      updates.top_holdings = topHoldings.map(h => `${h.name}: ${h.percentage.toFixed(2)}%`).join('\n');
    }

    if (Object.keys(updates).length > 0) {
      await updateProduct(productId, updates);
    }
  } catch (e: any) {
    console.error('Error al obtener datos de mercado Yahoo para', symbol, e.message);
  }
}

async function fetchProductPrice(product: {
  id: number; name: string; ticker: string | null; isin: string | null;
  currency: string; price_source: string | null; alt_source: string | null;
  alt_symbol: string | null; type: string;
}): Promise<PriceResult> {
  const today = new Date().toISOString().slice(0, 10);

  const existingPrice = await getLatestPrice(product.id);
  if (existingPrice && existingPrice.date === today && existingPrice.source !== 'estimado') {
    logPrice(product.name, 'cache', product.ticker || product.isin || '', 'OK (cached)');
    return { productId: product.id, productName: product.name, success: true, price: existingPrice.price, currency: existingPrice.currency, source: existingPrice.source, date: today };
  }

  const symbol = product.ticker || product.isin;
  const primarySource = product.price_source || (product.type === 'cripto' ? 'coingecko' : 'yahoo');
  const primaryProvider = getProvider(primarySource);
  const altProvider = product.alt_source ? getProvider(product.alt_source) : null;
  const altSymbol = product.alt_symbol;

  const sourceChain: { provider: PriceProvider; symbol: string; name: string; apiKey?: string }[] = [];
  if (primaryProvider && symbol) {
    const apiKey = await getApiKey(primarySource);
    sourceChain.push({ provider: primaryProvider, symbol, name: primarySource, apiKey });
  }
  if (altProvider && altSymbol) {
    const apiKey = await getApiKey(product.alt_source!);
    sourceChain.push({ provider: altProvider, symbol: altSymbol, name: product.alt_source!, apiKey });
  }
  if (primaryProvider?.name !== 'Stooq' && product.type !== 'cripto') {
    sourceChain.push({ provider: stooqProvider, symbol: symbol || altSymbol || '', name: 'stooq' });
  }

  for (const { provider, symbol: sym, name, apiKey } of sourceChain) {
    if (!sym) continue;
    const result = await provider.fetchLatest(sym, apiKey);
    if (result) {
      await savePrice(product.id, result.price, result.currency, result.source, today);
      logPrice(product.name, provider.name, sym, 'OK', `${result.price} ${result.currency}`);

      // Intentar enriquecer datos de mercado (país, sector, top 10 posiciones)
      if (provider.name === 'Yahoo Finance') {
        fetchAndStoreMarketDetails(product.id, sym).catch(() => {});
      } else if (provider.name === 'Morningstar') {
        // Morningstar provider automatically updates product market breakdowns during fetch
      }

      return { productId: product.id, productName: product.name, success: true, price: result.price, currency: result.currency, source: result.source, date: today };
    } else {
      logPrice(product.name, provider.name, sym, 'FAIL', 'sin respuesta');
    }
  }

  const lastPrice = await getLatestPrice(product.id);
  if (lastPrice) {
    logPrice(product.name, 'fallback', product.ticker || product.isin || '', 'OK (last saved)', `${lastPrice.price}`);
    return { productId: product.id, productName: product.name, success: false, error: 'No se pudo actualizar, se mantiene último precio', price: lastPrice.price, currency: lastPrice.currency, source: lastPrice.source || undefined, date: lastPrice.date };
  }

  const estimated = await getEstimatedPriceFromPurchase(product.id);
  if (estimated) {
    await savePrice(product.id, estimated.price, 'EUR', 'estimado', today);
    logPrice(product.name, 'estimado', '', 'OK (from purchase)', `${estimated.price}`);
    return { productId: product.id, productName: product.name, success: false, error: 'Sin precio real, usando estimación de última compra', price: estimated.price, currency: 'EUR', source: 'estimado', date: today, estimated: true };
  }

  logPrice(product.name, 'none', '', 'FAIL', 'sin precio ni estimación');
  return { productId: product.id, productName: product.name, success: false, error: 'Sin precio' };
}

async function getEstimatedPriceFromPurchase(productId: number): Promise<{ price: number } | null> {
  const movements = await getMovementsByProduct(productId);
  const purchases = movements
    .filter(m => m.type === 'compra' && m.units && m.units > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (purchases.length === 0) return null;
  const last = purchases[0];
  const price = Math.abs(last.amount_eur) / last.units!;
  return { price };
}

export async function downloadProductHistory(productId: number): Promise<{ success: boolean; count: number; error?: string }> {
  const product = await getProductById(productId);
  if (!product) return { success: false, count: 0, error: 'Producto no encontrado' };

  const movements = await getMovementsByProduct(productId);
  if (movements.length === 0) return { success: false, count: 0, error: 'Sin movimientos' };

  const firstDate = movements.reduce((min, m) => m.date < min ? m.date : min, movements[0].date);
  const fromDate = new Date(firstDate);
  fromDate.setMonth(fromDate.getMonth() - 1);
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDateStr = fromDate.toISOString().slice(0, 10);

  const symbol = product.ticker || product.isin;
  const primarySource = product.price_source || (product.type === 'cripto' ? 'coingecko' : 'yahoo');
  const primaryProvider = getProvider(primarySource);
  const altProvider = product.alt_source ? getProvider(product.alt_source) : null;
  const altSymbol = product.alt_symbol;

  let history: HistoricalPrice[] = [];

  if (primaryProvider && symbol) {
    const apiKey = await getApiKey(primarySource);
    history = await primaryProvider.fetchHistory(symbol, fromDateStr, toDate, apiKey);
    logPrice(product.name, primaryProvider.name, symbol, history.length > 0 ? `HIST OK (${history.length})` : 'HIST FAIL');
  }

  if (history.length === 0 && altProvider && altSymbol) {
    const apiKey = await getApiKey(product.alt_source!);
    history = await altProvider.fetchHistory(altSymbol, fromDateStr, toDate, apiKey);
    logPrice(product.name, altProvider.name, altSymbol, history.length > 0 ? `HIST OK (${history.length})` : 'HIST FAIL');
  }

  if (history.length === 0 && primaryProvider?.name !== 'Stooq' && product.type !== 'cripto') {
    history = await stooqProvider.fetchHistory(symbol || altSymbol || '', fromDateStr, toDate);
    logPrice(product.name, 'Stooq', symbol || altSymbol || '', history.length > 0 ? `HIST OK (${history.length})` : 'HIST FAIL');
  }

  if (history.length === 0) {
    return { success: false, count: 0, error: 'No se pudo descargar el histórico de ninguna fuente' };
  }

  await savePriceHistory(productId, history);
  return { success: true, count: history.length };
}

export async function importCsvHistory(productId: number, csvText: string): Promise<{ success: boolean; count: number; error?: string }> {
  const history = parseCsvHistory(csvText);
  if (history.length === 0) return { success: false, count: 0, error: 'No se pudo parsear el CSV' };
  await savePriceHistory(productId, history);
  return { success: true, count: history.length };
}

export async function testPriceSource(sourceName: string, symbol: string, apiKey?: string): Promise<{
  source: string; symbol: string; success: boolean; httpStatus?: number; responseTime?: number; error?: string; price?: number; currency?: string;
}> {
  const provider = getProvider(sourceName);
  if (!provider) return { source: sourceName, symbol, success: false, error: 'Proveedor no encontrado' };

  const start = Date.now();
  try {
    const result = await provider.fetchLatest(symbol, apiKey);
    const elapsed = Date.now() - start;
    if (result) {
      return { source: provider.name, symbol, success: true, responseTime: elapsed, price: result.price, currency: result.currency };
    }
    return { source: provider.name, symbol, success: false, responseTime: elapsed, error: 'Sin respuesta válida' };
  } catch (err: any) {
    return { source: provider.name, symbol, success: false, responseTime: Date.now() - start, error: err.message };
  }
}

export async function testAllSources(symbol: string): Promise<any[]> {
  const results: any[] = [];
  const sources = [
    { name: 'yahoo', label: 'Yahoo Finance' },
    { name: 'stooq', label: 'Stooq' },
    { name: 'coingecko', label: 'CoinGecko' },
    { name: 'twelve-data', label: 'Twelve Data' },
    { name: 'alpha-vantage', label: 'Alpha Vantage' },
  ];
  for (const s of sources) {
    const apiKey = await getApiKey(s.name);
    const result = await testPriceSource(s.name, symbol, apiKey);
    results.push({ ...result, label: s.label });
  }
  return results;
}

export async function saveApiKey(providerName: string, key: string): Promise<void> {
  const settingKey = `api_key_${providerName.toLowerCase().replace(/[\s-]/g, '_')}`;
  await setSetting(settingKey, key);
}

export async function getApiKeyForProvider(providerName: string): Promise<string | null> {
  const settingKey = `api_key_${providerName.toLowerCase().replace(/[\s-]/g, '_')}`;
  return getSetting(settingKey);
}

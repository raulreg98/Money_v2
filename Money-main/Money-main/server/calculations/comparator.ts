interface SimMovement {
  date: string;
  type: string;
  amount_eur: number;
}

export interface ComparatorResult {
  name: string;
  currentValue: number;
  invested: number;
  gain: number;
  returnPct: number;
  xirr: number | null;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  series: { date: string; value: number }[];
}

interface PricePoint {
  date: string;
  price: number;
}

export function simulateInvestment(
  movements: SimMovement[],
  priceHistory: PricePoint[],
  name: string,
): ComparatorResult {
  const sortedPrices = [...priceHistory].sort((a, b) => a.date.localeCompare(b.date));
  if (sortedPrices.length === 0) {
    return { name, currentValue: 0, invested: 0, gain: 0, returnPct: 0, xirr: null, volatility: 0, sharpe: 0, maxDrawdown: 0, series: [] };
  }

  const getPriceAt = (date: string): { price: number; date: string } => {
    let found: PricePoint | null = null;
    for (const p of sortedPrices) {
      if (p.date <= date) found = p;
      else break;
    }
    if (!found) found = sortedPrices[0];
    return found;
  };

  const sortedMovements = [...movements].sort((a, b) => a.date.localeCompare(b.date));
  let shares = 0;
  let invested = 0;
  let cashFlows: { date: Date; amount: number }[] = [];
  const series: { date: string; value: number }[] = [];

  const dailyValues = new Map<string, { shares: number; invested: number }>();

  for (const m of sortedMovements) {
    const pp = getPriceAt(m.date);
    if (pp.price <= 0) continue;
    if (m.type === 'compra' || m.type === 'saldo') {
      shares += m.amount_eur / pp.price;
      invested += m.amount_eur;
      cashFlows.push({ date: new Date(m.date), amount: -m.amount_eur });
      dailyValues.set(m.date, { shares, invested });
    } else if (m.type === 'venta') {
      const sharesToSell = m.amount_eur / pp.price;
      shares = Math.max(0, shares - sharesToSell);
      invested -= m.amount_eur;
      cashFlows.push({ date: new Date(m.date), amount: m.amount_eur });
      dailyValues.set(m.date, { shares, invested });
    } else if (m.type === 'dividendo') {
      cashFlows.push({ date: new Date(m.date), amount: m.amount_eur });
    }
  }

  const lastPrice = sortedPrices[sortedPrices.length - 1].price;
  const currentValue = shares * lastPrice;

  if (currentValue > 0) {
    cashFlows.push({ date: new Date(), amount: currentValue });
  }

  const gain = currentValue - invested;
  const returnPct = invested > 0 ? (gain / invested) * 100 : 0;

  const sortedDates = Array.from(dailyValues.keys()).sort();
  if (sortedDates.length > 0) {
    const start = new Date(sortedDates[0]);
    const end = new Date();
    let currentShares = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dv = dailyValues.get(dateStr);
      if (dv) currentShares = dv.shares;
      const pp = getPriceAt(dateStr);
      series.push({ date: dateStr, value: currentShares * pp.price });
    }
  }

  const xirrResult = computeXirr(cashFlows);
  const volatility = computeVol(series);
  const sharpe = volatility > 0 ? ((returnPct - 2) / volatility) : 0;
  const maxDd = computeMaxDrawdown(series);

  return {
    name,
    currentValue,
    invested,
    gain,
    returnPct,
    xirr: xirrResult,
    volatility,
    sharpe,
    maxDrawdown: maxDd,
    series,
  };
}

function computeXirr(cashFlows: { date: Date; amount: number }[]): number | null {
  if (cashFlows.length < 2) return null;
  const positive = cashFlows.some(cf => cf.amount > 0);
  const negative = cashFlows.some(cf => cf.amount < 0);
  if (!positive || !negative) return null;

  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();

  const npv = (rate: number): number => {
    return sorted.reduce((sum, cf) => {
      const years = (cf.date.getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
      return sum + cf.amount / Math.pow(1 + rate, years);
    }, 0);
  };

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    let df = 0;
    for (const cf of sorted) {
      const years = (cf.date.getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
      df -= (years * cf.amount) / Math.pow(1 + rate, years + 1);
    }
    if (Math.abs(df) < 1e-12) break;
    const newRate = rate - f / df;
    if (Math.abs(newRate - rate) < 1e-9) break;
    rate = Math.max(-0.9999, Math.min(100, newRate));
  }

  return Math.abs(npv(rate)) > 1e-6 ? null : rate * 100;
}

function computeVol(series: { date: string; value: number }[]): number {
  if (series.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1].value > 0) {
      returns.push((series[i].value - series[i - 1].value) / series[i - 1].value);
    }
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function computeMaxDrawdown(series: { date: string; value: number }[]): number {
  if (series.length < 2) return 0;
  let peak = series[0].value;
  let maxDd = 0;
  for (const p of series) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) {
      const dd = (peak - p.value) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd * 100;
}

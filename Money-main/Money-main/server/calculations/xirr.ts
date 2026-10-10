interface CashFlow {
  date: Date;
  amount: number;
}

export function xirr(cashFlows: CashFlow[], guess = 0.1): number | null {
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

  const dnpv = (rate: number): number => {
    return sorted.reduce((sum, cf) => {
      const years = (cf.date.getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
      return sum - (years * cf.amount) / Math.pow(1 + rate, years + 1);
    }, 0);
  };

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (Math.abs(df) < 1e-12) break;
    const newRate = rate - f / df;
    if (Math.abs(newRate - rate) < 1e-9) return newRate;
    rate = newRate;
    if (rate < -0.9999) rate = -0.9999;
    if (rate > 100) rate = 100;
  }

  if (Math.abs(npv(rate)) > 1e-6) return null;
  return rate;
}

export function xirrPercent(cashFlows: CashFlow[], guess?: number): number | null {
  const r = xirr(cashFlows, guess);
  return r === null ? null : r * 100;
}

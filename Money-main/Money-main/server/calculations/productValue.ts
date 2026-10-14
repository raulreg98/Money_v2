import { computeFifo } from './fifo';

export interface ProductValueAtDate {
  date: string;
  units: number;
  price: number | null;
  value: number;
  invested: number;
  source: string | null;
}

export function computeProductValueAtDate(
  movements: { type: string; date: string; units: number; amount_eur: number }[],
  priceHistory: { date: string; price: number }[],
  date: string,
): ProductValueAtDate {
  const movementsUpTo = movements.filter(m => m.date <= date);
  const fifo = computeFifo(movementsUpTo);

  const sortedPrices = [...priceHistory].sort((a, b) => a.date.localeCompare(b.date));
  let price: number | null = null;
  let source: string | null = null;
  for (const p of sortedPrices) {
    if (p.date <= date) price = p.price;
    else break;
  }

  const value = price !== null ? fifo.remainingUnits * price : 0;

  return {
    date,
    units: fifo.remainingUnits,
    price,
    value,
    invested: fifo.totalCost,
    source,
  };
}

export function computeProductSeries(
  movements: { type: string; date: string; units: number; amount_eur: number }[],
  priceHistory: { date: string; price: number; source?: string }[],
  fromDate: string,
  toDate: string,
): ProductValueAtDate[] {
  const sortedPrices = [...priceHistory].sort((a, b) => a.date.localeCompare(b.date));
  const sortedMovements = [...movements].sort((a, b) => a.date.localeCompare(b.date));

  const result: ProductValueAtDate[] = [];
  const dStart = new Date(fromDate);
  const dEnd = new Date(toDate);

  for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const movementsUpTo = sortedMovements.filter(m => m.date <= dateStr);
    const fifo = computeFifo(movementsUpTo);

    let price: number | null = null;
    let source: string | null = null;
    for (const p of sortedPrices) {
      if (p.date <= dateStr) { price = p.price; source = p.source ?? null; }
      else break;
    }

    const value = price !== null ? fifo.remainingUnits * price : 0;

    result.push({ date: dateStr, units: fifo.remainingUnits, price, value, invested: fifo.totalCost, source });
  }

  return result;
}

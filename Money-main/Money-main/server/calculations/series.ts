interface DayValue {
  date: string;
  value: number;
}

export function computeDailySeries(
  movements: { type: string; date: string; amount_eur: number; units?: number | null }[],
  priceHistory: { date: string; price: number }[],
  valuations: { date: string; value_eur: number }[],
  latestValue: number,
  startDate?: string,
  endDate?: string,
): DayValue[] {
  const series: DayValue[] = [];
  if (movements.length === 0 && valuations.length === 0) return series;

  const allDates = new Set<string>();
  for (const m of movements) allDates.add(m.date);
  for (const v of valuations) allDates.add(v.date);

  const sortedDates = Array.from(allDates).sort();
  if (sortedDates.length === 0) return series;

  const start = startDate || sortedDates[0];
  const end = endDate || new Date().toISOString().slice(0, 10);

  const sortedPrices = [...priceHistory].sort((a, b) => a.date.localeCompare(b.date));
  const sortedValuations = [...valuations].sort((a, b) => a.date.localeCompare(b.date));

  const movementsByDate = new Map<string, number>();
  for (const m of movements) {
    const prev = movementsByDate.get(m.date) || 0;
    let delta = 0;
    if (m.type === 'compra' || m.type === 'saldo') delta = -m.amount_eur;
    else if (m.type === 'venta') delta = m.amount_eur;
    else if (m.type === 'dividendo') delta = m.amount_eur;
    movementsByDate.set(m.date, prev + delta);
  }

  let invested = 0;
  const currentValue = latestValue;

  const getPriceAt = (date: string): number | null => {
    let found: { date: string; price: number } | null = null;
    for (const p of sortedPrices) {
      if (p.date <= date) found = p;
      else break;
    }
    return found ? found.price : null;
  };

  const getValuationAt = (date: string): number | null => {
    let found: { date: string; value_eur: number } | null = null;
    for (const v of sortedValuations) {
      if (v.date <= date) found = v;
      else break;
    }
    return found ? found.value_eur : null;
  };

  const dStart = new Date(start);
  const dEnd = new Date(end);

  const sortedMovements = [...movements].sort((a, b) => a.date.localeCompare(b.date));
  let runningUnits = 0;
  let prevValue = 0;

  for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);

    // Update running units for this date
    for (const m of sortedMovements) {
      if (m.date === dateStr) {
        if (m.type === 'compra' || m.type === 'saldo') {
          runningUnits += (m.units || 0);
        } else if (m.type === 'venta') {
          runningUnits -= (m.units || 0);
        }
      }
    }

    const price = getPriceAt(dateStr);
    const val = getValuationAt(dateStr);

    let dayValue = prevValue;
    if (val !== null) {
      dayValue = val;
    } else if (price !== null && runningUnits > 0) {
      dayValue = runningUnits * price;
    } else if (sortedPrices.length > 0 && runningUnits > 0) {
      // Use nearest price
      dayValue = runningUnits * sortedPrices[0].price;
    } else if (movementsByDate.get(dateStr) !== undefined) {
      dayValue = Math.abs(movementsByDate.get(dateStr)!);
    }

    if (dayValue > 0) prevValue = dayValue;
    series.push({ date: dateStr, value: dayValue });
  }

  if (series.length > 0 && currentValue > 0) {
    series[series.length - 1].value = currentValue;
  }

  return series;
}

export function computeMaxDrawdown(series: DayValue[]): number {
  if (series.length < 2) return 0;
  let peak = series[0].value;
  let maxDd = 0;
  for (const point of series) {
    if (point.value > peak) peak = point.value;
    if (peak > 0) {
      const dd = (peak - point.value) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd * 100;
}

export function computeVolatility(series: DayValue[]): number {
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
  const std = Math.sqrt(variance);
  return std * Math.sqrt(252) * 100;
}

export function computeSharpe(series: DayValue[], riskFreeRate = 0.02): number {
  const vol = computeVolatility(series);
  if (vol === 0) return 0;
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1].value > 0) {
      returns.push((series[i].value - series[i - 1].value) / series[i - 1].value);
    }
  }
  if (returns.length === 0) return 0;
  const annualReturn = returns.reduce((s, r) => s + r, 0) / returns.length * 252 * 100;
  return (annualReturn - riskFreeRate * 100) / vol;
}

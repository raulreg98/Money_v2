const MONTH_NAMES_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export function localISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function openingBalance(
  initial: number,
  txs: { date: string; amount: number }[],
  desde: string
): number {
  if (!desde) return initial;
  let total = initial;
  for (const t of txs) {
    if (t.date < desde) {
      total += t.amount;
    }
  }
  return total;
}

export function buildBalanceSeries(
  txs: { date: string; amount: number }[],
  opening: number,
  desde: string,
  hasta: string
): { date: string; balance: number }[] {
  if (desde && hasta && desde > hasta) {
    return [];
  }

  // Filter transactions within [desde, hasta]
  const periodTxs = txs.filter((t) => {
    if (desde && t.date < desde) return false;
    if (hasta && t.date > hasta) return false;
    return true;
  });

  // Group by date
  const dayMap = new Map<string, number>();
  for (const t of periodTxs) {
    dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amount);
  }

  const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a.localeCompare(b));

  if (!desde) {
    // "Todo" mode
    if (sortedDays.length === 0) return [];
    const series: { date: string; balance: number }[] = [];
    let running = opening;
    for (const day of sortedDays) {
      running += dayMap.get(day)!;
      series.push({ date: day, balance: running });
    }
    if (hasta && series.length > 0 && series[series.length - 1].date < hasta) {
      series.push({ date: hasta, balance: running });
    }
    return series;
  }

  // "desde" is specified
  if (sortedDays.length === 0) {
    if (desde === hasta) {
      return [{ date: desde, balance: opening }];
    }
    return [
      { date: desde, balance: opening },
      { date: hasta, balance: opening },
    ];
  }

  const series: { date: string; balance: number }[] = [];
  let running = opening;

  // If first tx day is after "desde", add starting point at "desde"
  if (sortedDays[0] > desde) {
    series.push({ date: desde, balance: opening });
  }

  for (const day of sortedDays) {
    running += dayMap.get(day)!;
    series.push({ date: day, balance: running });
  }

  if (hasta && series[series.length - 1].date < hasta) {
    series.push({ date: hasta, balance: running });
  }

  return series;
}

function parseUTCDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUTCDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMondayOfUTCWeek(d: Date): Date {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
}

export function buildPeriodBars(
  txs: { date: string; amount: number; type: string }[],
  desde: string,
  hasta: string
): {
  granularity: 'week' | 'month';
  bars: { key: string; label: string; ingresos: number; gastos: number }[];
} {
  let effectiveDesde = desde;
  if (!effectiveDesde) {
    if (txs.length === 0) {
      return { granularity: 'month', bars: [] };
    }
    effectiveDesde = txs.reduce((min, t) => (t.date < min ? t.date : min), txs[0].date);
  }

  if (hasta && effectiveDesde > hasta) {
    return { granularity: 'week', bars: [] };
  }

  const dStart = parseUTCDate(effectiveDesde);
  const dEnd = hasta ? parseUTCDate(hasta) : dStart;

  const diffMs = dEnd.getTime() - dStart.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  const granularity: 'week' | 'month' = totalDays <= 45 ? 'week' : 'month';

  // Filter relevant txs
  const filteredTxs = txs.filter((t) => {
    if (t.type !== 'ingreso' && t.type !== 'gasto') return false;
    if (effectiveDesde && t.date < effectiveDesde) return false;
    if (hasta && t.date > hasta) return false;
    return true;
  });

  if (granularity === 'week') {
    const mondayMap = new Map<string, { key: string; label: string; ingresos: number; gastos: number }>();

    // Build all Monday keys from Monday of dStart to Monday of dEnd
    const startMonday = getMondayOfUTCWeek(dStart);
    const endMonday = getMondayOfUTCWeek(dEnd);

    const curr = new Date(startMonday.getTime());
    while (curr.getTime() <= endMonday.getTime()) {
      const key = formatUTCDate(curr);
      const labelDate = curr < dStart ? dStart : curr;
      const dayNum = labelDate.getUTCDate();
      const monthName = MONTH_NAMES_SHORT[labelDate.getUTCMonth()];
      const label = `${dayNum} ${monthName}`;

      mondayMap.set(key, { key, label, ingresos: 0, gastos: 0 });
      curr.setUTCDate(curr.getUTCDate() + 7);
    }

    for (const t of filteredTxs) {
      const tDate = parseUTCDate(t.date);
      const m = getMondayOfUTCWeek(tDate);
      const mKey = formatUTCDate(m);
      const bar = mondayMap.get(mKey);
      if (bar) {
        if (t.type === 'ingreso') bar.ingresos += t.amount;
        else if (t.type === 'gasto') bar.gastos += Math.abs(t.amount);
      }
    }

    return {
      granularity: 'week',
      bars: Array.from(mondayMap.values()),
    };
  }

  // Monthly granularity
  const monthMap = new Map<string, { key: string; label: string; ingresos: number; gastos: number }>();

  const startYear = dStart.getUTCFullYear();
  const startMonth = dStart.getUTCMonth();
  const endYear = dEnd.getUTCFullYear();
  const endMonth = dEnd.getUTCMonth();

  const spansMultipleYears = startYear !== endYear;

  let y = startYear;
  let m = startMonth;

  while (y < endYear || (y === endYear && m <= endMonth)) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const name = MONTH_NAMES_SHORT[m];
    const label = spansMultipleYears ? `${name} ${String(y).slice(2)}` : name;

    monthMap.set(key, { key, label, ingresos: 0, gastos: 0 });

    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }

  for (const t of filteredTxs) {
    const key = t.date.slice(0, 7);
    const bar = monthMap.get(key);
    if (bar) {
      if (t.type === 'ingreso') bar.ingresos += t.amount;
      else if (t.type === 'gasto') bar.gastos += Math.abs(t.amount);
    }
  }

  return {
    granularity: 'month',
    bars: Array.from(monthMap.values()),
  };
}

import { MONTH_NAMES_FULL } from './format';

export type PeriodState =
  | { kind: 'month'; year: number; month: number /* 0-11 */ }
  | { kind: 'range'; id: '3M' | '6M' | '1A' | 'TODO' };

export function localISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function currentMonthPeriod(now = new Date()): PeriodState {
  return {
    kind: 'month',
    year: now.getFullYear(),
    month: now.getMonth(),
  };
}

export function shiftMonth(p: PeriodState, delta: number): PeriodState {
  if (p.kind !== 'month') return p;
  const totalMonths = p.year * 12 + p.month + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = ((totalMonths % 12) + 12) % 12;
  return {
    kind: 'month',
    year: newYear,
    month: newMonth,
  };
}

export function periodLabel(p: PeriodState): string {
  if (p.kind === 'month') {
    const name = MONTH_NAMES_FULL[p.month] || '';
    const capitalized = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
    return `${capitalized} ${p.year}`;
  }
  switch (p.id) {
    case '3M': return 'Últimos 3 meses';
    case '6M': return 'Últimos 6 meses';
    case '1A': return 'Últimos 12 meses';
    case 'TODO': return 'Todo el histórico';
  }
}

export function periodToRange(p: PeriodState, now = new Date()): { desde: string; hasta: string } {
  const nowISO = localISODate(now);

  if (p.kind === 'month') {
    const yStr = String(p.year);
    const mStr = String(p.month + 1).padStart(2, '0');
    const desde = `${yStr}-${mStr}-01`;

    const isCurrentMonth = p.year === now.getFullYear() && p.month === now.getMonth();
    if (isCurrentMonth) {
      return { desde, hasta: nowISO };
    }

    const lastDayNum = new Date(Date.UTC(p.year, p.month + 1, 0)).getUTCDate();
    const dStr = String(lastDayNum).padStart(2, '0');
    return { desde, hasta: `${yStr}-${mStr}-${dStr}` };
  }

  // Range mode
  if (p.id === 'TODO') {
    return { desde: '', hasta: nowISO };
  }

  let monthsToSubtract = 2; // for 3M (current month + 2 prior = 3 total)
  if (p.id === '6M') monthsToSubtract = 5;
  if (p.id === '1A') monthsToSubtract = 11;

  const totalMonths = now.getFullYear() * 12 + now.getMonth() - monthsToSubtract;
  const startYear = Math.floor(totalMonths / 12);
  const startMonth = ((totalMonths % 12) + 12) % 12;

  const yStr = String(startYear);
  const mStr = String(startMonth + 1).padStart(2, '0');
  const desde = `${yStr}-${mStr}-01`;

  return { desde, hasta: nowISO };
}

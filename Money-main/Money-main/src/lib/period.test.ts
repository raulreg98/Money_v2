import { describe, it, expect } from 'vitest';
import {
  localISODate,
  currentMonthPeriod,
  shiftMonth,
  periodLabel,
  periodToRange,
  type PeriodState,
} from './period';

describe('period utilities', () => {
  const mockNow = new Date(2026, 9, 15);

  it('localISODate formats local Date correctly', () => {
    const d = new Date(2026, 9, 31, 23, 30);
    expect(localISODate(d)).toBe('2026-10-31');
  });

  it('currentMonthPeriod returns month object for given date', () => {
    expect(currentMonthPeriod(mockNow)).toEqual({
      kind: 'month',
      year: 2026,
      month: 9,
    });
  });

  it('shiftMonth shifts year and month safely without setMonth overflow', () => {
    const p1: PeriodState = { kind: 'month', year: 2026, month: 2 };
    expect(shiftMonth(p1, -1)).toEqual({ kind: 'month', year: 2026, month: 1 });
    expect(shiftMonth(p1, -3)).toEqual({ kind: 'month', year: 2025, month: 11 });
    expect(shiftMonth(p1, 10)).toEqual({ kind: 'month', year: 2027, month: 0 });
  });

  it('periodLabel generates Spanish capitalized labels', () => {
    expect(periodLabel({ kind: 'month', year: 2026, month: 9 })).toBe('Octubre 2026');
    expect(periodLabel({ kind: 'month', year: 2024, month: 1 })).toBe('Febrero 2024');
    expect(periodLabel({ kind: 'range', id: '3M' })).toBe('Últimos 3 meses');
    expect(periodLabel({ kind: 'range', id: '6M' })).toBe('Últimos 6 meses');
    expect(periodLabel({ kind: 'range', id: '1A' })).toBe('Últimos 12 meses');
    expect(periodLabel({ kind: 'range', id: 'TODO' })).toBe('Todo el histórico');
  });

  it('periodToRange calculates correct date bounds for past month and leap years', () => {
    const feb2024: PeriodState = { kind: 'month', year: 2024, month: 1 };
    expect(periodToRange(feb2024, mockNow)).toEqual({
      desde: '2024-02-01',
      hasta: '2024-02-29',
    });

    const feb2026: PeriodState = { kind: 'month', year: 2026, month: 1 };
    expect(periodToRange(feb2026, mockNow)).toEqual({
      desde: '2026-02-01',
      hasta: '2026-02-28',
    });

    const oct2026: PeriodState = { kind: 'month', year: 2026, month: 9 };
    expect(periodToRange(oct2026, mockNow)).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-15',
    });
  });

  it('periodToRange calculates correct bounds for range modes', () => {
    expect(periodToRange({ kind: 'range', id: '3M' }, mockNow)).toEqual({
      desde: '2026-08-01',
      hasta: '2026-10-15',
    });

    expect(periodToRange({ kind: 'range', id: '1A' }, mockNow)).toEqual({
      desde: '2025-11-01',
      hasta: '2026-10-15',
    });

    expect(periodToRange({ kind: 'range', id: 'TODO' }, mockNow)).toEqual({
      desde: '',
      hasta: '2026-10-15',
    });
  });
});

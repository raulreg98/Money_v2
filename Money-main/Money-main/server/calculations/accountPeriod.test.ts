import { describe, it, expect } from 'vitest';
import {
  localISODate,
  openingBalance,
  buildBalanceSeries,
  buildPeriodBars,
} from './accountPeriod';

describe('accountPeriod calculations', () => {
  const sampleTxs = [
    { date: '2026-08-20', type: 'ingreso', amount: 50 },
    { date: '2026-09-05', type: 'gasto', amount: -30 },
    { date: '2026-09-05', type: 'gasto', amount: -10 },
    { date: '2026-09-20', type: 'ingreso', amount: 200 },
    { date: '2026-10-02', type: 'gasto', amount: -40 },
  ];

  it('localISODate formats Date using local year, month, date', () => {
    const d = new Date(2026, 9, 31, 23, 30);
    expect(localISODate(d)).toBe('2026-10-31');
  });

  it('openingBalance calculates sum prior to desde', () => {
    expect(openingBalance(100, sampleTxs, '2026-09-01')).toBe(150);
    expect(openingBalance(100, sampleTxs, '')).toBe(100);
  });

  it('spec test case 1: September 2026 (desde=2026-09-01, hasta=2026-09-30)', () => {
    const opening = openingBalance(100, sampleTxs, '2026-09-01');
    expect(opening).toBe(150);

    const series = buildBalanceSeries(sampleTxs, opening, '2026-09-01', '2026-09-30');
    expect(series).toEqual([
      { date: '2026-09-01', balance: 150 },
      { date: '2026-09-05', balance: 110 },
      { date: '2026-09-20', balance: 310 },
      { date: '2026-09-30', balance: 310 },
    ]);

    const periodTxs = sampleTxs.filter(t => t.date >= '2026-09-01' && t.date <= '2026-09-30');
    expect(periodTxs.length).toBe(3);

    const { granularity, bars } = buildPeriodBars(sampleTxs, '2026-09-01', '2026-09-30');
    expect(granularity).toBe('week');
    expect(bars).toEqual([
      { key: '2026-08-31', label: '1 sep', ingresos: 0, gastos: 40 },
      { key: '2026-09-07', label: '7 sep', ingresos: 0, gastos: 0 },
      { key: '2026-09-14', label: '14 sep', ingresos: 200, gastos: 0 },
      { key: '2026-09-21', label: '21 sep', ingresos: 0, gastos: 0 },
      { key: '2026-09-28', label: '28 sep', ingresos: 0, gastos: 0 },
    ]);
  });

  it('spec test case 2: Aug - Oct 2026 (desde=2026-08-01, hasta=2026-10-15)', () => {
    const { granularity, bars } = buildPeriodBars(sampleTxs, '2026-08-01', '2026-10-15');
    expect(granularity).toBe('month');
    expect(bars).toEqual([
      { key: '2026-08', label: 'ago', ingresos: 50, gastos: 0 },
      { key: '2026-09', label: 'sep', ingresos: 200, gastos: 40 },
      { key: '2026-10', label: 'oct', ingresos: 0, gastos: 40 },
    ]);
  });

  it('handles tx exactly on desde', () => {
    const txs = [{ date: '2026-09-01', amount: -20 }];
    const series = buildBalanceSeries(txs, 100, '2026-09-01', '2026-09-05');
    expect(series).toEqual([
      { date: '2026-09-01', balance: 80 },
      { date: '2026-09-05', balance: 80 },
    ]);
  });

  it('handles period with no transactions', () => {
    const series = buildBalanceSeries([], 100, '2026-09-01', '2026-09-30');
    expect(series).toEqual([
      { date: '2026-09-01', balance: 100 },
      { date: '2026-09-30', balance: 100 },
    ]);
  });

  it('handles desde="" (Todo)', () => {
    const series = buildBalanceSeries(sampleTxs, 100, '', '2026-10-15');
    expect(series).toEqual([
      { date: '2026-08-20', balance: 150 },
      { date: '2026-09-05', balance: 110 },
      { date: '2026-09-20', balance: 310 },
      { date: '2026-10-02', balance: 270 },
      { date: '2026-10-15', balance: 270 },
    ]);
  });

  it('handles desde > hasta', () => {
    const series = buildBalanceSeries(sampleTxs, 100, '2026-10-01', '2026-09-01');
    expect(series).toEqual([]);
  });

  it('handles year transition for monthly bars label', () => {
    const txs = [
      { date: '2025-12-15', type: 'gasto', amount: -10 },
      { date: '2026-01-10', type: 'ingreso', amount: 100 },
    ];
    const { granularity, bars } = buildPeriodBars(txs, '2025-12-01', '2026-01-31');
    expect(granularity).toBe('month');
    expect(bars).toEqual([
      { key: '2025-12', label: 'dic 25', ingresos: 0, gastos: 10 },
      { key: '2026-01', label: 'ene 26', ingresos: 100, gastos: 0 },
    ]);
  });

  it('handles leap year february correctly', () => {
    const { granularity, bars } = buildPeriodBars([], '2024-02-01', '2024-02-29');
    expect(granularity).toBe('week');
    expect(bars.length).toBeGreaterThan(0);
  });
});

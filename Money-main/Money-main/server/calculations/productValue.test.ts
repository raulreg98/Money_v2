import { describe, it, expect } from 'vitest';
import { computeProductValueAtDate, computeProductSeries } from './productValue';

describe('computeProductValueAtDate', () => {
  it('returns zero value when no price history', () => {
    const result = computeProductValueAtDate(
      [{ type: 'compra', date: '2024-01-01', units: 10, amount_eur: 1000 }],
      [],
      '2024-06-01',
    );
    expect(result.units).toBe(10);
    expect(result.price).toBeNull();
    expect(result.value).toBe(0);
    expect(result.invested).toBe(1000);
  });

  it('computes value with price and units', () => {
    const result = computeProductValueAtDate(
      [{ type: 'compra', date: '2024-01-01', units: 10, amount_eur: 1000 }],
      [{ date: '2024-06-01', price: 120 }],
      '2024-06-01',
    );
    expect(result.units).toBe(10);
    expect(result.price).toBe(120);
    expect(result.value).toBe(1200);
    expect(result.invested).toBe(1000);
  });

  it('uses last known price before target date', () => {
    const result = computeProductValueAtDate(
      [{ type: 'compra', date: '2024-01-01', units: 10, amount_eur: 1000 }],
      [{ date: '2024-05-01', price: 110 }, { date: '2024-06-01', price: 120 }],
      '2024-06-15',
    );
    expect(result.price).toBe(120);
    expect(result.value).toBe(1200);
  });

  it('only counts movements up to date', () => {
    const result = computeProductValueAtDate(
      [
        { type: 'compra', date: '2024-01-01', units: 10, amount_eur: 1000 },
        { type: 'compra', date: '2024-07-01', units: 5, amount_eur: 600 },
      ],
      [{ date: '2024-06-01', price: 120 }],
      '2024-06-01',
    );
    expect(result.units).toBe(10);
    expect(result.invested).toBe(1000);
  });
});

describe('computeProductSeries', () => {
  it('produces daily series with carried-forward price', () => {
    const series = computeProductSeries(
      [{ type: 'compra', date: '2024-01-01', units: 10, amount_eur: 1000 }],
      [{ date: '2024-01-01', price: 100 }, { date: '2024-01-03', price: 110 }],
      '2024-01-01',
      '2024-01-05',
    );
    expect(series).toHaveLength(5);
    expect(series[0].price).toBe(100);
    expect(series[0].value).toBe(1000);
    expect(series[2].price).toBe(110);
    expect(series[2].value).toBe(1100);
    expect(series[4].price).toBe(110);
  });

  it('handles empty movements', () => {
    const series = computeProductSeries([], [], '2024-01-01', '2024-01-03');
    expect(series).toHaveLength(3);
    expect(series.every(s => s.units === 0 && s.value === 0)).toBe(true);
  });
});

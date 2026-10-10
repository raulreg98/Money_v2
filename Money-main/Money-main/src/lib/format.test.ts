import { describe, it, expect } from 'vitest';
import {
  formatEUR, formatNumber, formatPercent, formatCompact, formatDate,
  formatAxisEUR, formatAxisPercent, formatUnits,
} from './format';

describe('formatEUR', () => {
  it('formats a positive value with 2 decimals and euro sign', () => {
    const r = formatEUR(1234.5);
    expect(r).toMatch(/[\d.,]+50.*€/);
  });
  it('formats a negative value', () => {
    const r = formatEUR(-100);
    expect(r).toContain('100');
    expect(r).toMatch(/[−-]/);
    expect(r).toContain('€');
  });
  it('formats with + sign when requested', () => {
    expect(formatEUR(50, { sign: true })).toMatch(/\+/);
  });
  it('formats compact for millions', () => {
    expect(formatEUR(1_500_000, { compact: true })).toContain('M');
  });
  it('formats compact for thousands', () => {
    expect(formatEUR(25000, { compact: true })).toContain('k');
  });
  it('returns safe fallback for null/undefined/NaN/Infinity', () => {
    expect(formatEUR(null as any)).toContain('€');
    expect(formatEUR(undefined as any)).toContain('€');
    expect(formatEUR(NaN)).toContain('€');
    expect(formatEUR(Infinity as any)).toContain('€');
    expect(formatEUR(-Infinity as any)).toContain('€');
  });
});

describe('formatPercent', () => {
  it('formats positive with + prefix', () => {
    expect(formatPercent(5.5)).toMatch(/\+/);
    expect(formatPercent(5.5)).toContain('%');
  });
  it('formats negative', () => {
    const r = formatPercent(-3.2);
    expect(r).toContain('%');
    expect(r).toMatch(/[−-]/);
  });
  it('handles null/NaN', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(NaN)).toBe('—');
  });
  it('handles custom decimals', () => {
    expect(formatPercent(10, 1)).toContain('%');
  });
});

describe('formatNumber', () => {
  it('formats with default 2 decimals', () => {
    const r = formatNumber(1234.5);
    expect(r).toContain('50');
  });
  it('formats with custom decimals', () => {
    expect(formatNumber(42, 4)).toMatch(/0000/);
  });
  it('handles null/NaN', () => {
    expect(formatNumber(null as any)).toMatch(/\d/);
    expect(formatNumber(NaN)).toMatch(/\d/);
  });
});

describe('formatCompact', () => {
  it('formats millions', () => {
    expect(formatCompact(2_500_000)).toContain('M');
  });
  it('formats thousands', () => {
    expect(formatCompact(50000)).toContain('k');
  });
  it('formats small numbers', () => {
    const r = formatCompact(999);
    expect(r).toMatch(/\d/);
  });
  it('handles null/NaN', () => {
    expect(formatCompact(null as any)).toMatch(/\d/);
    expect(formatCompact(NaN)).toMatch(/\d/);
  });
});

describe('formatAxisEUR', () => {
  it('formats millions', () => {
    expect(formatAxisEUR(2_500_000)).toContain('M');
  });
  it('formats thousands', () => {
    expect(formatAxisEUR(50000)).toContain('k');
  });
  it('formats small numbers', () => {
    expect(formatAxisEUR(500)).toBe('500');
  });
  it('handles NaN', () => {
    expect(formatAxisEUR(NaN)).toBe('0');
  });
});

describe('formatAxisPercent', () => {
  it('formats with percent sign', () => {
    expect(formatAxisPercent(50)).toBe('50%');
  });
  it('handles NaN', () => {
    expect(formatAxisPercent(NaN)).toBe('0%');
  });
});

describe('formatUnits', () => {
  it('formats with 4 decimals', () => {
    expect(formatUnits(1.5)).toMatch(/1[.,]5000/);
  });
  it('handles zero', () => {
    expect(formatUnits(0)).toBe('0');
  });
  it('handles NaN', () => {
    expect(formatUnits(NaN)).toBe('0');
  });
});

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const r = formatDate('2026-03-15');
    expect(r).toContain('2026');
  });
  it('returns empty for falsy', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null as any)).toBe('');
  });
});

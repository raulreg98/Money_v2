function isInvalid(v: unknown): v is null | undefined {
  return v === null || v === undefined || (typeof v === 'number' && (isNaN(v) || !isFinite(v)));
}

function safeNum(v: unknown): number {
  if (isInvalid(v)) return 0;
  return v as number;
}

export function formatEUR(value: number, options?: { compact?: boolean; sign?: boolean }): string {
  const v = safeNum(value);
  const compact = options?.compact;
  const sign = options?.sign;
  const absValue = Math.abs(v);

  if (compact && absValue >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M €`;
  }
  if (compact && absValue >= 10_000) {
    return `${(v / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k €`;
  }

  const formatted = absValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefix = sign && v > 0 ? '+' : v < 0 ? '−' : '';
  return `${prefix}${formatted} €`;
}

export function formatNumber(value: number, decimals = 2): string {
  const v = safeNum(value);
  const d = Math.max(0, Math.min(20, Math.round(decimals)));
  return v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function formatPercent(value: number | null, decimals = 2): string {
  if (isInvalid(value)) return '—';
  const v = value as number;
  const d = Math.max(0, Math.min(20, Math.round(decimals)));
  const prefix = v > 0 ? '+' : '';
  return `${prefix}${v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
}

export function formatCompact(value: number): string {
  const v = safeNum(value);
  const absValue = Math.abs(v);

  if (absValue >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
  }
  if (absValue >= 10_000) {
    return `${(v / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} k`;
  }

  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatAxisEUR(value: number): string {
  const v = safeNum(value);
  const absValue = Math.abs(v);
  if (absValue >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (absValue >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return v.toFixed(0);
}

export function formatAxisEURPrecise(value: number): string {
  const v = safeNum(value);
  const absValue = Math.abs(v);
  if (absValue >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M€`;
  }
  if (absValue >= 1_000) {
    return `${(v / 1_000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} k€`;
  }
  return `${v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

export function formatAxisPercent(value: number): string {
  const v = safeNum(value);
  return `${v.toFixed(0)}%`;
}

export function formatUnits(value: number): string {
  const v = safeNum(value);
  if (v === 0) return '0';
  return v.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function formatDate(date: string): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateLong(date: string): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthName(month: number): string {
  const names = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return names[month] || '';
}

export function formatAxisDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parts[2].slice(0, 2);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthAbbr = monthName(monthIdx).toUpperCase();
  return `${day} ${monthAbbr}`;
}

export function formatAxisDateWithYear(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parts[2].slice(0, 2);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthAbbr = monthName(monthIdx).toUpperCase();
  const yearShort = parts[0].slice(2, 4);
  return `${day} ${monthAbbr} '${yearShort}`;
}

export function monthNameFull(month: number): string {
  const names = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return names[month] || '';
}

export const PRODUCT_TYPES: Record<string, string> = {
  renta_variable: 'Renta variable',
  fondo_monetario: 'Fondo monetario',
  cripto: 'Cripto',
  materia_prima: 'Materias primas',
  accion: 'Acciones',
};

export const ACCOUNT_TYPES: Record<string, string> = {
  corriente: 'Corriente',
  efectivo: 'Efectivo',
  ahorro: 'Ahorro',
  tarjeta: 'Tarjeta',
  inversion: 'Inversión',
};

export const MOVEMENT_TYPES: Record<string, string> = {
  compra: 'Compra',
  venta: 'Venta',
  dividendo: 'Dividendo',
  comision: 'Comisión',
  saldo: 'Saldo inicial',
};

export const CHART_COLORS = [
  '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#0d9488', '#f59e0b', '#6366f1',
  '#10b981', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6',
];

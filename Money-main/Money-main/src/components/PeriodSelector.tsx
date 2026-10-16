import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react';
import {
  type PeriodState,
  currentMonthPeriod,
  shiftMonth,
  periodLabel,
} from '../lib/period';
import { monthNameFull, monthName } from '../lib/format';

interface Props {
  value: PeriodState;
  onChange: (p: PeriodState) => void;
  firstTxDate?: string | null;
}

export function PeriodSelector({ value, onChange, firstTxDate }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Determine earliest year & month from firstTxDate
  const { minYear, minMonth } = useMemo(() => {
    if (!firstTxDate) {
      return { minYear: currentYear, minMonth: currentMonth };
    }
    const parts = firstTxDate.split('-').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { minYear: parts[0], minMonth: parts[1] - 1 };
    }
    return { minYear: currentYear, minMonth: currentMonth };
  }, [firstTxDate, currentYear, currentMonth]);

  // Year being navigated inside the dropdown dialog
  const [dropdownYear, setDropdownYear] = useState<number>(() => {
    return value.kind === 'month' ? value.year : currentYear;
  });

  // Keep dropdown year synced when value changes
  useEffect(() => {
    if (value.kind === 'month') {
      setDropdownYear(value.year);
    }
  }, [value]);

  // Close dropdown on click outside or Esc key
  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Check if prev / next month buttons should be disabled
  const isPrevDisabled = useMemo(() => {
    if (value.kind !== 'month') return true;
    if (value.year < minYear) return true;
    if (value.year === minYear && value.month <= minMonth) return true;
    return false;
  }, [value, minYear, minMonth]);

  const isNextDisabled = useMemo(() => {
    if (value.kind !== 'month') return true;
    if (value.year > currentYear) return true;
    if (value.year === currentYear && value.month >= currentMonth) return true;
    return false;
  }, [value, currentYear, currentMonth]);

  // Check if year navigation in dropdown is single year only
  const isSingleYearSpan = minYear === currentYear;

  const RANGES: { id: '3M' | '6M' | '1A' | 'TODO'; label: string }[] = [
    { id: '3M', label: '3M' },
    { id: '6M', label: '6M' },
    { id: '1A', label: '1A' },
    { id: 'TODO', label: 'Todo' },
  ];

  const handleSelectMonth = (year: number, monthIdx: number) => {
    onChange({ kind: 'month', year, month: monthIdx });
    setOpen(false);
  };

  const handleSelectRange = (id: '3M' | '6M' | '1A' | 'TODO') => {
    onChange({ kind: 'range', id });
    setOpen(false);
  };

  const isCurrentMonthSelected =
    value.kind === 'month' &&
    value.year === currentYear &&
    value.month === currentMonth;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-slate-300 text-sm font-medium">Periodo de análisis</span>

      <div className="flex items-center gap-2 flex-wrap" ref={containerRef}>
        {/* Month Navigation Control */}
        <div className="relative flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          <button
            type="button"
            onClick={() => onChange(shiftMonth(value, -1))}
            disabled={isPrevDisabled}
            title="Mes anterior"
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="flex items-center gap-1.5 px-2 py-1 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{periodLabel(value)}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onChange(shiftMonth(value, 1))}
            disabled={isNextDisabled}
            title="Mes siguiente"
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Month Selection Dropdown Dialog */}
          {open && (
            <div
              role="dialog"
              aria-label="Elegir mes"
              className="absolute top-full left-0 right-0 sm:right-auto sm:left-0 mt-2 z-[100] w-full sm:w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-3"
            >
              {/* Dropdown Year Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                {!isSingleYearSpan ? (
                  <button
                    type="button"
                    onClick={() => setDropdownYear((y) => Math.max(y - 1, minYear))}
                    disabled={dropdownYear <= minYear}
                    title="Año anterior"
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                ) : <div className="w-6" />}

                <span className="text-white font-semibold text-sm">{dropdownYear}</span>

                {!isSingleYearSpan ? (
                  <button
                    type="button"
                    onClick={() => setDropdownYear((y) => Math.min(y + 1, currentYear))}
                    disabled={dropdownYear >= currentYear}
                    title="Año siguiente"
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : <div className="w-6" />}
              </div>

              {/* 4x3 Month Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 12 }, (_, mIdx) => {
                  const isFuture = dropdownYear > currentYear || (dropdownYear === currentYear && mIdx > currentMonth);
                  const isBeforeMin = dropdownYear < minYear || (dropdownYear === minYear && mIdx < minMonth);
                  const isDisabled = isFuture || isBeforeMin;

                  const isSelected =
                    value.kind === 'month' &&
                    value.year === dropdownYear &&
                    value.month === mIdx;

                  return (
                    <button
                      key={mIdx}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectMonth(dropdownYear, mIdx)}
                      className={`py-1.5 px-1 rounded text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold'
                          : isDisabled
                          ? 'text-slate-600 cursor-not-allowed'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {monthName(mIdx)}
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions Footer */}
              <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-xs text-blue-400">
                <button
                  type="button"
                  onClick={() => {
                    onChange(currentMonthPeriod(now));
                    setOpen(false);
                  }}
                  className="hover:underline"
                >
                  Este mes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(shiftMonth(currentMonthPeriod(now), -1));
                    setOpen(false);
                  }}
                  className="hover:underline"
                >
                  Mes anterior
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectRange('TODO')}
                  className="hover:underline text-slate-400 hover:text-slate-200"
                >
                  Todo
                </button>
              </div>

              {isCurrentMonthSelected && (
                <div className="border-t border-slate-800/80 pt-1.5 text-[11px] text-amber-400/90 text-center">
                  Mes en curso · datos hasta el {now.getDate()} de {monthNameFull(currentMonth)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Range Chips */}
        <div className="flex items-center gap-1">
          {RANGES.map((r) => {
            const isActive = value.kind === 'range' && value.id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectRange(r.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

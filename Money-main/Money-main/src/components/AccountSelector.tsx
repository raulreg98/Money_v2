import { useState, useRef, useEffect } from 'react';
import { ChevronRight, Wallet } from 'lucide-react';
import type { Account } from '@/types';
import { ACCOUNT_TYPES } from '@/lib/format';

interface Props {
  accounts: Account[];
  value: string;
  onChange: (val: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function AccountSelector({ accounts, value, onChange, allowEmpty, emptyLabel = 'Seleccionar cuenta…' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedAcc = value ? accounts.find(a => String(a.id) === String(value)) : null;

  const normalTypes = ['corriente', 'efectivo', 'ahorro', 'tarjeta'];
  const normalAccounts = accounts.filter(a => !a.archived && normalTypes.includes((a.type || '').toLowerCase()));
  const investmentAccounts = accounts.filter(a => !a.archived && (a.type || '').toLowerCase() === 'inversion');
  const otherAccounts = accounts.filter(a => !a.archived && !normalTypes.includes((a.type || '').toLowerCase()) && (a.type || '').toLowerCase() !== 'inversion');

  const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={inputCls + ' flex items-center gap-2 text-left cursor-pointer'}
      >
        {selectedAcc ? (
          <div className="flex items-center gap-2 truncate">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selectedAcc.color || '#3b82f6' }} />
            <span className="text-slate-200 truncate font-medium">{selectedAcc.name}</span>
            <span className="text-slate-500 text-xs shrink-0">({ACCOUNT_TYPES[selectedAcc.type] || selectedAcc.type})</span>
          </div>
        ) : (
          <span className="text-slate-500">{allowEmpty ? emptyLabel : 'Seleccionar cuenta…'}</span>
        )}
        <ChevronRight className="w-4 h-4 ml-auto text-slate-500 shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={ref}
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-semibold text-base">Seleccionar Cuenta</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </div>

            {/* Lista de Cuentas agrupadas */}
            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {allowEmpty && (
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                >
                  <div className="w-3 h-3 rounded-full shrink-0 bg-slate-600" />
                  <span>{emptyLabel}</span>
                </button>
              )}

              {normalAccounts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2">Cuentas habituales</p>
                  <div className="space-y-1">
                    {normalAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => { onChange(String(acc.id)); setOpen(false); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 transition-colors text-left"
                        style={{
                          backgroundColor: `${acc.color}15`,
                          borderColor: `${acc.color}30`,
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: acc.color }} />
                          <span className="text-white font-medium text-sm">{acc.name}</span>
                        </div>
                        <span className="text-slate-400 text-xs">{ACCOUNT_TYPES[acc.type] || acc.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {investmentAccounts.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2">Cuentas de inversión</p>
                  <div className="space-y-1">
                    {investmentAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => { onChange(String(acc.id)); setOpen(false); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 transition-colors text-left"
                        style={{
                          backgroundColor: `${acc.color}15`,
                          borderColor: `${acc.color}30`,
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: acc.color }} />
                          <span className="text-white font-medium text-sm">{acc.name}</span>
                        </div>
                        <span className="text-slate-400 text-xs">{ACCOUNT_TYPES[acc.type] || acc.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {otherAccounts.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2">Otras cuentas</p>
                  <div className="space-y-1">
                    {otherAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => { onChange(String(acc.id)); setOpen(false); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 transition-colors text-left"
                        style={{
                          backgroundColor: `${acc.color}15`,
                          borderColor: `${acc.color}30`,
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: acc.color }} />
                          <span className="text-white font-medium text-sm">{acc.name}</span>
                        </div>
                        <span className="text-slate-400 text-xs">{ACCOUNT_TYPES[acc.type] || acc.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

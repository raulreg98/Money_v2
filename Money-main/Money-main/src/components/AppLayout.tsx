import { type ReactNode, useState, useEffect } from 'react';
import { LayoutDashboard, Briefcase, Wallet, BarChart3, Settings, Menu, X, TrendingUp, FolderTree, ChevronDown, ChevronRight, Landmark, PiggyBank } from 'lucide-react';
import { api } from '@/lib/api';
import { formatEUR } from '@/lib/format';

export type PageId = 'dashboard' | 'portfolio' | 'accounts' | 'categories' | 'charts' | 'settings';

interface LayoutProps {
  current: PageId;
  onNavigate: (page: PageId, accountId?: number) => void;
  children: ReactNode;
}

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Inversiones', icon: Briefcase },
  { id: 'categories', label: 'Categorías', icon: FolderTree },
  { id: 'charts', label: 'Gráficas', icon: BarChart3 },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export function AppLayout({ current, onNavigate, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page: PageId, accountId?: number) => {
    onNavigate(page, accountId);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 flex-col bg-slate-900 border-r border-slate-800 fixed inset-y-0 left-0 z-30">
        <SidebarContent current={current} onNavigate={handleNav} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 z-50 md:hidden">
            <SidebarContent current={current} onNavigate={handleNav} />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <header className="md:hidden sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-300 hover:text-white">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="text-white font-semibold">Mi Patrimonio</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  current,
  onNavigate,
}: {
  current: PageId;
  onNavigate: (p: PageId, accountId?: number) => void;
}) {
  const [accountsOpen, setAccountsOpen] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const loadData = () => {
      Promise.all([api.getAccounts(), api.getTransactions()])
        .then(([accs, txs]) => {
          if (!active) return;
          setAccounts(accs.filter((a: any) => !a.archived));
          setTransactions(txs);
        })
        .catch(() => {});
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [current, accountsOpen]);

  const normalizeType = (t?: string) =>
    (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const normalTypes = ['corriente', 'efectivo', 'ahorro', 'tarjeta'];
  const inversionAccounts = accounts.filter(a => normalizeType(a.type) === 'inversion');
  const corrienteAccounts = accounts.filter(a => normalizeType(a.type) !== 'inversion');

  const getAccountBalance = (acc: any) => {
    const txs = transactions.filter((t: any) => t.account_id === acc.id);
    return acc.initial_balance + txs.reduce((s: number, t: any) => s + t.amount, 0);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
          <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Mi Patrimonio</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            current === 'dashboard' ? 'bg-blue-600/15 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          Panel
        </button>

        <button
          onClick={() => onNavigate('portfolio')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            current === 'portfolio' ? 'bg-blue-600/15 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Briefcase className="w-5 h-5 shrink-0" />
          Inversiones
        </button>

        {/* Desplegable de Cuentas */}
        <div>
          <button
            onClick={() => {
              if (current !== 'accounts') onNavigate('accounts');
              setAccountsOpen(!accountsOpen);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              current === 'accounts' ? 'bg-blue-600/15 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 shrink-0" />
              <span>Cuentas</span>
            </div>
            {accountsOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {accountsOpen && (
            <div className="pl-6 pr-1 py-1.5 space-y-2">
              {corrienteAccounts.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2">Cuentas Corrientes</span>
                  {corrienteAccounts.map(a => (
                    <button
                      key={a.id}
                      onClick={() => onNavigate('accounts', a.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="truncate">{a.name}</span>
                      <span className="text-slate-300 font-medium ml-2">{formatEUR(getAccountBalance(a), { compact: true })}</span>
                    </button>
                  ))}
                </div>
              )}

              {inversionAccounts.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-800/50">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2">Cuentas de Inversión</span>
                  {inversionAccounts.map(a => (
                    <button
                      key={a.id}
                      onClick={() => onNavigate('accounts', a.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="truncate">{a.name}</span>
                      <span className="text-slate-300 font-medium ml-2">{formatEUR(getAccountBalance(a), { compact: true })}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {NAV_ITEMS.filter(item => !['dashboard', 'portfolio'].includes(item.id)).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              current === id ? 'bg-blue-600/15 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <span className="text-slate-500 text-xs px-3">Uso local</span>
      </div>
    </div>
  );
}

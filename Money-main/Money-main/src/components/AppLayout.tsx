import { type ReactNode, useState, useEffect } from 'react';
import { LayoutDashboard, Briefcase, Wallet, BarChart3, Settings, Menu, X, TrendingUp, FolderTree, ChevronDown, ChevronRight, Landmark, PiggyBank, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import { AddTransactionModal } from '@/pages/AccountsPage';

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
  const [showNewTxModal, setShowNewTxModal] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const handleNav = (page: PageId, accountId?: number) => {
    onNavigate(page, accountId);
    setMobileOpen(false);
  };

  const handleOpenNewTx = () => {
    Promise.all([api.getAccounts(), api.getCategories()])
      .then(([accs, cats]) => {
        setAccounts(accs.filter((a: any) => !a.archived));
        setCategories(cats);
        setShowNewTxModal(true);
      })
      .catch(() => {});
  };

  return (
    <div className="min-h-screen bg-slate-950 flex max-w-[100vw] overflow-x-hidden">
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
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen pb-20 md:pb-0 min-w-0 max-w-full">
        <header className="md:hidden sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-300 hover:text-white">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-blue-400" />
            <span className="text-white font-bold">Bilibank</span>
          </div>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => handleNav('dashboard')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors ${
              current === 'dashboard' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium">Panel</span>
          </button>

          <button
            onClick={() => handleNav('accounts')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors ${
              current === 'accounts' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10px] font-medium">Cuentas</span>
          </button>

          {/* Botón Central Destacado */}
          <button
            onClick={handleOpenNewTx}
            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 -mt-5 transition-transform active:scale-95"
            title="Nueva transacción"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          <button
            onClick={() => handleNav('portfolio')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors ${
              current === 'portfolio' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] font-medium">Inversiones</span>
          </button>

          <button
            onClick={() => handleNav('settings')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors ${
              current === 'settings' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-medium">Ajustes</span>
          </button>
        </nav>
      </div>

      {showNewTxModal && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          onClose={() => {
            setShowNewTxModal(false);
            onNavigate(current);
          }}
        />
      )}
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
  const [categories, setCategories] = useState<any[]>([]);
  const [showNewTxModal, setShowNewTxModal] = useState(false);

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

  const inversionAccounts = accounts.filter(a => normalizeType(a.type) === 'inversion');
  const corrienteAccounts = accounts.filter(a => normalizeType(a.type) !== 'inversion');

  const getAccountBalance = (acc: any) => {
    if (acc.total_balance !== undefined) return acc.total_balance;
    const txs = transactions.filter((t: any) => t.account_id === acc.id);
    return acc.initial_balance + txs.reduce((s: number, t: any) => s + t.amount, 0);
  };

  const corrienteTotal = corrienteAccounts.reduce((sum, a) => sum + getAccountBalance(a), 0);
  const inversionTotal = inversionAccounts.reduce((sum, a) => sum + getAccountBalance(a), 0);
  const grandTotal = corrienteTotal + inversionTotal;

  const handleOpenNewTx = () => {
    Promise.all([api.getAccounts(), api.getCategories()])
      .then(([accs, cats]) => {
        setAccounts(accs.filter((a: any) => !a.archived));
        setCategories(cats);
        setShowNewTxModal(true);
      })
      .catch(() => {});
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
          <PiggyBank className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Bilibank</span>
      </div>

      <div className="px-3 pt-3 pb-1">
        <button
          onClick={handleOpenNewTx}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nueva Transacción</span>
        </button>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1">
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
          <div
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              current === 'accounts' ? 'bg-blue-600/15 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <button
              onClick={() => onNavigate('accounts')}
              className="flex items-center gap-3 flex-1 text-left"
            >
              <Wallet className="w-5 h-5 shrink-0" />
              <span>Cuentas</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAccountsOpen(!accountsOpen);
              }}
              className="p-1 hover:text-white transition-colors"
              title="Desplegar cuentas"
            >
              {accountsOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
          </div>

          {accountsOpen && (
            <div className="pl-6 pr-1 py-1.5 space-y-2">
              {accounts.length > 0 && (
                <div className="px-2 py-1 bg-slate-800/40 rounded flex items-center justify-between text-xs font-semibold text-slate-300 border border-slate-800">
                  <span>Total Cuentas</span>
                  <span className="text-blue-400">{formatEUR(grandTotal)}</span>
                </div>
              )}

              {corrienteAccounts.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    <span>Cuentas Corrientes</span>
                    <span className="text-slate-400 font-medium">{formatEUR(corrienteTotal)}</span>
                  </div>
                  {corrienteAccounts.map(a => (
                    <button
                      key={a.id}
                      onClick={() => onNavigate('accounts', a.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="truncate">{a.name}</span>
                      <span className="text-slate-300 font-medium ml-2">{formatEUR(getAccountBalance(a))}</span>
                    </button>
                  ))}
                </div>
              )}

              {inversionAccounts.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-800/50">
                  <div className="flex items-center justify-between px-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    <span>Cuentas de Inversión</span>
                    <span className="text-slate-400 font-medium">{formatEUR(inversionTotal)}</span>
                  </div>
                  {inversionAccounts.map(a => (
                    <button
                      key={a.id}
                      onClick={() => onNavigate('accounts', a.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="truncate">{a.name}</span>
                      <span className="text-slate-300 font-medium ml-2">{formatEUR(getAccountBalance(a))}</span>
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
        <span className="text-slate-500 text-xs px-3 font-medium">Versión 5</span>
      </div>

      {showNewTxModal && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          onClose={() => {
            setShowNewTxModal(false);
            onNavigate(current);
          }}
        />
      )}
    </div>
  );
}

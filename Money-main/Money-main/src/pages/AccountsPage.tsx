import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Account, Transaction, Category } from '@/types';
import { Card } from '@/components/Card';
import { CategorySelector, CategoryBadge } from '@/components/CategorySelector';
import { AccountSelector } from '@/components/AccountSelector';
import { CategoryExpensesChart } from '@/components/CategoryExpensesChart';
import { PeriodSelector } from '@/components/PeriodSelector';
import { PeriodState, currentMonthPeriod, periodToRange } from '@/lib/period';
import { resolveCategory } from '@/lib/categories';
import { useCategoryContext } from '@/context/CategoryContext';
import { formatEUR, formatDate, formatAxisEUR, formatAxisEURPrecise, formatAxisDateWithYear, formatUnits, ACCOUNT_TYPES } from '@/lib/format';
import { Plus, Trash2, ArrowRight, ArrowLeft, EyeOff, Archive, Edit3, ChevronDown, ChevronRight, Search, CheckSquare, Square, FolderInput, Landmark } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid,
} from 'recharts';

type View = 'list' | 'detail';

export function AccountsPage({ initialAccountId }: { initialAccountId?: number | null }) {
  const [view, setView] = useState<View>(initialAccountId ? 'detail' : 'list');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(initialAccountId || null);

  useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
      setView('detail');
    }
  }, [initialAccountId]);

  if (view === 'detail' && selectedAccountId !== null) {
    return <AccountDetail accountId={selectedAccountId} onBack={() => { setView('list'); setSelectedAccountId(null); }} />;
  }
  return <AccountListList onSelect={(id) => { setSelectedAccountId(id); setView('detail'); }} />;
}

// ===================== LIST VIEW =====================

function AccountListList({ onSelect }: { onSelect: (id: number) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = () => {
    Promise.all([api.getAccounts(), api.getTransactions(), api.getCategories()])
      .then(([a, t, c]) => {
        setAccounts(a); setTransactions(t); setCategories(c);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const accountBalance = (acc: Account) => {
    if (acc.total_balance !== undefined) return acc.total_balance;
    const txs = transactions.filter((t) => t.account_id === acc.id);
    return acc.initial_balance + txs.reduce((s, t) => s + t.amount, 0);
  };

  const normalTypes = ['corriente', 'efectivo', 'ahorro', 'tarjeta'];
  const normalAccounts = accounts.filter(a => !a.archived && normalTypes.includes(a.type));
  const investmentAccounts = accounts.filter(a => !a.archived && a.type === 'inversion');
  const otherAccounts = accounts.filter(a => !a.archived && !normalTypes.includes(a.type) && a.type !== 'inversion');
  const archivedAccounts = accounts.filter(a => a.archived);

  const normalSubtotal = normalAccounts.reduce((s, a) => s + (a.exclude_from_net_worth ? 0 : accountBalance(a)), 0);
  const invSubtotal = investmentAccounts.reduce((s, a) => s + (a.exclude_from_net_worth ? 0 : accountBalance(a)), 0);
  const otherSubtotal = otherAccounts.reduce((s, a) => s + (a.exclude_from_net_worth ? 0 : accountBalance(a)), 0);
  const totalBalance = normalSubtotal + invSubtotal + otherSubtotal;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cuentas</h1>
          <p className="text-slate-400 text-sm mt-1">Balance total: {formatEUR(totalBalance)}</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <button onClick={() => setShowAddAccount(true)} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-3 py-2 rounded-lg transition-colors flex-1 sm:flex-initial">
            <Plus className="w-4 h-4" /> Cuenta
          </button>
          <button onClick={() => setShowAddTx(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors flex-1 sm:flex-initial">
            <Plus className="w-4 h-4" /> Transacción
          </button>
        </div>
      </div>

      {error && <Card className="p-4"><p className="text-red-400 text-sm">{error}</p></Card>}

      {accounts.length === 0 ? (
        <Card className="p-12 text-center"><p className="text-slate-500">No tienes cuentas. Crea una para empezar.</p></Card>
      ) : (
        <>
          {normalAccounts.length > 0 && (
            <AccountSection title="Cuentas normales" subtotal={normalSubtotal} accounts={normalAccounts} accountBalance={accountBalance} onSelect={onSelect} onEdit={setEditingAccount} />
          )}
          {investmentAccounts.length > 0 && (
            <AccountSection title="Cuentas de inversión" subtotal={invSubtotal} accounts={investmentAccounts} accountBalance={accountBalance} onSelect={onSelect} onEdit={setEditingAccount} />
          )}
          {otherAccounts.length > 0 && (
            <AccountSection title="Otras cuentas" subtotal={otherSubtotal} accounts={otherAccounts} accountBalance={accountBalance} onSelect={onSelect} onEdit={setEditingAccount} />
          )}
          {archivedAccounts.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowArchived(s => !s)}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm font-medium"
              >
                {showArchived ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Archivadas ({archivedAccounts.length})
              </button>
              {showArchived && (
                <AccountSection title="Archivadas" subtotal={0} accounts={archivedAccounts} accountBalance={accountBalance} onSelect={onSelect} onEdit={setEditingAccount} showArchiveAction />
              )}
            </div>
          )}
        </>
      )}

      {showAddAccount && <AddAccountModal onClose={() => { setShowAddAccount(false); load(); }} />}
      {showAddTx && <AddTransactionModal accounts={accounts} categories={categories} onClose={() => { setShowAddTx(false); load(); }} />}
      {editingAccount && <EditAccountModal account={editingAccount} onClose={() => { setEditingAccount(null); load(); }} />}
    </div>
  );
}

function AccountSection({ title, subtotal, accounts, accountBalance, onSelect, onEdit, showArchiveAction }: {
  title: string;
  subtotal: number;
  accounts: Account[];
  accountBalance: (a: Account) => number;
  onSelect: (id: number) => void;
  onEdit: (a: Account) => void;
  showArchiveAction?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">{title}</h2>
        {subtotal !== 0 && <span className="text-slate-400 text-sm font-medium">{formatEUR(subtotal)}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const bal = accountBalance(acc);
          const cardBg = acc.color ? `${acc.color}22` : undefined;
          const cardBorder = acc.color ? `${acc.color}45` : undefined;
          return (
            <Card
              key={acc.id}
              className="p-5 hover:border-slate-500 transition-colors cursor-pointer border"
              style={{
                backgroundColor: cardBg,
                borderColor: cardBorder,
              }}
            >
              <div className="flex items-center justify-between mb-3" onClick={() => onSelect(acc.id)}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: acc.color }} />
                  <span className="text-white font-medium">{acc.name}</span>
                  {acc.exclude_from_net_worth === 1 && (
                    <span title="Excluida del patrimonio neto"><EyeOff className="w-3.5 h-3.5 text-slate-500" /></span>
                  )}
                </div>
                <span className="text-slate-500 text-xs">{ACCOUNT_TYPES[acc.type] || acc.type}</span>
              </div>
              <p className="text-2xl font-bold text-white" onClick={() => onSelect(acc.id)}>{formatEUR(bal)}</p>
              <p className="text-slate-500 text-xs mt-1">Inicial: {formatEUR(acc.initial_balance)}</p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(acc); }}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Editar
                </button>
                {showArchiveAction && (
                  <button
                    onClick={async (e) => { e.stopPropagation(); await api.archiveAccount(acc.id, false); }}
                    className="flex items-center gap-1 text-slate-500 hover:text-blue-400 text-xs transition-colors"
                  >
                    Restaurar
                  </button>
                )}
                {!showArchiveAction && (
                  <button
                    onClick={async (e) => { e.stopPropagation(); await api.archiveAccount(acc.id, true); window.location.reload(); }}
                    className="flex items-center gap-1 text-slate-500 hover:text-amber-400 text-xs transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archivar
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ===================== DETAIL VIEW =====================

function AccountDetail({ accountId, onBack }: { accountId: number; onBack: () => void }) {
  const { categories: contextCategories } = useCategoryContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<PeriodState>(() => currentMonthPeriod());
  const range = useMemo(() => periodToRange(period), [period]);
  const reqCounterRef = useRef(0);

  const [txType, setTxType] = useState('');
  const [txCat, setTxCat] = useState('');
  const [search, setSearch] = useState('');
  const [showAllTx, setShowAllTx] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [showAdjustBalance, setShowAdjustBalance] = useState(false);
  const [targetBalance, setTargetBalance] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const loadSummary = useCallback(() => {
    const currentReq = ++reqCounterRef.current;
    setLoading(true);
    api.getAccountSummary(accountId, {
      desde: range.desde,
      hasta: range.hasta,
      tipo: txType,
      categoria: txCat,
      q: search,
      limit: showAllTx ? 1000 : 20,
    })
      .then((res) => {
        if (currentReq === reqCounterRef.current) {
          setData(res);
        }
      })
      .catch((err) => {
        if (currentReq === reqCounterRef.current) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (currentReq === reqCounterRef.current) {
          setLoading(false);
        }
      });
  }, [accountId, range.desde, range.hasta, txType, txCat, search, showAllTx]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackButton onBack={onBack} />
        <Card className="p-6"><p className="text-red-400">{error || 'No se encontró la cuenta'}</p></Card>
      </div>
    );
  }

  const {
    account,
    balance,
    investedValue,
    totalBalance,
    transactions,
    totalCount,
    periodCount,
    lastTransaction,
    accounts: accList,
    categories: apiCategories,
    balanceSeries = [],
    monthlyBars = [],
    periodBars = [],
    investmentProducts = []
  } = data;

  const activeCategories = (contextCategories && contextCategories.length > 0)
    ? contextCategories
    : (apiCategories && apiCategories.length > 0 ? apiCategories : []);

  const handleAdjustBalance = async () => {
    const target = parseFloat(targetBalance);
    if (isNaN(target)) return;
    const diff = target - balance;
    if (diff === 0) { setShowAdjustBalance(false); return; }
    setAdjusting(true);
    try {
      const type = diff > 0 ? 'ingreso' : 'gasto';
      await api.createTransaction({
        type,
        date: new Date().toISOString().slice(0, 10),
        amount: Math.abs(diff),
        account_id: accountId,
        note: `Ajuste de saldo a ${formatEUR(target)}`,
      });
      setShowAdjustBalance(false);
      loadSummary();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  const handleUndo = async () => {
    const targetTx = lastTransaction || (transactions.length > 0 ? transactions[0] : null);
    if (!targetTx) return;
    try {
      await api.deleteTransaction(targetTx.id);
      loadSummary();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleSelectTx = (id: number) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllTx = () => {
    if (selectedTxIds.size === transactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(transactions.map((t: Transaction) => t.id)));
    }
  };

  const applyBulkCategory = async () => {
    if (selectedTxIds.size === 0) return;
    for (const id of Array.from(selectedTxIds)) {
      await api.updateTransaction(id, { category_id: bulkCategoryId ? parseInt(bulkCategoryId) : null });
    }
    setSelectedTxIds(new Set());
    setBulkCategory(false);
    setBulkCategoryId('');
    loadSummary();
  };

  const accName = (id: number) => accList.find((a: any) => a.id === id)?.name || '—';
  const catById = (id: any) => {
    return resolveCategory(id, activeCategories);
  };

  const barsData = periodBars.length > 0 ? periodBars : monthlyBars;

  return (
    <div className="space-y-6 p-4 sm:p-6 rounded-2xl border transition-colors" style={{ backgroundColor: `${account.color}15`, borderColor: `${account.color}35` }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <BackButton onBack={onBack} />
          <div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: account.color }} />
              <h1 className="text-2xl font-bold text-white tracking-tight">{account.name}</h1>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              {ACCOUNT_TYPES[account.type] || account.type}
              {account.exclude_from_net_worth === 1 && ' · Excluida del patrimonio neto'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {(lastTransaction || transactions.length > 0) && (
            <button onClick={handleUndo} className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm px-2.5 py-2 rounded-lg transition-colors flex-1 sm:flex-initial" title="Deshacer último movimiento">
              Deshacer
            </button>
          )}
          <button onClick={() => { setTargetBalance(balance.toString()); setShowAdjustBalance(true); }} className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm px-2.5 py-2 rounded-lg transition-colors flex-1 sm:flex-initial">
            Ajustar
          </button>
          <button onClick={() => setEditingAccount(true)} className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm px-2.5 py-2 rounded-lg transition-colors flex-1 sm:flex-initial">
            <Edit3 className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            onClick={async () => { await api.archiveAccount(accountId, true); onBack(); }}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm px-2.5 py-2 rounded-lg transition-colors flex-1 sm:flex-initial"
          >
            <Archive className="w-3.5 h-3.5" /> Archivar
          </button>
          <button onClick={() => setShowAddTx(true)} className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium px-3 py-2 rounded-lg transition-colors flex-1 sm:flex-initial">
            <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">+ Transacción</span>
          </button>
        </div>
      </div>

      {/* Global Period Selector */}
      <PeriodSelector
        value={period}
        onChange={(newPeriod) => setPeriod(newPeriod)}
        firstTxDate={data.firstTxDate}
      />

      {/* Balance Summary */}
      {account.type === 'inversion' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MiniStat label="Total de la cuenta" value={formatEUR(totalBalance ?? (balance + (investedValue || 0)))} valueClass="text-blue-400" />
          <MiniStat label="Efectivo / Saldo líquido" value={formatEUR(balance)} />
          <MiniStat label="Valor invertido" value={formatEUR(investedValue || 0)} valueClass="text-emerald-400" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat label="Saldo actual" value={formatEUR(balance)} />
          <MiniStat label="Inicial" value={formatEUR(account.initial_balance)} />
          <MiniStat label="Movimientos del periodo" value={String(periodCount ?? totalCount)} />
          <MiniStat label="Moneda" value={account.currency} />
        </div>
      )}

      {/* Balance Evolution Line Chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-white font-semibold">Evolución del saldo</h2>
        </div>
        {balanceSeries.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={balanceSeries} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisDateWithYear} minTickGap={40} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEURPrecise} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} formatter={(v: any) => [formatEUR(Number(v)), 'Saldo']} />
              <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-500 text-sm text-center py-12">Sin datos para este periodo</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Bar Chart */}
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Ingresos vs gastos por periodo</h2>
          {barsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barsData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} formatter={(v: any) => formatEUR(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-sm text-center py-12">Sin datos</p>
          )}
        </Card>

        {/* Category Expenses Donut Chart */}
        <CategoryExpensesChart
          title="Gastos por categoría"
          transactions={data.allTransactions || transactions}
          categories={activeCategories}
          accounts={accList}
          accountId={accountId}
          dateRange={range}
          onRefresh={loadSummary}
        />
      </div>

      {/* Investment Products Table */}
      {investmentProducts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Productos de inversión ({investmentProducts.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800">
                <th className="px-5 py-2 font-medium">Nombre</th>
                <th className="px-5 py-2 font-medium text-right">Unidades</th>
                <th className="px-5 py-2 font-medium text-right">Invertido</th>
                <th className="px-5 py-2 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {investmentProducts.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-800/50">
                  <td className="px-5 py-2.5 text-white font-medium">{p.name}</td>
                  <td className="px-5 py-2.5 text-right text-slate-400">{formatUnits(p.units)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-400">{formatEUR(p.invested)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-200">{formatEUR(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Transactions List */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Movimientos ({totalCount})</h2>
            {transactions.length > 0 && (
              <button onClick={selectAllTx} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                {selectedTxIds.size === transactions.length ? 'Quitar selección' : 'Seleccionar todo'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…"
                className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:border-blue-500 outline-none" />
            </div>
            <select value={txType} onChange={(e) => setTxType(e.target.value)} className="bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none">
              <option value="">Todos</option>
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
              <option value="transferencia">Transferencia</option>
            </select>
            {activeCategories.length > 0 && (
              <div className="min-w-[160px]">
                <CategorySelector
                  categories={activeCategories}
                  value={txCat}
                  onChange={setTxCat}
                  allowEmpty
                />
              </div>
            )}
          </div>
          {/* Bulk Category Action */}
          {selectedTxIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
              <span className="text-sm text-slate-300">{selectedTxIds.size} seleccionadas</span>
              <div className="flex-1" />
              <button onClick={() => setBulkCategory(true)} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <FolderInput className="w-3.5 h-3.5" /> Cambiar categoría
              </button>
              <button onClick={() => setSelectedTxIds(new Set())} className="text-sm text-slate-400 hover:text-slate-200">Cancelar</button>
            </div>
          )}
          {bulkCategory && (
            <div className="flex items-center gap-2">
              <CategorySelector
                categories={activeCategories}
                value={bulkCategoryId}
                onChange={setBulkCategoryId}
                allowEmpty
              />
              <button onClick={applyBulkCategory} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                Aplicar
              </button>
              <button onClick={() => { setBulkCategory(false); setBulkCategoryId(''); }} className="text-slate-400 hover:text-slate-200 text-sm px-2">Cancelar</button>
            </div>
          )}
        </div>
        {transactions.length === 0 ? (
          <p className="text-slate-500 text-sm p-5">Sin transacciones</p>
        ) : (
          <>
            {/* Desktop View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left border-b border-slate-800">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-5 py-2 font-medium">Fecha</th>
                    <th className="px-5 py-2 font-medium">Tipo</th>
                    <th className="px-5 py-2 font-medium">Detalle</th>
                    <th className="px-5 py-2 font-medium">Categoría</th>
                    <th className="px-5 py-2 font-medium text-right">Importe</th>
                    <th className="px-5 py-2 font-medium text-right">Saldo tras mov.</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t: Transaction) => {
                    const selected = selectedTxIds.has(t.id);
                    const runningBal = (t as any).running_balance;

                    if (t.type === 'transferencia') {
                      const isOutgoing = t.amount < 0;
                      const fromId = isOutgoing ? t.account_id : (t.to_account_id || t.account_id);
                      const toId = isOutgoing ? (t.to_account_id || t.account_id) : t.account_id;
                      const fromName = accName(fromId);
                      const toName = accName(toId);
                      const displayAmount = isOutgoing
                        ? `-${formatEUR(Math.abs(t.amount))}`
                        : formatEUR(Math.abs(t.amount), { sign: true });
                      const color = isOutgoing ? 'text-red-400' : 'text-emerald-400';

                      return (
                        <tr key={t.id} className={`border-b border-slate-800/50 ${selected ? 'bg-blue-600/10' : ''}`}>
                          <td className="px-3 py-2.5">
                            <button onClick={() => toggleSelectTx(t.id)} className="text-slate-500 hover:text-blue-400">
                              {selected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-5 py-2.5 text-slate-300">{formatDate(t.date)}</td>
                          <td className="px-5 py-2.5"><TxBadge type={t.type} /></td>
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-1.5 font-medium text-slate-200 text-sm">
                              <Landmark className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span>{fromName}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mx-0.5" />
                              <Landmark className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span>{toName}</span>
                              {t.note && <span className="text-xs text-slate-500 font-normal">({t.note})</span>}
                            </div>
                          </td>
                          <td className="px-5 py-2.5"></td>
                          <td className={`px-5 py-2.5 text-right font-medium ${color}`}>{displayAmount}</td>
                          <td className="px-5 py-2.5 text-right font-medium text-slate-300">{runningBal != null ? formatEUR(runningBal) : '—'}</td>
                          <td className="px-5 py-2.5 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => setEditingTx(t)}
                                className="text-slate-600 hover:text-blue-400 transition-colors"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const isExpense = t.type === 'gasto';
                    const color = isExpense ? 'text-red-400' : 'text-emerald-400';
                    const displayAmount = isExpense ? `-${formatEUR(Math.abs(t.amount))}` : formatEUR(Math.abs(t.amount), { sign: true });
                    const toAccName = t.to_account_id ? accName(t.to_account_id) : null;

                    return (
                      <tr key={t.id} className={`border-b border-slate-800/50 ${selected ? 'bg-blue-600/10' : ''}`}>
                        <td className="px-3 py-2.5">
                          <button onClick={() => toggleSelectTx(t.id)} className="text-slate-500 hover:text-blue-400">
                            {selected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-5 py-2.5 text-slate-300">{formatDate(t.date)}</td>
                        <td className="px-5 py-2.5"><TxBadge type={t.type} /></td>
                        <td className="px-5 py-2.5 text-slate-400">
                          {t.note || ''}
                          {toAccName && <span className="text-slate-600"> → {toAccName}</span>}
                        </td>
                        <td className="px-5 py-2.5">
                          <button
                            type="button"
                            onClick={() => setEditingTx(t)}
                            className="hover:opacity-80 transition-opacity text-left"
                            title="Cambiar categoría"
                          >
                            <CategoryBadge category={catById(t.category_id)} categories={activeCategories} size="xs" />
                          </button>
                        </td>
                        <td className={`px-5 py-2.5 text-right font-medium ${color}`}>{displayAmount}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-slate-300">{runningBal != null ? formatEUR(runningBal) : '—'}</td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setEditingTx(t)}
                              className="text-slate-600 hover:text-blue-400 transition-colors"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View (< md) */}
            <div className="md:hidden divide-y divide-slate-800/60">
              {transactions.map((t: Transaction) => {
                const selected = selectedTxIds.has(t.id);
                const runningBal = (t as any).running_balance;
                const isExpense = t.type === 'gasto';
                const isTransfer = t.type === 'transferencia';

                let displayAmount = formatEUR(Math.abs(t.amount));
                let colorCls = isExpense ? 'text-red-400' : 'text-emerald-400';

                if (isTransfer) {
                  const isOutgoing = t.amount < 0;
                  displayAmount = isOutgoing ? `-${formatEUR(Math.abs(t.amount))}` : formatEUR(Math.abs(t.amount), { sign: true });
                  colorCls = isOutgoing ? 'text-red-400' : 'text-emerald-400';
                } else if (isExpense) {
                  displayAmount = `-${formatEUR(Math.abs(t.amount))}`;
                } else {
                  displayAmount = formatEUR(Math.abs(t.amount), { sign: true });
                }

                const detailText = isTransfer
                  ? `${accName(t.account_id)} → ${accName(t.to_account_id || t.account_id)}${t.note ? ` (${t.note})` : ''}`
                  : (t.note || '');

                return (
                  <div
                    key={t.id}
                    onClick={() => setEditingTx(t)}
                    className={`p-4 space-y-2 cursor-pointer active:bg-slate-800/50 transition-colors ${selected ? 'bg-blue-600/10' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 text-xs font-medium">{formatDate(t.date)}</span>
                      {!isTransfer && <CategoryBadge category={catById(t.category_id)} categories={activeCategories} size="xs" />}
                    </div>
                    <p className="text-white text-sm font-medium truncate">{detailText}</p>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/40">
                      <span className={`font-semibold text-sm ${colorCls}`}>{displayAmount}</span>
                      <span className="text-slate-400">Saldo: <span className="text-slate-200 font-medium">{runningBal != null ? formatEUR(runningBal) : '—'}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalCount > 20 && !showAllTx && (
              <button onClick={() => setShowAllTx(true)} className="w-full py-3 text-blue-400 hover:text-blue-300 text-sm transition-colors border-t border-slate-800">
                Ver más ({totalCount - 20} restantes)
              </button>
            )}
            {showAllTx && (
              <button onClick={() => setShowAllTx(false)} className="w-full py-3 text-slate-400 hover:text-slate-300 text-sm transition-colors border-t border-slate-800">
                Ver menos
              </button>
            )}
          </>
        )}
      </Card>

      {showAdjustBalance && (
        <Modal title="Ajustar saldo de la cuenta" onClose={() => setShowAdjustBalance(false)} onSave={handleAdjustBalance} saving={adjusting} error="">
          <p className="text-slate-300 text-sm mb-2">Saldo actual: <span className="font-bold text-white">{formatEUR(balance)}</span></p>
          <Field label="Saldo objetivo (€)">
            <input type="number" step="any" value={targetBalance} onChange={(e) => setTargetBalance(e.target.value)} className={inputCls} autoFocus />
          </Field>
          <p className="text-slate-400 text-xs mt-1">Se creará una transacción de ingreso o gasto por la diferencia para ajustar el saldo real.</p>
        </Modal>
      )}
      {showAddTx && <AddTransactionModal accounts={accList.map((a: any) => ({ ...a, currency: 'EUR', initial_balance: 0, color: a.color || '#3b82f6', archived: 0, exclude_from_net_worth: 0, created_at: '', updated_at: '' }))} categories={activeCategories} defaultAccountId={accountId} onClose={() => { setShowAddTx(false); loadSummary(); }} />}
      {editingTx && <AddTransactionModal existingTx={editingTx} accounts={accList.map((a: any) => ({ ...a, currency: 'EUR', initial_balance: 0, color: a.color || '#3b82f6', archived: 0, exclude_from_net_worth: 0, created_at: '', updated_at: '' }))} categories={activeCategories} onClose={() => { setEditingTx(null); loadSummary(); }} />}
      {editingAccount && <EditAccountModal account={account} onClose={() => { setEditingAccount(false); loadSummary(); }} />}
    </div>
  );
}

// ===================== SHARED COMPONENTS =====================

function MiniStat({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <Card className="p-4">
      <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </Card>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
      <ArrowLeft className="w-4 h-4" /> Volver
    </button>
  );
}

const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>{children}</div>;
}

function Modal({ title, onClose, onSave, saving, error, children }: { title: string; onClose: () => void; onSave: () => void; saving: boolean; error: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">{title}</h2>
        {children}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [initialBalance, setInitialBalance] = useState('0');
  const [color, setColor] = useState('#3b82f6');
  const [type, setType] = useState('corriente');
  const [excludeFromNetWorth, setExcludeFromNetWorth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await api.createAccount({ name, currency, initial_balance: parseFloat(initialBalance) || 0, color, type, exclude_from_net_worth: excludeFromNetWorth ? 1 : 0 });
      onClose();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title="Nueva cuenta" onClose={onClose} onSave={save} saving={saving} error={error}>
      <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
      <Field label="Tipo">
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Moneda">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            <option>EUR</option><option>USD</option><option>GBP</option>
          </select>
        </Field>
        <Field label="Balance inicial (€)"><input type="number" step="any" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer" /></Field>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={excludeFromNetWorth} onChange={(e) => setExcludeFromNetWorth(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
        <span className="text-slate-300 text-sm">Excluir del patrimonio neto y de las estadísticas</span>
      </label>
    </Modal>
  );
}

function EditAccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const [name, setName] = useState(account.name);
  const [type, setType] = useState(account.type);
  const [color, setColor] = useState(account.color);
  const [excludeFromNetWorth, setExcludeFromNetWorth] = useState(account.exclude_from_net_worth === 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await api.updateAccount(account.id, { name, type, color, exclude_from_net_worth: excludeFromNetWorth ? 1 : 0 });
      onClose();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title="Editar cuenta" onClose={onClose} onSave={save} saving={saving} error={error}>
      <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
      <Field label="Tipo">
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer" /></Field>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={excludeFromNetWorth} onChange={(e) => setExcludeFromNetWorth(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
        <span className="text-slate-300 text-sm">Excluir del patrimonio neto y de las estadísticas</span>
      </label>
    </Modal>
  );
}

export function AddTransactionModal({ existingTx, accounts, categories, defaultAccountId, onClose }: { existingTx?: Transaction; accounts: Account[]; categories?: Category[]; defaultAccountId?: number; onClose: () => void }) {
  const [type, setType] = useState(existingTx?.type || 'gasto');
  const [date, setDate] = useState(existingTx?.date || new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(existingTx ? Math.abs(existingTx.amount).toString() : '');
  const [accountId, setAccountId] = useState(existingTx?.account_id?.toString() || defaultAccountId?.toString() || accounts[0]?.id?.toString() || '');
  const [toAccountId, setToAccountId] = useState(existingTx?.to_account_id?.toString() || '');
  const [categoryId, setCategoryId] = useState(existingTx?.category_id?.toString() || '');
  const [note, setNote] = useState(existingTx?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!amount || !accountId) { setError('Faltan datos'); return; }
    setSaving(true);
    try {
      const payload = {
        type, date, amount: parseFloat(amount),
        account_id: parseInt(accountId),
        to_account_id: type === 'transferencia' && toAccountId ? parseInt(toAccountId) : null,
        note: note || null,
        category_id: categoryId ? parseInt(categoryId) : null,
      };
      if (existingTx) {
        await api.updateTransaction(existingTx.id, payload);
      } else {
        await api.createTransaction(payload);
      }
      onClose();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!existingTx) return;
    setSaving(true);
    try {
      await api.deleteTransaction(existingTx.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">{existingTx ? "Editar transacción" : "Nueva transacción"}</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="gasto">Gasto</option><option value="ingreso">Ingreso</option><option value="transferencia">Transferencia</option>
            </select>
          </Field>
          <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Importe (€)"><input type="number" inputMode="decimal" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
        <Field label="Cuenta">
          <AccountSelector
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
          />
        </Field>
        {type === 'transferencia' && (
          <Field label="Cuenta destino">
            <AccountSelector
              accounts={accounts.filter((a) => a.id.toString() !== accountId)}
              value={toAccountId}
              onChange={setToAccountId}
              allowEmpty
              emptyLabel="Seleccionar cuenta destino…"
            />
          </Field>
        )}
        {type !== 'transferencia' && (
          <Field label="Categoría">
            <CategorySelector
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              allowEmpty
            />
          </Field>
        )}
        <Field label="Nota"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          {existingTx && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-400 text-sm px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          )}
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function TxBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    gasto: 'bg-red-950 text-red-400 border-red-900',
    ingreso: 'bg-emerald-950 text-emerald-400 border-emerald-900',
    transferencia: 'bg-blue-950 text-blue-400 border-blue-900',
  };
  const labels: Record<string, string> = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs border ${styles[type] || styles.gasto}`}>{labels[type] || type}</span>;
}

import { useState, useEffect, useMemo } from 'react';
import type { Category, Transaction, Account } from '@/types';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategorySelector';
import { formatEUR, formatDate, formatAxisEUR, CHART_COLORS } from '@/lib/format';
import { prepareCategoryExpensesChartData } from '@/lib/chartData';
import { resolveCategory } from '@/lib/categories';
import { useCategoryContext } from '@/context/CategoryContext';
import { AddTransactionModal } from '@/pages/AccountsPage';
import { PieChart as PieIcon, BarChart3, Edit3 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis, CartesianGrid } from 'recharts';

interface CategoryExpensesChartProps {
  title?: string;
  transactions: Transaction[];
  categories?: Category[];
  accounts: Account[];
  accountId?: number | null;
  dateRange?: { desde?: string; hasta?: string } | null;
  showAccountSelector?: boolean;
}

export function getCategoryTransactions(
  transactions: Transaction[],
  categories: Category[],
  parentCategoryName: string,
  dateRange?: { desde?: string; hasta?: string } | null,
  accountId?: number | null
): Transaction[] {
  // Find all category IDs that match parent category or any of its subcategories
  const catMap = new Map<number, Category>(categories.map(c => [c.id, c]));

  const matchingCatIds = new Set<number>();
  for (const cat of categories) {
    let parentCat = cat;
    if (cat.parent_id) {
      parentCat = catMap.get(cat.parent_id) || cat;
    }
    if (parentCat.name === parentCategoryName) {
      matchingCatIds.add(cat.id);
    }
  }

  return transactions.filter(t => {
    if (t.type !== 'gasto') return false;

    // Account filter
    if (accountId && t.account_id !== accountId && t.to_account_id !== accountId) {
      return false;
    }

    // Date range filter
    if (dateRange) {
      if (dateRange.desde && t.date < dateRange.desde) return false;
      if (dateRange.hasta && t.date > dateRange.hasta) return false;
    }

    // Category filter
    if (!t.category_id) {
      return parentCategoryName === 'Sin categoría';
    }
    return matchingCatIds.has(t.category_id);
  });
}

export function CategoryExpensesChart({
  title = 'Gastos por categoría',
  transactions,
  categories: categoriesProp,
  accounts,
  accountId = null,
  dateRange = null,
  showAccountSelector = false,
}: CategoryExpensesChartProps) {
  const { categories: contextCategories } = useCategoryContext();
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>(accountId ? String(accountId) : '');
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');
  const [selectedCatName, setSelectedCatName] = useState<string | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<{ name: string; value: number; color: string } | null>(null);

  const categories = (categoriesProp && categoriesProp.length > 0) ? categoriesProp : contextCategories;
  const activeAccountId = selectedAccountFilter ? parseInt(selectedAccountFilter) : accountId;

  const chartData = useMemo(() => {
    return prepareCategoryExpensesChartData(transactions, categories, activeAccountId, dateRange);
  }, [transactions, categories, activeAccountId, dateRange]);

  const chartDataTotal = useMemo(() => {
    return chartData.reduce((s, d) => s + d.value, 0);
  }, [chartData]);

  const modalTransactions = useMemo(() => {
    if (!selectedCatName) return [];
    return getCategoryTransactions(transactions, categories, selectedCatName, dateRange, activeAccountId);
  }, [transactions, categories, selectedCatName, dateRange, activeAccountId]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-white font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {showAccountSelector && (
            <select
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 outline-none"
            >
              <option value="">Todas las cuentas</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <div className="flex items-center bg-slate-800 rounded border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => setChartType('donut')}
              className={`p-1 rounded ${chartType === 'donut' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Donut"
            >
              <PieIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`p-1 rounded ${chartType === 'bar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Barras"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-12">Sin gastos para mostrar</p>
      ) : chartType === 'donut' ? (
        <div className="space-y-4">
          <div className="relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={62}
                  className="cursor-pointer"
                >
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]}
                      onClick={() => setSelectedSlice(selectedSlice?.name === entry.name ? null : entry)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(v: any, name: any, item: any) => [
                    <span key="v" style={{ color: item?.payload?.color || '#ffffff', fontWeight: 600 }}>{formatEUR(Number(v))}</span>,
                    name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Total / Selection Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {selectedSlice ? (
                <>
                  <span className="text-slate-300 text-xs font-medium truncate max-w-[120px]">{selectedSlice.name}</span>
                  <span className="text-white font-bold text-base sm:text-lg">{formatEUR(selectedSlice.value)}</span>
                  <span className="text-slate-400 text-xs font-semibold">
                    {chartDataTotal > 0 ? ((selectedSlice.value / chartDataTotal) * 100).toFixed(0) : '0'}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Gasto Total</span>
                  <span className="text-white font-bold text-lg sm:text-xl">{formatEUR(chartDataTotal)}</span>
                </>
              )}
            </div>
          </div>

          {/* Pill Badge Legend Grid */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-800/80">
            {chartData.map((cat) => {
              const totalVal = chartData.reduce((s, d) => s + d.value, 0);
              const pct = totalVal > 0 ? ((cat.value / totalVal) * 100).toFixed(0) : '0';
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCatName(cat.name)}
                  className="flex items-center gap-2 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-full px-3 py-1 text-xs text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="font-medium truncate max-w-[120px]">{cat.name}</span>
                  <span className="text-slate-400 font-semibold">{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(v: any, name: any, item: any) => [
                <span key="v" style={{ color: item?.payload?.color || '#ffffff', fontWeight: 600 }}>{formatEUR(Number(v))}</span>,
                name
              ]}
            />
            <Bar dataKey="value" name="Gasto" fill="#dc2626" radius={[4, 4, 0, 0]} className="cursor-pointer">
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]}
                  onClick={() => setSelectedCatName(entry.name)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {selectedCatName && (
        <ExpenseCategoryModal
          categoryName={selectedCatName}
          transactions={modalTransactions}
          accounts={accounts}
          categories={categories}
          onClose={() => setSelectedCatName(null)}
        />
      )}
    </Card>
  );
}

export function ExpenseCategoryModal({
  categoryName,
  transactions,
  accounts,
  categories,
  onClose,
}: {
  categoryName: string;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
}) {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const accName = (id: number) => accounts.find(a => a.id === id)?.name || '—';
  const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-lg space-y-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-white font-semibold text-lg">{categoryName}</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Total gastado: <span className="text-red-400 font-bold">{formatEUR(total)}</span> ({transactions.length} movimientos)
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-lg">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {transactions.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">Sin transacciones registradas</p>
          ) : (
            transactions.map(t => {
              const resolved = resolveCategory(t.category_id, categories);
              const cat = t.category_id ? categories.find(c => c.id === t.category_id) : null;
              return (
                <div
                  key={t.id}
                  onClick={() => setEditingTx(t)}
                  className="flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 p-3 rounded-xl border border-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: resolved.color }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <CategoryBadge category={cat} categories={categories} size="xs" />
                        {t.note && <span className="text-slate-400 text-xs">({t.note})</span>}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">{formatDate(t.date)} · {accName(t.account_id)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 font-semibold text-sm">-{formatEUR(Math.abs(t.amount))}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingTx(t); }}
                      className="text-slate-500 hover:text-blue-400 p-1 transition-colors"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button type="button" onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-xl transition-colors">
          Cerrar
        </button>

        {editingTx && (
          <AddTransactionModal
            existingTx={editingTx}
            accounts={accounts}
            categories={categories}
            onClose={() => {
              setEditingTx(null);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

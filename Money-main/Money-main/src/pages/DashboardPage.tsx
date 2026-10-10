import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { DashboardData, PortfolioSummary, Transaction, Account, Category } from '@/types';
import { Card, StatCard } from '@/components/Card';
import { formatEUR, formatPercent, formatDate } from '@/lib/format';
import { CategoryBadge } from '@/components/CategorySelector';
import { Wallet, Briefcase, TrendingUp, PiggyBank, Landmark, ArrowRight } from 'lucide-react';

export function DashboardPage() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txLimit, setTxLimit] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getDashboard(),
      api.getPortfolioSummary(),
      api.getTransactions(),
      api.getAccounts(),
      api.getCategories(),
    ])
      .then(([d, s, t, a, c]) => {
        setDash(d);
        setSummary(s);
        setTransactions(t);
        setAccounts(a);
        setCategories(c);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <Card className="p-6"><p className="text-red-400">{error}</p></Card>;
  }

  const totalReturnPct = summary ? summary.totalReturnPct : 0;
  const trend = totalReturnPct > 0 ? 'up' : totalReturnPct < 0 ? 'down' : 'neutral';

  const accName = (id: number) => accounts.find(a => a.id === id)?.name || '—';
  const catById = (id: number | null) => id ? categories.find(c => c.id === id) || null : null;
  const recentTxs = transactions.slice(0, txLimit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Panel general</h1>
        <p className="text-slate-400 text-sm mt-1">Resumen de tu patrimonio</p>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-white font-semibold">Últimas transacciones</h2>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Mostrar:</span>
            <select
              value={txLimit}
              onChange={(e) => setTxLimit(Number(e.target.value))}
              className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
        {recentTxs.length === 0 ? (
          <p className="text-slate-500 text-sm p-5">Sin transacciones recientes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-800">
                  <th className="px-5 py-2 font-medium">Fecha</th>
                  <th className="px-5 py-2 font-medium">Cuenta</th>
                  <th className="px-5 py-2 font-medium">Detalle</th>
                  <th className="px-5 py-2 font-medium">Categoría</th>
                  <th className="px-5 py-2 font-medium text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {recentTxs.map((t) => {
                  const isTransfer = t.type === 'transferencia';
                  if (isTransfer) {
                    const isOutgoing = t.amount < 0;
                    const fromId = isOutgoing ? t.account_id : (t.to_account_id || t.account_id);
                    const toId = isOutgoing ? (t.to_account_id || t.account_id) : t.account_id;
                    const fromName = accName(fromId);
                    const toName = accName(toId);
                    const outgoingAmt = Math.abs(t.amount);
                    const incomingAmt = Math.abs(t.to_amount || t.amount);

                    return (
                      <tr key={t.id} className="border-b border-slate-800/50">
                        <td className="px-5 py-2.5 text-slate-300">{formatDate(t.date)}</td>
                        <td colSpan={2} className="px-5 py-2.5">
                          <div className="flex items-center gap-1.5 font-medium text-slate-200 text-sm">
                            <Landmark className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{fromName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mx-0.5" />
                            <Landmark className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{toName}</span>
                            {t.note && <span className="text-xs text-slate-500 font-normal">({t.note})</span>}
                          </div>
                        </td>
                        <td className="px-5 py-2.5"><CategoryBadge category={catById(t.category_id)} size="xs" /></td>
                        <td className="px-5 py-2.5 text-right font-medium">
                          <div className="flex items-center gap-2 justify-end text-xs sm:text-sm">
                            <span className="text-red-400">-{formatEUR(outgoingAmt)}</span>
                            <span className="text-emerald-400">+{formatEUR(incomingAmt)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const isExpense = t.type === 'gasto';
                  const color = isExpense ? 'text-red-400' : 'text-emerald-400';
                  const displayAmount = isExpense ? `-${formatEUR(Math.abs(t.amount))}` : formatEUR(Math.abs(t.amount), { sign: true });
                  return (
                    <tr key={t.id} className="border-b border-slate-800/50">
                      <td className="px-5 py-2.5 text-slate-300">{formatDate(t.date)}</td>
                      <td className="px-5 py-2.5 text-slate-400">{accName(t.account_id)}</td>
                      <td className="px-5 py-2.5 text-slate-400">{t.note || '—'}</td>
                      <td className="px-5 py-2.5"><CategoryBadge category={catById(t.category_id)} size="xs" /></td>
                      <td className={`px-5 py-2.5 text-right font-medium ${color}`}>{displayAmount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Patrimonio neto"
          value={formatEUR(dash?.netWorth || 0, { compact: true })}
          icon={<Wallet className="w-5 h-5" />}
        />
        <StatCard
          label="Inversiones"
          value={formatEUR(dash?.investmentValue || 0, { compact: true })}
          subValue={summary ? `Invertido: ${formatEUR(summary.totalInvested, { compact: true })}` : ''}
          icon={<Briefcase className="w-5 h-5" />}
        />
        <StatCard
          label="Ganancia/Pérdida"
          value={formatEUR(summary?.totalGain || 0, { compact: true, sign: true })}
          subValue={formatPercent(totalReturnPct)}
          trend={trend}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          label="Cuentas"
          value={formatEUR(dash?.accountsBalance || 0, { compact: true })}
          icon={<PiggyBank className="w-5 h-5" />}
        />
      </div>

      {summary && summary.productDetails.length > 0 && (
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Desglose por tipo</h2>
          <div className="space-y-3">
            {Object.entries(summary.byType)
              .sort((a, b) => b[1].value - a[1].value)
              .map(([type, data]) => {
                const pct = summary.totalValue > 0 ? (data.value / summary.totalValue) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-sm capitalize">{type}</span>
                      <span className="text-slate-400 text-sm">{formatEUR(data.value, { compact: true })} · {formatPercent(pct, 1)}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {summary && summary.productDetails.length > 0 && (
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Productos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-800">
                  <th className="pb-2 font-medium">Nombre</th>
                  <th className="pb-2 font-medium text-right">Valor</th>
                  <th className="pb-2 font-medium text-right">Invertido</th>
                  <th className="pb-2 font-medium text-right">G/P</th>
                  <th className="pb-2 font-medium text-right">Rentabilidad</th>
                </tr>
              </thead>
              <tbody>
                {summary.productDetails
                  .sort((a, b) => b.value - a.value)
                  .map((p) => {
                    const ret = p.invested > 0 ? (p.gain / p.invested) * 100 : 0;
                    const color = p.gain > 0 ? 'text-emerald-400' : p.gain < 0 ? 'text-red-400' : 'text-slate-400';
                    return (
                      <tr key={p.id} className="border-b border-slate-800/50">
                        <td className="py-3 text-white">{p.name}</td>
                        <td className="py-3 text-right text-slate-200">{formatEUR(p.value)}</td>
                        <td className="py-3 text-right text-slate-400">{formatEUR(p.invested)}</td>
                        <td className={`py-3 text-right ${color}`}>{formatEUR(p.gain, { sign: true })}</td>
                        <td className={`py-3 text-right ${color}`}>{formatPercent(ret)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

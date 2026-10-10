import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { DashboardData, PortfolioSummary } from '@/types';
import { Card, StatCard } from '@/components/Card';
import { formatEUR, formatPercent, formatAxisEUR } from '@/lib/format';
import { Wallet, Briefcase, TrendingUp, PiggyBank } from 'lucide-react';

export function DashboardPage() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getPortfolioSummary()])
      .then(([d, s]) => {
        setDash(d);
        setSummary(s);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Panel general</h1>
        <p className="text-slate-400 text-sm mt-1">Resumen de tu patrimonio</p>
      </div>

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

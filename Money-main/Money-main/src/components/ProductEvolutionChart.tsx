import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/Card';
import { formatEUR, formatPercent, formatAxisEUR, formatAxisPercent, CHART_COLORS } from '@/lib/format';
import { Search, Check } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid,
} from 'recharts';

interface ProductEvolutionChartProps {
  products: { id: number; name: string; color?: string | null }[];
}

type Metric = 'valor' | 'rentabilidad' | 'pure_return' | 'pure_return_percent' | 'area_stacked_eur' | 'area_stacked_pct';
type Period = '1M' | '3M' | '6M' | '1A' | 'TODO' | 'CUSTOM';

const PERIODS: { id: Period; label: string }[] = [
  { id: '1M', label: '1M' }, { id: '3M', label: '3M' }, { id: '6M', label: '6M' },
  { id: '1A', label: '1A' }, { id: 'TODO', label: 'Todo' }, { id: 'CUSTOM', label: 'Personalizado' },
];

function periodToRange(period: Period): { desde: string; hasta: string } | null {
  if (period === 'CUSTOM') return null;
  const hasta = new Date().toISOString().slice(0, 10);
  const d = new Date();
  switch (period) {
    case '1M': d.setMonth(d.getMonth() - 1); break;
    case '3M': d.setMonth(d.getMonth() - 3); break;
    case '6M': d.setMonth(d.getMonth() - 6); break;
    case '1A': d.setFullYear(d.getFullYear() - 1); break;
    case 'TODO': return { desde: '2000-01-01', hasta };
  }
  return { desde: d.toISOString().slice(0, 10), hasta };
}

function colorForId(id: number): string {
  return CHART_COLORS[id % CHART_COLORS.length];
}

export function ProductEvolutionChart({ products }: ProductEvolutionChartProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [metric, setMetric] = useState<Metric>('valor');
  const [period, setPeriod] = useState<Period>('3M');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));
  const [showTotal, setShowTotal] = useState(false);
  const [search, setSearch] = useState('');
  const [showSelector, setShowSelector] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved settings (Default to ALL products as requested)
  useEffect(() => {
    api.getSettings().then((settings) => {
      const savedSel = settings['inversiones_chart_selected'];
      const savedMetric = settings['inversiones_chart_metric'];
      const savedPeriod = settings['inversiones_chart_period'];
      const savedTotal = settings['inversiones_chart_show_total'];
      const savedFrom = settings['inversiones_chart_custom_from'];
      const savedTo = settings['inversiones_chart_custom_to'];
      if (savedSel) {
        const ids = savedSel.split(',').map(Number).filter(n => !isNaN(n));
        const validIds = ids.filter(id => products.some(p => p.id === id));
        setSelected(validIds.length > 0 ? validIds : products.map(p => p.id));
      } else {
        setSelected(products.map(p => p.id));
      }
      if (savedMetric === 'valor' || savedMetric === 'rentabilidad' || savedMetric === 'pure_return' || savedMetric === 'pure_return_percent') setMetric(savedMetric);
      if (savedPeriod && PERIODS.some(p => p.id === savedPeriod)) setPeriod(savedPeriod as Period);
      if (savedTotal === 'true') setShowTotal(true);
      if (savedFrom) setCustomFrom(savedFrom);
      if (savedTo) setCustomTo(savedTo);
      setSettingsLoaded(true);
    }).catch(() => {
      setSelected(products.map(p => p.id));
      setSettingsLoaded(true);
    });
  }, [products]);

  // Save settings when they change
  useEffect(() => {
    if (!settingsLoaded) return;
    api.setSetting('inversiones_chart_selected', selected.join(',')).catch(() => {});
    api.setSetting('inversiones_chart_metric', metric).catch(() => {});
    api.setSetting('inversiones_chart_period', period).catch(() => {});
    api.setSetting('inversiones_chart_show_total', String(showTotal)).catch(() => {});
    if (customFrom) api.setSetting('inversiones_chart_custom_from', customFrom).catch(() => {});
    if (customTo) api.setSetting('inversiones_chart_custom_to', customTo).catch(() => {});
  }, [selected, metric, period, showTotal, customFrom, customTo, settingsLoaded]);

  // Fetch series data
  useEffect(() => {
    if (!settingsLoaded || selected.length === 0) {
      setData([]);
      return;
    }
    const range = periodToRange(period);
    const desde = range ? range.desde : customFrom;
    const hasta = range ? range.hasta : customTo;
    if (!desde || !hasta) return;

    setLoading(true);
    setError('');
    api.getInvestmentSeries(selected, desde, hasta)
      .then((resp) => {
        const productsData = resp.products || [];
        const dateMap = new Map<string, Record<string, any>>();
        for (const p of productsData) {
          for (const point of p.series) {
            if (!dateMap.has(point.date)) dateMap.set(point.date, { date: point.date });
            const row = dateMap.get(point.date)!;
            let val = 0;
            if (metric === 'valor' || metric === 'area_stacked_eur' || metric === 'area_stacked_pct') {
              val = point.value;
            } else if (metric === 'pure_return') {
              val = point.value - point.invested;
            } else if (metric === 'pure_return_percent') {
              val = point.invested > 0 ? ((point.value - point.invested) / point.invested) * 100 : 0;
            } else {
              val = point.invested > 0 ? ((point.value / point.invested) - 1) * 100 : 0;
            }
            row[`p${p.productId}`] = val;
            row[`name_p${p.productId}`] = p.name;
          }
        }
        let sorted = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        if (metric === 'area_stacked_pct') {
          sorted = sorted.map(row => {
            let rowSum = 0;
            for (const p of productsData) {
              rowSum += Number(row[`p${p.productId}`]) || 0;
            }
            const newRow = { ...row };
            for (const p of productsData) {
              const rawVal = Number(row[`p${p.productId}`]) || 0;
              newRow[`p${p.productId}`] = rowSum > 0 ? (rawVal / rowSum) * 100 : 0;
            }
            return newRow;
          });
        }

        if (showTotal && sorted.length > 0) {
          for (const row of sorted) {
            let total = 0;
            for (const p of productsData) {
              const v = row[`p${p.productId}`];
              if (typeof v === 'number') {
                total += (metric === 'valor' || metric === 'area_stacked_eur') ? v : 0;
              }
            }
            if (metric === 'valor' || metric === 'area_stacked_eur') {
              row.__total = total;
            } else if (metric === 'pure_return') {
              let totalInvested = 0;
              let totalValue = 0;
              for (const p of productsData) {
                const point = p.series.find((s: any) => s.date === row.date);
                if (point) { totalValue += point.value; totalInvested += point.invested; }
              }
              row.__total = totalValue - totalInvested;
            } else if (metric === 'pure_return_percent') {
              let totalInvested = 0;
              let totalValue = 0;
              for (const p of productsData) {
                const point = p.series.find((s: any) => s.date === row.date);
                if (point) { totalValue += point.value; totalInvested += point.invested; }
              }
              row.__total = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
            } else {
              let totalInvested = 0;
              let totalValue = 0;
              for (const p of productsData) {
                const point = p.series.find((s: any) => s.date === row.date);
                if (point) { totalValue += point.value; totalInvested += point.invested; }
              }
              row.__total = totalInvested > 0 ? ((totalValue / totalInvested) - 1) * 100 : 0;
            }
          }
        }
        setData(sorted);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selected, metric, period, customFrom, customTo, showTotal, settingsLoaded]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const toggleProduct = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => setSelected(products.map(p => p.id));
  const selectNone = () => setSelected([]);

  const toggleLegend = (key: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showCustom = period === 'CUSTOM';
  const hasData = data.length > 0;
  const isPercent = metric === 'rentabilidad' || metric === 'pure_return_percent' || metric === 'area_stacked_pct';
  const formatY = (v: number) => isPercent ? formatAxisPercent(v) : formatAxisEUR(v);
  const formatTooltip = (v: any) => isPercent ? formatPercent(Number(v), 1) : formatEUR(Number(v), { sign: metric === 'pure_return' });

  const isAreaChart = metric === 'area_stacked_eur' || metric === 'area_stacked_pct';

  const lines = selected.map(id => {
    const p = products.find(prod => prod.id === id);
    return {
      key: `p${id}`,
      name: p?.name || `#${id}`,
      color: p?.color || colorForId(id),
    };
  });

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-white font-semibold">Evolución de productos</h2>
          <div className="flex items-center gap-2">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="bg-slate-800 text-slate-200 text-sm rounded-lg px-3 py-1.5 border border-slate-700 focus:border-blue-500 outline-none"
            >
              <option value="valor">Valor Total Patrimonio (€)</option>
              <option value="area_stacked_eur">Área Apilada - Dinero Total (€)</option>
              <option value="area_stacked_pct">Área Apilada - Porcentaje (%)</option>
              <option value="pure_return">Rendimiento Puro (sin aportaciones) (€)</option>
              <option value="pure_return_percent">Rendimiento Puro (%)</option>
              <option value="rentabilidad">Rentabilidad (%)</option>
            </select>
            <button
              onClick={() => setShowSelector(s => !s)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              {selected.length} productos
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                period === p.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
          {showCustom && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-slate-800 text-slate-200 text-sm rounded-lg px-2 py-1.5 border border-slate-700 focus:border-blue-500 outline-none" />
              <span className="text-slate-500 text-sm">→</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-slate-800 text-slate-200 text-sm rounded-lg px-2 py-1.5 border border-slate-700 focus:border-blue-500 outline-none" />
            </div>
          )}
        </div>

        {/* Product selector panel */}
        {showSelector && (
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto…"
                  className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
                />
              </div>
              <button onClick={selectAll} className="text-sm text-blue-400 hover:text-blue-300 px-2">Todos</button>
              <button onClick={selectNone} className="text-sm text-slate-400 hover:text-slate-300 px-2">Ninguno</button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    selected.includes(p.id) ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                  }`}>
                    {selected.includes(p.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-3 h-3 rounded-full" style={{ background: colorForId(p.id) }} />
                  <span className="text-sm text-slate-300">{p.name}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">Sin resultados</p>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showTotal} onChange={(e) => setShowTotal(e.target.checked)} className="accent-blue-500" />
              <span className="text-sm text-slate-300">Mostrar total</span>
            </label>
          </div>
        )}

        {/* Chart */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-sm text-center py-12">{error}</p>
        ) : !hasData ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-sm">Sin datos para mostrar. Selecciona productos con movimientos y precios.</p>
          </div>
        ) : isAreaChart ? (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} minTickGap={40} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatY} domain={metric === 'area_stacked_pct' ? [0, 100] : ['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }}
                itemStyle={{ color: '#ffffff' }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v: any, name: any) => [formatTooltip(v), name]}
              />
              <Legend
                onClick={(e: any) => toggleLegend(e.dataKey)}
                wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
              />
              {lines.map(line => (
                <Area
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stackId="1"
                  stroke={line.color}
                  fill={line.color}
                  fillOpacity={0.6}
                  hide={hidden.has(line.key)}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} minTickGap={40} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatY} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }}
                itemStyle={{ color: '#ffffff' }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v: any, name: any) => [formatTooltip(v), name]}
              />
              <Legend
                onClick={(e: any) => toggleLegend(e.dataKey)}
                wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
              />
              {lines.map(line => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  hide={hidden.has(line.key)}
                />
              ))}
              {showTotal && (
                <Line
                  type="monotone"
                  dataKey="__total"
                  name="Total"
                  stroke="#ffffff"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={false}
                  hide={hidden.has('__total')}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

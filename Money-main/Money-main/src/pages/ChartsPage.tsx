import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import type { ChartWidget, Transaction, Account, Category } from '@/types';
import { Card } from '@/components/Card';
import { CategoryExpensesChart, ExpenseCategoryModal, getCategoryTransactions } from '@/components/CategoryExpensesChart';
import { formatEUR, formatAxisEUR, CHART_COLORS } from '@/lib/format';
import {
  Plus, Trash2, Pin, PinOff, Edit3, Copy, ArrowUp, ArrowDown,
  Search, X, Check, LayoutGrid, BarChart3, PieChart as PieIcon,
  LineChart as LineIcon, AreaChart as AreaIcon, Layers, RotateCcw,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid,
} from 'recharts';

const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';
const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 };

const TEMPLATES = [
  { id: 'gastos_cat', name: 'Gastos por categoría', chart_type: 'pie', metric: 'gastos', group_by: 'categoria', period: 'este_mes', icon: PieIcon },
  { id: 'ing_vs_gas', name: 'Ingresos vs gastos por mes', chart_type: 'bar', metric: 'neto', group_by: 'mes', period: '12m', icon: BarChart3 },
  { id: 'saldo_acum', name: 'Saldo acumulado', chart_type: 'line', metric: 'saldo', group_by: 'mes', period: '12m', icon: LineIcon },
  { id: 'gasto_grupo', name: 'Gasto por grupo de categorías', chart_type: 'stacked_bar', metric: 'gastos', group_by: 'categoria_principal', period: '6m', icon: Layers },
  { id: 'ahorro_neto', name: 'Ahorro neto por mes', chart_type: 'bar', metric: 'neto', group_by: 'mes', period: '12m', icon: BarChart3 },
  { id: 'gastos_cuenta', name: 'Gastos por cuenta', chart_type: 'pie', metric: 'gastos', group_by: 'cuenta', period: 'este_mes', icon: PieIcon },
  { id: 'evol_cat', name: 'Evolución de una categoría', chart_type: 'line', metric: 'gastos', group_by: 'mes', period: '12m', icon: LineIcon },
  { id: 'blanco', name: 'En blanco', chart_type: 'bar', metric: 'gastos', group_by: 'mes', period: '3m', icon: LayoutGrid },
];

const METRICS = [
  { value: 'gastos', label: 'Gastos' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'neto', label: 'Neto (ingresos - gastos)' },
  { value: 'saldo', label: 'Saldo acumulado' },
];

const GROUP_BY = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'ano', label: 'Año' },
  { value: 'categoria', label: 'Categoría' },
  { value: 'categoria_principal', label: 'Grupo de categorías' },
  { value: 'cuenta', label: 'Cuenta' },
];

const PERIODS = [
  { value: 'este_mes', label: 'Este mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' },
  { value: 'este_ano', label: 'Este año' },
  { value: 'all', label: 'Todo' },
  { value: 'custom', label: 'Personalizado' },
];

const CHART_TYPES = [
  { value: 'bar', label: 'Barras', icon: BarChart3 },
  { value: 'stacked_bar', label: 'Barras apiladas', icon: Layers },
  { value: 'line', label: 'Líneas', icon: LineIcon },
  { value: 'area', label: 'Área', icon: AreaIcon },
  { value: 'pie', label: 'Donut', icon: PieIcon },
];

export function ChartsPage() {
  const [widgets, setWidgets] = useState<ChartWidget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingWidget, setEditingWidget] = useState<ChartWidget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ChartWidget | null>(null);
  const [renamingWidget, setRenamingWidget] = useState<ChartWidget | null>(null);

  const load = () => {
    Promise.all([api.getWidgets(), api.getAccounts(), api.getCategories()])
      .then(([w, a, c]) => {
        setWidgets(w); setAccounts(a); setCategories(c);
      })
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

  const moveWidget = async (id: number, dir: -1 | 1) => {
    const idx = widgets.findIndex(w => w.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= widgets.length) return;
    const reordered = [...widgets];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setWidgets(reordered);
    await api.reorderWidgets(reordered.map(w => w.id));
  };

  const togglePin = async (w: ChartWidget) => {
    await api.updateWidget(w.id, { pinned: w.pinned ? 0 : 1 });
    load();
  };

  const toggleSize = async (w: ChartWidget) => {
    await api.updateWidget(w.id, { size: w.size === 2 ? 1 : 2 });
    load();
  };

  const duplicateWidget = async (w: ChartWidget) => {
    await api.duplicateWidget(w.id);
    load();
  };

  const restoreDefaults = async () => {
    await api.restoreDefaultWidgets();
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gráficas</h1>
          <p className="text-slate-400 text-sm mt-1">Visualiza tus datos financieros</p>
        </div>
        <div className="flex gap-2">
          <button onClick={restoreDefaults} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg transition-colors">
            <RotateCcw className="w-4 h-4" /> Restaurar por defecto
          </button>
          <button onClick={() => setShowWizard(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Crear gráfica
          </button>
        </div>
      </div>

      {widgets.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-500 mb-4">No tienes gráficas. Crea una o restaura las por defecto.</p>
          <button onClick={restoreDefaults} className="text-blue-400 hover:text-blue-300 text-sm">Restaurar gráficas por defecto</button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {widgets.map((w, i) => (
            <Card key={w.id} className={`p-5 ${w.size === 2 ? 'lg:col-span-2' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  {w.pinned === 1 && <Pin className="w-4 h-4 text-blue-400 shrink-0" />}
                  <h3 className="text-white font-medium text-sm truncate">{w.name}</h3>
                  {w.default_key && <span className="text-slate-600 text-xs shrink-0">por defecto</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => moveWidget(w.id, -1)} disabled={i === 0} className="text-slate-600 hover:text-slate-300 disabled:opacity-30 p-1">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveWidget(w.id, 1)} disabled={i === widgets.length - 1} className="text-slate-600 hover:text-slate-300 disabled:opacity-30 p-1">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => togglePin(w)} className="text-slate-600 hover:text-blue-400 p-1" title={w.pinned ? 'Quitar del Panel' : 'Fijar en Panel'}>
                    {w.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => toggleSize(w)} className="text-slate-600 hover:text-slate-300 p-1 text-xs" title="Cambiar tamaño">
                    {w.size === 2 ? '1 col' : '2 col'}
                  </button>
                  <button onClick={() => setRenamingWidget(w)} className="text-slate-600 hover:text-blue-400 p-1" title="Renombrar">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingWidget(w)} className="text-slate-600 hover:text-blue-400 p-1" title="Editar">
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => duplicateWidget(w)} className="text-slate-600 hover:text-blue-400 p-1" title="Duplicar">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteConfirm(w)} className="text-slate-600 hover:text-red-400 p-1" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <WidgetChart widget={w} accounts={accounts} categories={categories} />
            </Card>
          ))}
        </div>
      )}

      {showWizard && <WidgetWizard accounts={accounts} categories={categories} onClose={() => { setShowWizard(false); load(); }} />}
      {editingWidget && <WidgetWizard accounts={accounts} categories={categories} editWidget={editingWidget} onClose={() => { setEditingWidget(null); load(); }} />}
      {deleteConfirm && (
        <DeleteConfirm widget={deleteConfirm} onCancel={() => setDeleteConfirm(null)} onConfirm={async () => { await api.deleteWidget(deleteConfirm.id); setDeleteConfirm(null); load(); }} />
      )}
      {renamingWidget && (
        <RenameModal widget={renamingWidget} onClose={() => setRenamingWidget(null)} onSave={async (name) => { await api.updateWidget(renamingWidget.id, { name }); setRenamingWidget(null); load(); }} />
      )}
    </div>
  );
}

// ===================== WIZARD =====================

interface WizardConfig {
  name: string;
  chart_type: string;
  metric: string;
  group_by: string;
  period: string;
  custom_from: string;
  custom_to: string;
  account_filter: string;
  category_filter: string;
  top_n: number;
  show_legend: boolean;
  show_values: boolean;
}

function WidgetWizard({ accounts, categories, editWidget, onClose }: {
  accounts: Account[];
  categories: Category[];
  editWidget?: ChartWidget;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<WizardConfig>(() => {
    if (editWidget) return {
      name: editWidget.name,
      chart_type: editWidget.chart_type,
      metric: editWidget.metric,
      group_by: editWidget.group_by,
      period: editWidget.period,
      custom_from: editWidget.custom_from || '',
      custom_to: editWidget.custom_to || '',
      account_filter: editWidget.account_filter || '',
      category_filter: '',
      top_n: 0,
      show_legend: true,
      show_values: false,
    };
    return {
      name: '',
      chart_type: 'bar',
      metric: 'gastos',
      group_by: 'mes',
      period: '3m',
      custom_from: '',
      custom_to: '',
      account_filter: '',
      category_filter: '',
      top_n: 0,
      show_legend: true,
      show_values: false,
    };
  });
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showTemplates, setShowTemplates] = useState(!editWidget);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchPreview = useCallback(() => {
    setPreviewLoading(true);
    setPreviewError('');
    api.getGraficaDatos({
      metric: config.metric,
      group_by: config.group_by,
      period: config.period,
      custom_from: config.custom_from || null,
      custom_to: config.custom_to || null,
      account_filter: config.account_filter || null,
      category_filter: config.category_filter || null,
      chart_type: config.chart_type,
      top_n: config.top_n > 0 ? config.top_n : null,
    })
      .then(setPreviewData)
      .catch((err) => setPreviewError(err.message))
      .finally(() => setPreviewLoading(false));
  }, [config]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchPreview, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchPreview]);

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setConfig(prev => ({ ...prev, name: prev.name || t.name, chart_type: t.chart_type, metric: t.metric, group_by: t.group_by, period: t.period }));
    setShowTemplates(false);
  };

  const save = async (alsoPin: boolean) => {
    if (!config.name) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: config.name,
        chart_type: config.chart_type,
        metric: config.metric,
        group_by: config.group_by,
        period: config.period,
        custom_from: config.custom_from || null,
        custom_to: config.custom_to || null,
        account_filter: config.account_filter || null,
        tag_filter: null,
        pinned: alsoPin ? 1 : (editWidget?.pinned ?? 0),
        size: editWidget?.size ?? 1,
      };
      if (editWidget) {
        await api.updateWidget(editWidget.id, payload);
      } else {
        await api.createWidget(payload);
      }
      onClose();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const update = (patch: Partial<WizardConfig>) => setConfig(prev => ({ ...prev, ...patch }));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 m-auto w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-white font-semibold text-lg">{editWidget ? 'Editar gráfica' : 'Nueva gráfica'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Templates */}
        {showTemplates && !editWidget && (
          <div className="p-6 border-b border-slate-800 overflow-y-auto">
            <h3 className="text-slate-300 text-sm font-medium mb-3">Plantillas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TEMPLATES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    className="flex flex-col items-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-xl p-4 transition-colors border border-slate-700 hover:border-blue-500">
                    <Icon className="w-8 h-8 text-blue-400" />
                    <span className="text-slate-300 text-xs text-center">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body: config + preview */}
        <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* Config panel */}
          <div className="lg:w-1/2 p-6 overflow-y-auto space-y-4 border-r border-slate-800">
            {!showTemplates && !editWidget && (
              <button onClick={() => setShowTemplates(true)} className="text-blue-400 hover:text-blue-300 text-sm">← Ver plantillas</button>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre</label>
              <input value={config.name} onChange={(e) => update({ name: e.target.value })} className={inputCls} placeholder="Mi gráfica…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo de gráfica</label>
              <div className="grid grid-cols-5 gap-2">
                {CHART_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.value} onClick={() => update({ chart_type: t.value })}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${config.chart_type === t.value ? 'border-blue-500 bg-blue-600/10 text-blue-400' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px]">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Métrica</label>
                <select value={config.metric} onChange={(e) => update({ metric: e.target.value })} className={inputCls}>
                  {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Agrupar por</label>
                <select value={config.group_by} onChange={(e) => update({ group_by: e.target.value })} className={inputCls}>
                  {GROUP_BY.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Periodo</label>
              <select value={config.period} onChange={(e) => update({ period: e.target.value })} className={inputCls}>
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {config.period === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Desde</label>
                  <input type="date" value={config.custom_from} onChange={(e) => update({ custom_from: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Hasta</label>
                  <input type="date" value={config.custom_to} onChange={(e) => update({ custom_to: e.target.value })} className={inputCls} />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Filtrar por cuentas</label>
              <select multiple value={config.account_filter ? config.account_filter.split(',') : []}
                onChange={(e) => update({ account_filter: Array.from(e.target.selectedOptions).map(o => o.value).join(',') })}
                className={`${inputCls} h-24`}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <p className="text-slate-500 text-xs mt-1">Ctrl+click para seleccionar varias</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Filtrar por categorías</label>
              <select multiple value={config.category_filter ? config.category_filter.split(',') : []}
                onChange={(e) => update({ category_filter: Array.from(e.target.selectedOptions).map(o => o.value).join(',') })}
                className={`${inputCls} h-24`}>
                {categories.filter(c => c.parent_id === null).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {(config.group_by === 'categoria' || config.group_by === 'categoria_principal' || config.group_by === 'cuenta') && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Top N + Otros (0 = todos)</label>
                <input type="number" min={0} value={config.top_n} onChange={(e) => update({ top_n: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.show_legend} onChange={(e) => update({ show_legend: e.target.checked })} className="accent-blue-500" />
                <span className="text-slate-300 text-sm">Leyenda</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.show_values} onChange={(e) => update({ show_values: e.target.checked })} className="accent-blue-500" />
                <span className="text-slate-300 text-sm">Mostrar valores</span>
              </label>
            </div>
          </div>

          {/* Preview panel */}
          <div className="lg:w-1/2 p-6 overflow-y-auto bg-slate-950/30">
            <h3 className="text-slate-300 text-sm font-medium mb-3">Vista previa</h3>
            {previewLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : previewError ? (
              <div className="text-center py-12"><p className="text-red-400 text-sm">{previewError}</p></div>
            ) : !previewData || (previewData.data && previewData.data.length === 0) ? (
              <div className="text-center py-12"><p className="text-slate-500 text-sm">Sin datos con estos filtros</p></div>
            ) : (
              <PreviewChart config={config} data={previewData} categories={categories} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 shrink-0">
          <div>{error && <p className="text-red-400 text-sm">{error}</p>}</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-4 py-2.5 rounded-lg transition-colors">Cancelar</button>
            <button onClick={() => save(false)} disabled={saving} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2.5 rounded-lg transition-colors disabled:bg-slate-800">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => save(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:bg-slate-800">
              Guardar y fijar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== PREVIEW CHART =====================

function PreviewChart({ config, data, categories, onCellClick }: { config: WizardConfig; data: any; categories: Category[]; onCellClick?: (catName: string) => void }) {
  const chartType = config.chart_type;
  const d = data.data || [];
  if (!d || d.length === 0) return <p className="text-slate-500 text-sm text-center py-12">Sin datos</p>;

  const catColors = (name: string) => categories.find(c => c.name === name)?.color || CHART_COLORS[0];

  // DONUT / PIE
  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={d}
            dataKey={data.type === 'category' ? 'value' : 'value' in d[0] ? 'value' : 'gastos'}
            nameKey={data.type === 'category' ? 'name' : 'label'}
            cx="50%" cy="50%" outerRadius={90} innerRadius={45}
            label={config.show_values ? (e: any) => `${e.name || e.label}: ${formatEUR(e.value || e.gastos || 0, { compact: true })}` : false}
          >
            {d.map((entry: any, i: number) => (
              <Cell key={i} fill={entry.color || catColors(entry.name || entry.label) || CHART_COLORS[i % CHART_COLORS.length]} onClick={() => onCellClick?.(entry.name || entry.label)} className="cursor-pointer" />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => formatEUR(Number(v))} />
          {config.show_legend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // LINE
  if (chartType === 'line') {
    const xKey = data.type === 'category' ? 'name' : 'label';
    const valKey = data.type === 'category' ? 'value' : 'value' in d[0] ? 'value' : 'neto' in d[0] ? 'neto' : 'gastos';
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={d} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey={xKey} tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => formatEUR(Number(v))} />
          {config.show_legend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Line type="monotone" dataKey={valKey} name={config.name || 'Valor'} stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // AREA
  if (chartType === 'area') {
    const xKey = data.type === 'category' ? 'name' : 'label';
    const valKey = data.type === 'category' ? 'value' : 'value' in d[0] ? 'value' : 'neto' in d[0] ? 'neto' : 'gastos';
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={d} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey={xKey} tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => formatEUR(Number(v))} />
          {config.show_legend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Area type="monotone" dataKey={valKey} name={config.name || 'Valor'} stroke="#3b82f6" fill="#3b82f633" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // BARRAS STACKED / BARRAS
  const xKey = data.type === 'category' ? 'name' : 'label';

  if (data.type === 'neto') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={d} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => formatEUR(Number(v))} />
          {config.show_legend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Bar dataKey="ingresos" name="Ingresos" stackId={chartType === 'stacked_bar' ? 'a' : undefined} fill="#059669" radius={chartType === 'stacked_bar' ? [0, 0, 0, 0] : [4, 4, 0, 0]} />
          <Bar dataKey="gastos" name="Gastos" stackId={chartType === 'stacked_bar' ? 'a' : undefined} fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const valKey = data.type === 'category' ? 'value' : 'value' in d[0] ? 'value' : 'gastos';
  const color = config.metric === 'gastos' ? '#dc2626' : '#3b82f6';

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={d} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey={xKey} tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => formatEUR(Number(v))} />
        {config.show_legend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Bar dataKey={valKey} name={config.name || 'Valor'} fill={color} radius={[4, 4, 0, 0]}>
          {data.type === 'category' && d.map((entry: any, i: number) => (
            <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} onClick={() => onCellClick?.(entry.name || entry.label)} className="cursor-pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ===================== WIDGET CHART (displayed in grid) =====================

function WidgetChart({ widget, accounts, categories }: { widget: ChartWidget; accounts: Account[]; categories: Category[] }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(widget.period);
  const [accountFilter, setAccountFilter] = useState(widget.account_filter || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getGraficaDatos({
        metric: widget.metric,
        group_by: widget.group_by,
        period,
        custom_from: widget.custom_from,
        custom_to: widget.custom_to,
        account_filter: accountFilter || null,
        category_filter: null,
        chart_type: widget.chart_type,
        top_n: null,
      }),
      api.getTransactions(),
    ])
      .then(([grafData, txs]) => {
        setData(grafData);
        setTransactions(txs);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [widget.id, widget.metric, widget.group_by, period, widget.custom_from, widget.custom_to, accountFilter, widget.chart_type]);

  const config: WizardConfig = {
    name: widget.name, chart_type: widget.chart_type, metric: widget.metric,
    group_by: widget.group_by, period, custom_from: widget.custom_from || '',
    custom_to: widget.custom_to || '', account_filter: accountFilter,
    category_filter: '', top_n: 0, show_legend: true, show_values: false,
  };

  const handleCellClick = (catName: string) => {
    if (widget.group_by === 'categoria' || widget.group_by === 'categoria_principal') {
      setSelectedCategory(catName);
    }
  };

  const filteredModalTx = useMemo(() => {
    if (!selectedCategory) return [];
    return transactions.filter(t => {
      if (t.type !== 'gasto') return false;
      if (accountFilter) {
        const accIds = accountFilter.split(',').map(Number);
        if (!accIds.includes(t.account_id)) return false;
      }
      const cat = t.category_id ? categories.find(c => c.id === t.category_id) : null;
      let parentCat = cat;
      if (cat && cat.parent_id) {
        parentCat = categories.find(c => c.id === cat.parent_id) || cat;
      }
      const name = parentCat ? parentCat.name : 'Sin categoría';
      return name === selectedCategory;
    });
  }, [selectedCategory, transactions, accountFilter, categories]);

  const modalTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    const accId = accountFilter ? parseInt(accountFilter) : null;
    return getCategoryTransactions(transactions, categories, selectedCategory, null, accId);
  }, [selectedCategory, transactions, categories, accountFilter]);

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2">
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="bg-slate-800 text-slate-400 text-xs rounded-lg px-2 py-1 border border-slate-700 outline-none">
          <option value="">Todas las cuentas</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-slate-800 text-slate-400 text-xs rounded-lg px-2 py-1 border border-slate-700 outline-none">
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm text-center py-8">{error}</p>
      ) : !data || (data.data && data.data.length === 0) ? (
        <p className="text-slate-500 text-sm text-center py-8">Sin datos</p>
      ) : (
        <PreviewChart config={config} data={data} categories={categories} onCellClick={handleCellClick} />
      )}

      {selectedCategory && (
        <ExpenseCategoryModal
          categoryName={selectedCategory}
          transactions={modalTransactions}
          accounts={accounts}
          categories={categories}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}

// ===================== MODALS =====================

function DeleteConfirm({ widget, onCancel, onConfirm }: { widget: ChartWidget; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center px-4" onClick={onCancel}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold">¿Eliminar "{widget.name}"?</h2>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2.5 rounded-lg">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

function RenameModal({ widget, onClose, onSave }: { widget: ChartWidget; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(widget.name);
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold">Renombrar</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg">Cancelar</button>
          <button onClick={() => name && onSave(name)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm py-2.5 rounded-lg">Guardar</button>
        </div>
      </div>
    </div>
  );
}

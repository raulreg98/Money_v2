import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { Category, Transaction } from '@/types';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategorySelector';
import { formatEUR, formatDate, formatAxisEUR } from '@/lib/format';
import { ICON_LIST, getIcon, suggestIcon, COLOR_PALETTE } from '@/lib/categoryIcons';
import {
  Plus, Trash2, Edit3, ChevronDown, ChevronRight, Search, X, AlertTriangle,
  FolderPlus, ArrowLeft, Check, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState<'group' | 'category' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  const load = () => {
    api.getCategories()
      .then(setCategories)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const parents = useMemo(() => categories.filter(c => c.parent_id === null), [categories]);
  const childrenOf = (pid: number) => categories.filter(c => c.parent_id === pid);

  const moveParent = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= parents.length) return;
    const newParents = [...parents];
    const [moved] = newParents.splice(index, 1);
    newParents.splice(targetIndex, 0, moved);

    // Build complete ordered IDs list preserving children relative positions
    const orderedIds: number[] = [];
    for (const p of newParents) {
      orderedIds.push(p.id);
      for (const child of childrenOf(p.id)) {
        orderedIds.push(child.id);
      }
    }

    try {
      await api.reorderCategories(orderedIds);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const moveChild = async (parentId: number, childIndex: number, direction: 'up' | 'down') => {
    const siblings = childrenOf(parentId);
    const targetIndex = direction === 'up' ? childIndex - 1 : childIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    const newSiblings = [...siblings];
    const [moved] = newSiblings.splice(childIndex, 1);
    newSiblings.splice(targetIndex, 0, moved);

    const orderedIds: number[] = [];
    for (const p of parents) {
      orderedIds.push(p.id);
      const currentChildren = p.id === parentId ? newSiblings : childrenOf(p.id);
      for (const child of currentChildren) {
        orderedIds.push(child.id);
      }
    }

    try {
      await api.reorderCategories(orderedIds);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredParents = search
    ? parents.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        childrenOf(p.id).some(c => c.name.toLowerCase().includes(search.toLowerCase()))
      )
    : parents;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (selectedCat) {
    return (
      <CategoryDetail
        category={selectedCat}
        categories={categories}
        onBack={() => setSelectedCat(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Categorías</h1>
          <p className="text-slate-400 text-sm mt-1">Organiza tus gastos e ingresos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCreating('group')} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <FolderPlus className="w-4 h-4" /> Nuevo grupo
          </button>
          <button onClick={() => setCreating('category')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Nueva categoría
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar categoría…"
          className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:border-blue-500 outline-none" />
      </div>

      {error && <Card className="p-4"><p className="text-red-400 text-sm">{error}</p></Card>}

      {parents.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-500">No tienes categorías. Crea un grupo para empezar.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredParents.map((parent, parentIdx) => {
            const subs = childrenOf(parent.id);
            const isExpanded = expanded.has(parent.id) || (!!search && subs.length > 0);
            const Icon = getIcon(parent.icon) || getIcon(suggestIcon(parent.name));
            return (
              <Card key={parent.id} className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {subs.length > 0 ? (
                      <button onClick={() => toggleExpand(parent.id)} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}
                    <button onClick={() => setSelectedCat(parent)} className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                      {Icon && <Icon className="w-5 h-5 shrink-0" style={{ color: parent.color }} />}
                      <span className="text-white font-medium truncate">{parent.name}</span>
                      <span className="text-slate-500 text-xs shrink-0">{subs.length} subcategorías</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!search && (
                      <div className="flex items-center mr-1 bg-slate-800/80 rounded border border-slate-700/50">
                        <button
                          onClick={() => moveParent(parentIdx, 'up')}
                          disabled={parentIdx === 0}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
                          title="Subir grupo"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveParent(parentIdx, 'down')}
                          disabled={parentIdx === parents.length - 1}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
                          title="Bajar grupo"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <button onClick={() => setEditing(parent)} className="text-slate-500 hover:text-blue-400 transition-colors p-1" title="Editar">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleting(parent)} className="text-slate-600 hover:text-red-400 transition-colors p-1" title="Borrar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isExpanded && subs.length > 0 && (
                  <div className="border-t border-slate-800">
                    {subs.map((sub, subIdx) => {
                      const SubIcon = getIcon(sub.icon) || getIcon(suggestIcon(sub.name));
                      return (
                        <div key={sub.id} className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors">
                          <button onClick={() => setSelectedCat(sub)} className="flex items-center gap-2 pl-6 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                            {SubIcon && <SubIcon className="w-4 h-4 shrink-0" style={{ color: sub.color || parent.color }} />}
                            <span className="text-slate-300 text-sm truncate">{sub.name}</span>
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!search && (
                              <div className="flex items-center mr-1 bg-slate-800/60 rounded border border-slate-700/40">
                                <button
                                  onClick={() => moveChild(parent.id, subIdx, 'up')}
                                  disabled={subIdx === 0}
                                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
                                  title="Subir subcategoría"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => moveChild(parent.id, subIdx, 'down')}
                                  disabled={subIdx === subs.length - 1}
                                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
                                  title="Bajar subcategoría"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            <button onClick={() => setEditing(sub)} className="text-slate-500 hover:text-blue-400 transition-colors p-1">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleting(sub)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <CategoryModal
          categories={categories}
          mode={creating}
          onClose={() => { setCreating(null); load(); }}
        />
      )}
      {editing && (
        <CategoryModal
          categories={categories}
          category={editing}
          onClose={() => { setEditing(null); load(); }}
        />
      )}
      {deleting && (
        <DeleteCategoryModal
          category={deleting}
          categories={categories}
          childrenOf={childrenOf}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); load(); }}
        />
      )}
    </div>
  );
}

// ===================== CATEGORY MODAL (create/edit) =====================

function CategoryModal({ categories, category, mode, onClose }: {
  categories: Category[];
  category?: Category;
  mode?: 'group' | 'category';
  onClose: () => void;
}) {
  const isGroup = category ? category.parent_id === null : mode === 'group';
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || '#6b7280');
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [icon, setIcon] = useState(category?.icon || '');
  const [parentId, setParentId] = useState(category?.parent_id?.toString() || (mode === 'category' ? '' : ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [iconSearch, setIconSearch] = useState('');

  const parents = categories.filter(c => c.parent_id === null && c.id !== category?.id);
  const isSubcategory = isGroup ? false : !!parentId;

  const effectiveColor = isSubcategory && !useCustomColor
    ? parents.find(p => p.id === parseInt(parentId))?.color || color
    : color;

  const filteredIcons = iconSearch
    ? ICON_LIST.filter(e => e.name.includes(iconSearch.toLowerCase()))
    : ICON_LIST;

  const save = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const data: any = {
        name: name.trim(),
        color: effectiveColor,
        icon: icon || suggestIcon(name.trim()),
      };
      if (!isGroup) {
        data.parent_id = parentId ? parseInt(parentId) : null;
      } else {
        data.parent_id = null;
      }
      if (category) {
        await api.updateCategory(category.id, data);
      } else {
        await api.createCategory(data);
      }
      onClose();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">
          {category ? 'Editar' : 'Nuevo'} {isGroup ? 'grupo' : isSubcategory ? 'subcategoría' : 'categoría'}
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
        </div>

        {!isGroup && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Grupo</label>
            <select value={parentId} onChange={(e) => { setParentId(e.target.value); setUseCustomColor(false); }} className={inputCls}>
              <option value="">— Sin grupo (categoría principal) —</option>
              {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Color</label>
          {isSubcategory && (
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input type="checkbox" checked={!useCustomColor} onChange={(e) => setUseCustomColor(!e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-slate-300 text-sm">Heredar del grupo</span>
            </label>
          )}
          {(!isSubcategory || useCustomColor) && (
            <>
              <div className="flex flex-wrap gap-2 mb-2">
                {COLOR_PALETTE.map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-lg transition-transform ${color === c ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-110'}`} style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer" />
                <span className="text-slate-400 text-sm">Color libre</span>
              </div>
            </>
          )}
          {isSubcategory && !useCustomColor && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-5 h-5 rounded" style={{ background: effectiveColor }} />
              {effectiveColor}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Icono</label>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={iconSearch} onChange={(e) => setIconSearch(e.target.value)} placeholder="Buscar icono…" className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg pl-8 pr-3 py-1.5 border border-slate-700 focus:border-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-40 overflow-y-auto bg-slate-950/50 rounded-lg p-2 border border-slate-800">
            {filteredIcons.map(({ name: iconame, icon: Icon }) => (
              <button key={iconame} onClick={() => setIcon(iconame)} title={iconame}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${icon === iconame ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          {icon && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-slate-400 text-sm">Seleccionado:</span>
              <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2 py-1">
                {(() => { const I = getIcon(icon); return I ? <I className="w-4 h-4 text-blue-400" /> : null; })()}
                <span className="text-slate-300 text-xs">{icon}</span>
                <button onClick={() => setIcon('')} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ===================== DELETE MODAL =====================

function DeleteCategoryModal({ category, categories, childrenOf, onClose, onDeleted }: {
  category: Category;
  categories: Category[];
  childrenOf: (pid: number) => Category[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [stats, setStats] = useState<{ txCount: number; totalGastos: number; totalIngresos: number } | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const [mode, setMode] = useState<'reassign' | 'delete'>('reassign');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.getCategoryStats(category.id).then(s => {
      setStats(s);
      if (s.txCount === 0) setMode('delete');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [category.id]);

  const subs = childrenOf(category.id);
  const hasChildren = subs.length > 0;
  const hasTransactions = !!(stats && stats.txCount > 0);

  const otherCategories = categories.filter(c => c.id !== category.id && c.parent_id === null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (hasTransactions && mode === 'reassign' && reassignTo) {
        await api.deleteCategory(category.id, parseInt(reassignTo));
      } else {
        await api.deleteCategory(category.id);
      }
      onDeleted();
    } catch (err: any) {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <h2 className="text-white font-semibold text-lg">Borrar "{category.name}"</h2>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">Cargando…</p>
        ) : (
          <>
            <p className="text-slate-300 text-sm">
              {hasTransactions
                ? `Esta categoría tiene ${stats!.txCount} transacciones (${formatEUR(stats!.totalGastos)} en gastos, ${formatEUR(stats!.totalIngresos)} en ingresos).`
                : 'Esta categoría no tiene transacciones.'}
              {hasChildren && ` Tiene ${subs.length} subcategorías que se convertirán en categorías principales.`}
            </p>

            {hasTransactions && (
              <>
                <div className="flex gap-2">
                  <button onClick={() => setMode('reassign')} className={`flex-1 text-sm py-2 rounded-lg transition-colors ${mode === 'reassign' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    Mover a otra categoría
                  </button>
                  <button onClick={() => setMode('delete')} className={`flex-1 text-sm py-2 rounded-lg transition-colors ${mode === 'delete' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    Quitar categoría
                  </button>
                </div>
                {mode === 'reassign' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Mover transacciones a</label>
                    <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 outline-none">
                      <option value="">Seleccionar…</option>
                      {otherCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {mode === 'delete' && (
                  <p className="text-amber-400 text-sm">Las transacciones quedarán sin categoría.</p>
                )}
              </>
            )}
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={deleting || (hasTransactions && mode === 'reassign' && !reassignTo)} className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">
            {deleting ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== CATEGORY DETAIL =====================

function CategoryDetail({ category, categories, onBack }: {
  category: Category;
  categories: Category[];
  onBack: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState('');
  const [showAll, setShowAll] = useState(false);

  const childIds = categories.filter(c => c.parent_id === category.id).map(c => c.id);
  const allCatIds = [category.id, ...childIds];

  const load = () => {
    setLoading(true);
    api.getCategoryTransactions(category.id, {
      q: search,
      tipo,
      limit: showAll ? 1000 : 20,
    }).then(setData).catch(err => setError(err.message)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [category.id, search, tipo, showAll]);

  const Icon = getIcon(category.icon) || getIcon(suggestIcon(category.name));

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
        <button onClick={onBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <Card className="p-6"><p className="text-red-400">{error || 'No se encontró'}</p></Card>
      </div>
    );
  }

  const { transactions, totalCount, totalGastos, totalIngresos, monthlyBars, accounts } = data;
  const catName = (id: number | null) => {
    if (!id) return null;
    const c = categories.find(c => c.id === id);
    return c || null;
  };
  const accName = (id: number) => accounts.find((a: any) => a.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="w-6 h-6" style={{ color: category.color }} />}
            <h1 className="text-2xl font-bold text-white tracking-tight">{category.name}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-slate-400 text-xs font-medium mb-1">Transacciones</p><p className="text-lg font-bold text-white">{totalCount}</p></Card>
        <Card className="p-4"><p className="text-slate-400 text-xs font-medium mb-1">Gastos</p><p className="text-lg font-bold text-red-400">{formatEUR(totalGastos)}</p></Card>
        <Card className="p-4"><p className="text-slate-400 text-xs font-medium mb-1">Ingresos</p><p className="text-lg font-bold text-emerald-400">{formatEUR(totalIngresos)}</p></Card>
      </div>

      {monthlyBars.length > 0 && (
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Gastos e ingresos por mes</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyBars} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} formatter={(v: any) => formatEUR(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="gastos" name="Gastos" fill="#dc2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 space-y-3">
          <h2 className="text-white font-semibold">Transacciones ({totalCount})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…"
                className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:border-blue-500 outline-none" />
            </div>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none">
              <option value="">Todos</option>
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>
        </div>
        {transactions.length === 0 ? (
          <p className="text-slate-500 text-sm p-5">Sin transacciones</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left border-b border-slate-800">
                    <th className="px-5 py-2 font-medium">Fecha</th>
                    <th className="px-5 py-2 font-medium">Tipo</th>
                    <th className="px-5 py-2 font-medium">Nota</th>
                    <th className="px-5 py-2 font-medium">Cuenta</th>
                    <th className="px-5 py-2 font-medium">Categoría</th>
                    <th className="px-5 py-2 font-medium text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t: Transaction) => {
                    const isExpense = t.type === 'gasto' || (t.type === 'transferencia' && t.amount < 0);
                    const color = isExpense ? 'text-red-400' : 'text-emerald-400';
                    return (
                      <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-2.5 text-slate-300">{formatDate(t.date)}</td>
                        <td className="px-5 py-2.5"><TxBadge type={t.type} /></td>
                        <td className="px-5 py-2.5 text-slate-400">{t.note || '—'}</td>
                        <td className="px-5 py-2.5 text-slate-400">{accName(t.account_id)}</td>
                        <td className="px-5 py-2.5"><CategoryBadge category={catName(t.category_id)} size="xs" /></td>
                        <td className={`px-5 py-2.5 text-right font-medium ${color}`}>{formatEUR(Math.abs(t.amount), { sign: true })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalCount > 20 && !showAll && (
              <button onClick={() => setShowAll(true)} className="w-full py-3 text-blue-400 hover:text-blue-300 text-sm transition-colors border-t border-slate-800">
                Ver más ({totalCount - 20} restantes)
              </button>
            )}
          </>
        )}
      </Card>
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

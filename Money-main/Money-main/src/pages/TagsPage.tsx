import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { setTagNavListener } from '@/lib/tagNav';
import type { Tag, Transaction, Account, Category } from '@/types';
import { Card } from '@/components/Card';
import { CategorySelector, CategoryBadge } from '@/components/CategorySelector';
import { TagChips, TagSelector } from '@/components/TagSelector';
import { formatEUR, formatDate, formatAxisEUR, CHART_COLORS } from '@/lib/format';
import { Plus, Trash2, Tag as TagIcon, ArrowLeft, Edit3, Search, X, Check, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid,
} from 'recharts';

export function TagsPage() {
  const [tags, setTags] = useState<(Tag & { txCount: number; totalGastos: number; totalIngresos: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Tag | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  const load = () => {
    api.getTags()
      .then(setTags)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setTagNavListener((tagName: string) => {
      const found = tags.find(t => t.name === tagName);
      if (found) setSelectedTag(found);
    });
    return () => setTagNavListener(null);
  }, [tags]);

  if (selectedTag) {
    return <TagDetail tag={selectedTag} onBack={() => setSelectedTag(null)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tags</h1>
          <p className="text-slate-400 text-sm mt-1">Etiqueta tus transacciones</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Tag
        </button>
      </div>

      {error && <Card className="p-4"><p className="text-red-400 text-sm">{error}</p></Card>}

      {tags.length === 0 ? (
        <Card className="p-12 text-center"><p className="text-slate-500">No tienes tags. Crea uno para empezar.</p></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map(tag => (
            <Card key={tag.id} className="p-5 hover:border-slate-700 transition-colors cursor-pointer" >
              <div className="flex items-center justify-between mb-3" onClick={() => setSelectedTag(tag)}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: tag.color }} />
                  <span className="text-white font-medium">{tag.name}</span>
                </div>
                <span className="text-slate-500 text-xs">{tag.txCount} tx</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm" onClick={() => setSelectedTag(tag)}>
                <div>
                  <p className="text-slate-500 text-xs">Gastos</p>
                  <p className="text-red-400 font-medium">{formatEUR(tag.totalGastos, { compact: true })}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Ingresos</p>
                  <p className="text-emerald-400 font-medium">{formatEUR(tag.totalIngresos, { compact: true })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={(e) => { e.stopPropagation(); setEditingTag(tag); }} className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(tag); }} className="flex items-center gap-1 text-slate-500 hover:text-red-400 text-xs transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Borrar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAdd && <TagModal onClose={() => { setShowAdd(false); load(); }} />}
      {editingTag && <TagModal tag={editingTag} onClose={() => { setEditingTag(null); load(); }} />}
      {deleteConfirm && <DeleteConfirm tag={deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={async () => { await api.deleteTag(deleteConfirm.id); setDeleteConfirm(null); load(); }} />}
    </div>
  );
}

// ===================== TAG DETAIL =====================

function TagDetail({ tag, onBack }: { tag: Tag; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [tipo, setTipo] = useState('');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);

  const loadDetail = () => {
    setLoading(true);
    api.getTagTransactions(tag.id, {
      desde, hasta, cuenta, tipo, q: search,
      limit: showAll ? 10000 : 20,
    })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([api.getAccounts(), api.getCategories(), api.getTags()])
      .then(([a, c, t]) => { setAccounts(a); setCategories(c); setAllTags(t); });
  }, []);

  useEffect(() => { loadDetail(); }, [tag.id, desde, hasta, cuenta, tipo, search, showAll]);

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
        <Card className="p-6"><p className="text-red-400">{error || 'Error'}</p></Card>
      </div>
    );
  }

  const { transactions, totalCount, totalGastos, totalIngresos, monthlyBars, accounts: accList } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton onBack={onBack} />
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: tag.color }} />
          <h1 className="text-2xl font-bold text-white tracking-tight">{tag.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-slate-400 text-xs mb-1">Transacciones</p><p className="text-lg font-bold text-white">{totalCount}</p></Card>
        <Card className="p-4"><p className="text-slate-400 text-xs mb-1">Gastos</p><p className="text-lg font-bold text-red-400">{formatEUR(totalGastos, { compact: true })}</p></Card>
        <Card className="p-4"><p className="text-slate-400 text-xs mb-1">Ingresos</p><p className="text-lg font-bold text-emerald-400">{formatEUR(totalIngresos, { compact: true })}</p></Card>
      </div>

      {monthlyBars.length > 0 && (
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Ingresos vs gastos por mes</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyBars} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} formatter={(v: any) => formatEUR(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 space-y-3">
          <h2 className="text-white font-semibold">Transacciones ({totalCount})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…"
                className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:border-blue-500 outline-none" />
            </div>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-slate-800 text-slate-200 text-sm rounded-lg px-2 py-2 border border-slate-700 focus:border-blue-500 outline-none" />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-slate-800 text-slate-200 text-sm rounded-lg px-2 py-2 border border-slate-700 focus:border-blue-500 outline-none" />
            <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none">
              <option value="">Cuenta</option>
              {accList.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="bg-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none">
              <option value="">Tipo</option>
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
              <option value="transferencia">Transferencia</option>
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
                    <th className="px-5 py-2 font-medium">Tags</th>
                    <th className="px-5 py-2 font-medium text-right">Importe</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t: Transaction) => {
                    const isExpense = t.type === 'gasto' || (t.type === 'transferencia' && t.amount < 0);
                    const color = isExpense ? 'text-red-400' : 'text-emerald-400';
                    const acc = accList.find((a: any) => a.id === t.account_id);
                    return (
                      <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-2.5 text-slate-300">{formatDate(t.date)}</td>
                        <td className="px-5 py-2.5"><TxBadge type={t.type} /></td>
                        <td className="px-5 py-2.5 text-slate-400">{t.note || '—'}</td>
                        <td className="px-5 py-2.5 text-slate-400">{acc?.name || '—'}</td>
                        <td className="px-5 py-2.5"><TagChips tags={t.tags} allTags={allTags} size="xs" /></td>
                        <td className={`px-5 py-2.5 text-right font-medium ${color}`}>{formatEUR(Math.abs(t.amount), { sign: true })}</td>
                        <td className="px-5 py-2.5 text-right">
                          <button onClick={() => setEditingTx(t)} className="text-slate-600 hover:text-blue-400 transition-colors">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
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

      {editingTx && (
        <EditTransactionModal
          tx={editingTx}
          accounts={accounts}
          categories={categories}
          allTags={allTags}
          onClose={() => { setEditingTx(null); loadDetail(); }}
        />
      )}
    </div>
  );
}

// ===================== MODALS =====================

function TagModal({ tag, onClose }: { tag?: Tag; onClose: () => void }) {
  const [name, setName] = useState(tag?.name || '');
  const [color, setColor] = useState(tag?.color || '#6b7280');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (tag) {
        await api.updateTag(tag.id, { name, color });
      } else {
        await api.createTag({ name, color });
      }
      onClose();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">{tag ? 'Editar tag' : 'Nuevo tag'}</h2>
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Color</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer" /></div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({ tag, onClose, onConfirm }: { tag: Tag; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <h2 className="text-white font-semibold text-lg">Borrar tag</h2>
        </div>
        <p className="text-slate-300 text-sm">
          ¿Seguro que quieres borrar el tag <span className="text-white font-medium">{tag.name}</span>?
          Se quitará de todas las transacciones, pero las transacciones no se eliminan.
        </p>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2.5 rounded-lg transition-colors">Borrar</button>
        </div>
      </div>
    </div>
  );
}

function EditTransactionModal({ tx, accounts, categories, allTags, onClose }: {
  tx: Transaction; accounts: Account[]; categories: Category[]; allTags: Tag[]; onClose: () => void;
}) {
  const [type, setType] = useState(tx.type);
  const [date, setDate] = useState(tx.date);
  const [amount, setAmount] = useState(String(Math.abs(tx.amount)));
  const [accountId, setAccountId] = useState(String(tx.account_id));
  const [note, setNote] = useState(tx.note || '');
  const [categoryId, setCategoryId] = useState(tx.category_id ? String(tx.category_id) : '');
  const [selectedTags, setSelectedTags] = useState(tx.tags ? tx.tags.split(',').map(s => s.trim()).filter(Boolean) : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tagsRefreshKey, setTagsRefreshKey] = useState(0);

  const save = async () => {
    if (!amount || !accountId) { setError('Faltan datos'); return; }
    setSaving(true);
    try {
      await api.updateTransaction(tx.id, {
        type, date, amount: parseFloat(amount),
        account_id: parseInt(accountId),
        note: note || null,
        category_id: categoryId ? parseInt(categoryId) : null,
        tags: selectedTags.length > 0 ? selectedTags.join(',') : null,
      });
      onClose();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';
  const parentCategories = categories.filter(c => c.parent_id === null);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">Editar transacción</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="gasto">Gasto</option><option value="ingreso">Ingreso</option><option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
        </div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Importe (€)</label><input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Cuenta</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {type !== 'transferencia' && categories.length > 0 && (
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Categoría (opcional)</label>
            <CategorySelector
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              allowEmpty
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Tags</label>
          <TagSelector
            key={tagsRefreshKey}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
            allTags={allTags}
            onTagsRefresh={() => setTagsRefreshKey(k => k + 1)}
          />
        </div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Nota</label><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
      <ArrowLeft className="w-4 h-4" /> Volver
    </button>
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

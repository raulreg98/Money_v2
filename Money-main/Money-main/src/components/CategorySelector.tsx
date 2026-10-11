import { useState, useRef, useEffect } from 'react';
import { Search, ChevronRight, Plus, Folder, FolderOpen } from 'lucide-react';
import type { Category } from '@/types';
import { getIcon, suggestIcon } from '@/lib/categoryIcons';
import { api } from '@/lib/api';
import { formatEUR } from '@/lib/format';

interface Props {
  categories: Category[];
  value: string;
  onChange: (val: string) => void;
  allowEmpty?: boolean;
  onCreateCategory?: (name: string, parentId: number | null) => Promise<void>;
}

export function CategorySelector({ categories, value, onChange, allowEmpty, onCreateCategory }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const parents = categories.filter(c => c.parent_id === null);
  const childrenOf = (pid: number) => categories.filter(c => c.parent_id === pid);

  const selectedCat = value ? categories.find(c => c.id === parseInt(value)) : null;
  const parentOfSelected = selectedCat?.parent_id ? categories.find(c => c.id === selectedCat.parent_id) : null;
  const selectedColor = selectedCat?.color || parentOfSelected?.color || '#3b82f6';
  const SelectedIcon = getIcon(selectedCat?.icon) || getIcon(suggestIcon(selectedCat?.name || ''));

  const filtered = (cats: Category[]) => {
    if (!search) return cats;
    return cats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      if (onCreateCategory) {
        await onCreateCategory(newName.trim(), null);
      } else {
        await api.createCategory({ name: newName.trim(), color: '#6b7280', icon: suggestIcon(newName.trim()), parent_id: null });
      }
      setNewName('');
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={inputCls + ' flex items-center gap-2 text-left cursor-pointer'}
      >
        {selectedCat ? (
          <div className="flex items-center gap-2 truncate">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selectedColor }} />
            {SelectedIcon && <SelectedIcon className="w-4 h-4 shrink-0" style={{ color: selectedColor }} />}
            <span className="text-slate-200 truncate">{selectedCat.name}</span>
          </div>
        ) : (
          <span className="text-slate-500">{allowEmpty ? 'Sin categoría' : 'Seleccionar…'}</span>
        )}
        <ChevronRight className="w-4 h-4 ml-auto text-slate-500" />
      </button>

      {/* Modal flotante secundario por encima */}
      {open && (
        <div
          className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal secundario */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">Seleccionar Categoría</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Lista de categorías */}
            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {parents.map((parent) => {
                const Icon = getIcon(parent.icon) || getIcon(suggestIcon(parent.name));
                const subs = filtered(childrenOf(parent.id));
                const parentColor = parent.color || '#3b82f6';
                return (
                  <div key={parent.id} className="bg-slate-800/40 rounded-xl p-2 border border-slate-800 space-y-1">
                    <button
                      type="button"
                      onClick={() => { onChange(String(parent.id)); setOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white font-semibold hover:bg-slate-800 transition-colors"
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: parentColor }} />
                      {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: parentColor }} />}
                      <span className="truncate">{parent.name}</span>
                    </button>
                    {subs.map((sub) => {
                      const SubIcon = getIcon(sub.icon) || getIcon(suggestIcon(sub.name));
                      const subColor = sub.color || parentColor;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => { onChange(String(sub.id)); setOpen(false); }}
                          className="w-full flex items-center gap-2.5 pl-7 pr-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: subColor }} />
                          {SubIcon && <SubIcon className="w-3.5 h-3.5 shrink-0" style={{ color: subColor }} />}
                          <span className="truncate">{sub.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {search && filtered(parents).length === 0 && (
                <div className="px-3 py-6 text-center text-slate-500 text-sm">
                  No se encontró ninguna categoría con "{search}"
                </div>
              )}
            </div>

            {/* Crear categoría rápido */}
            <div className="border-t border-slate-800 p-3 bg-slate-950/40">
              {showCreate ? (
                <div className="flex items-center gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre de la nueva categoría…"
                    className="flex-1 bg-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                  />
                  <button onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm px-4 py-2 rounded-xl transition-colors font-medium">
                    {creating ? '…' : 'Crear'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" /> Crear nueva categoría
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryBadge({ category, categories, size = 'sm' }: { category: Category | null | undefined; categories?: Category[]; size?: 'xs' | 'sm' }) {
  if (!category) return <span className="text-slate-600 text-sm">—</span>;
  const Icon = getIcon(category.icon) || getIcon(suggestIcon(category.name));
  const cls = size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const parentCat = (category.parent_id && categories) ? categories.find(c => c.id === category.parent_id) : null;
  const color = category.color || parentCat?.color || '#3b82f6';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border"
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}40`,
      }}
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      {Icon && <Icon className={`${cls} shrink-0`} style={{ color }} />}
      <span className="text-sm font-medium" style={{ color }}>{category.name}</span>
    </span>
  );
}

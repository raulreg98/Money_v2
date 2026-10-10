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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={inputCls + ' flex items-center gap-2 text-left'}
      >
        {selectedCat ? (
          <div className="flex items-center gap-2 truncate">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selectedCat.color || '#3b82f6' }} />
            {SelectedIcon && <SelectedIcon className="w-4 h-4 shrink-0" style={{ color: selectedCat.color || '#3b82f6' }} />}
            <span className="text-slate-200 truncate">{selectedCat.name}</span>
          </div>
        ) : (
          <span className="text-slate-500">{allowEmpty ? 'Sin categoría' : 'Seleccionar…'}</span>
        )}
        <ChevronRight className="w-4 h-4 ml-auto text-slate-500 rotate-90" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar categoría…"
                className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg pl-8 pr-3 py-1.5 border border-slate-700 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {allowEmpty && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors"
              >
                — Sin categoría —
              </button>
            )}
            {filtered(parents).map((parent) => {
              const Icon = getIcon(parent.icon) || getIcon(suggestIcon(parent.name));
              const subs = filtered(childrenOf(parent.id));
              const parentColor = parent.color || '#3b82f6';
              return (
                <div key={parent.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(String(parent.id)); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: parentColor }} />
                    {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: parentColor }} />}
                    <span className="truncate font-medium">{parent.name}</span>
                  </button>
                  {subs.map((sub) => {
                    const SubIcon = getIcon(sub.icon) || getIcon(suggestIcon(sub.name));
                    const subColor = sub.color || parentColor;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => { onChange(String(sub.id)); setOpen(false); }}
                        className="w-full flex items-center gap-2 pl-6 pr-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 transition-colors"
                      >
                        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: subColor }} />
                        {SubIcon && <SubIcon className="w-3.5 h-3.5 shrink-0" style={{ color: subColor }} />}
                        <span className="truncate">{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {search && filtered(parents).length === 0 && (
              <div className="px-3 py-4 text-center text-slate-500 text-sm">
                No se encontró "{search}"
              </div>
            )}
          </div>
          <div className="border-t border-slate-800 p-2">
            {showCreate ? (
              <div className="flex items-center gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre de la nueva categoría…"
                  className="flex-1 bg-slate-800 text-slate-200 text-sm rounded-lg px-2.5 py-1.5 border border-slate-700 focus:border-blue-500 outline-none"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                />
                <button onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                  {creating ? '…' : 'Crear'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Crear categoría
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryBadge({ category, size = 'sm' }: { category: Category | null | undefined; size?: 'xs' | 'sm' }) {
  if (!category) return <span className="text-slate-600 text-sm">—</span>;
  const Icon = getIcon(category.icon) || getIcon(suggestIcon(category.name));
  const cls = size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const parent = category.parent_id ? null : category;
  const color = category.color || '#6b7280';
  return (
    <span className="inline-flex items-center gap-1.5">
      {Icon && <Icon className={`${cls} shrink-0`} style={{ color }} />}
      <span className="text-slate-300 text-sm">{category.name}</span>
    </span>
  );
}

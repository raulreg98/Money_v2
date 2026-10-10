import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Search, X, Plus, Check } from 'lucide-react';

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  allTags: { id: number; name: string; color: string }[];
  onTagsRefresh?: () => void;
}

export function TagSelector({ selectedTags, onChange, allTags, onTagsRefresh }: TagSelectorProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [mostUsed, setMostUsed] = useState<{ name: string; color: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showDropdown) {
      api.getMostUsedTags().then(setMostUsed).catch(() => {});
    }
  }, [showDropdown]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = allTags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) &&
    !selectedTags.includes(t.name)
  );

  const exactMatch = allTags.find(t => t.name.toLowerCase() === search.toLowerCase().trim());
  const canCreate = search.trim().length > 0 && !exactMatch;

  const addTag = (name: string) => {
    if (!selectedTags.includes(name)) {
      onChange([...selectedTags, name]);
    }
    setSearch('');
  };

  const removeTag = (name: string) => {
    onChange(selectedTags.filter(t => t !== name));
  };

  const createAndAdd = async () => {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api.createTag({ name, color: '#6b7280' });
      onTagsRefresh?.();
      addTag(name);
    } catch {
      addTag(name);
    } finally {
      setCreating(false);
    }
  };

  const tagColor = (name: string) => allTags.find(t => t.name === name)?.color || '#6b7280';

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] bg-slate-800 rounded-lg border border-slate-700 px-2 py-1.5 focus-within:border-blue-500 transition-colors">
        {selectedTags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            style={{ background: `${tagColor(tag)}20`, color: tagColor(tag), border: `1px solid ${tagColor(tag)}40` }}
          >
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          placeholder={selectedTags.length === 0 ? 'Tags (opcional)…' : 'Añadir…'}
          className="flex-1 min-w-[80px] bg-transparent text-slate-200 text-sm outline-none placeholder:text-slate-500"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {mostUsed.length > 0 && search.length === 0 && (
            <div className="p-2 border-b border-slate-800">
              <p className="text-slate-500 text-xs px-2 pb-1.5">Más usados</p>
              <div className="flex flex-wrap gap-1.5">
                {mostUsed.map(t => (
                  <button
                    key={t.name}
                    onClick={() => addTag(t.name)}
                    disabled={selectedTags.includes(t.name)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium disabled:opacity-40 hover:brightness-125 transition-filter"
                    style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}
                  >
                    {selectedTags.includes(t.name) && <Check className="w-3 h-3" />}
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {search.length > 0 && canCreate && (
            <button
              onClick={createAndAdd}
              disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-slate-800 transition-colors border-b border-slate-800"
            >
              <Plus className="w-4 h-4" /> Crear '{search.trim()}'
            </button>
          )}

          {filtered.length > 0 ? (
            filtered.slice(0, 20).map(t => (
              <button
                key={t.id}
                onClick={() => addTag(t.name)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                {t.name}
              </button>
            ))
          ) : search.length > 0 && !canCreate ? (
            <p className="px-3 py-2 text-sm text-slate-500">Ya añadido o sin coincidencias</p>
          ) : search.length === 0 && mostUsed.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Escribe para buscar o crear un tag</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface TagChipsProps {
  tags: string | null;
  allTags: { id: number; name: string; color: string }[];
  onTagClick?: (tagName: string) => void;
  size?: 'sm' | 'xs';
}

export function TagChips({ tags, allTags, onTagClick, size = 'sm' }: TagChipsProps) {
  if (!tags) return null;
  const tagList = tags.split(',').map(s => s.trim()).filter(Boolean);
  if (tagList.length === 0) return null;

  const sz = size === 'xs' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5';

  return (
    <div className="flex flex-wrap gap-1">
      {tagList.map(tag => {
        const color = allTags.find(t => t.name === tag)?.color || '#6b7280';
        return (
          <span
            key={tag}
            onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(tag); } : undefined}
            className={`inline-block rounded font-medium border ${sz} ${onTagClick ? 'cursor-pointer hover:brightness-125' : ''} transition-filter`}
            style={{ background: `${color}20`, color, borderColor: `${color}40` }}
          >
            {tag}
          </span>
        );
      })}
    </div>
  );
}

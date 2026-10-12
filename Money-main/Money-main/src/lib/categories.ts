import type { Category } from '@/types';

export function matchesCategory(
  txCategoryId: number | string | null | undefined,
  selectedCategoryId: number | string | null | undefined,
  categories: Category[]
): boolean {
  if (!selectedCategoryId) return true;
  if (!txCategoryId) return false;

  const txCatIdNum = typeof txCategoryId === 'string' ? parseInt(txCategoryId, 10) : txCategoryId;
  const selCatIdNum = typeof selectedCategoryId === 'string' ? parseInt(selectedCategoryId, 10) : selectedCategoryId;

  if (isNaN(selCatIdNum)) return true;
  if (isNaN(txCatIdNum)) return false;

  if (txCatIdNum === selCatIdNum) return true;

  // Find selected category
  const selectedCat = categories.find(c => c.id === selCatIdNum);
  if (!selectedCat) return false;

  // Find transaction category
  const txCat = categories.find(c => c.id === txCatIdNum);
  if (!txCat) return false;

  // If transaction category has a parent, check if parent matches selected category
  if (txCat.parent_id === selCatIdNum) return true;

  return false;
}

export function resolveCategory(
  categoryId: number | string | null | undefined,
  categories: Category[]
): { id: number | null; name: string; color: string; icon: string | null; parent_id: number | null } {
  if (!categoryId) {
    return { id: null, name: 'Sin categoría', color: '#6b7280', icon: 'folder', parent_id: null };
  }

  const catIdNum = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
  if (isNaN(catIdNum)) {
    return { id: null, name: 'Sin categoría', color: '#6b7280', icon: 'folder', parent_id: null };
  }

  const catMap = new Map<number, Category>(categories.map(c => [c.id, c]));
  const cat = catMap.get(catIdNum);

  if (!cat) {
    return { id: catIdNum, name: 'Sin categoría', color: '#6b7280', icon: 'folder', parent_id: null };
  }

  let color = cat.color;
  if ((!color || color === '#6b7280') && cat.parent_id) {
    const parent = catMap.get(cat.parent_id);
    if (parent?.color) color = parent.color;
  }

  return {
    id: cat.id,
    name: cat.name,
    color: color || '#6b7280',
    icon: cat.icon || 'folder',
    parent_id: cat.parent_id,
  };
}

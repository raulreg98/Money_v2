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

  // Si categories viene vacío ([]), usar las categorías globales de window
  const globalCats = typeof window !== 'undefined' ? (window as any).__GLOBAL_CATEGORIES__ || [] : [];
  const catList = categories && categories.length > 0 ? categories : globalCats;

  for (const cat of catList) {
    if (String(cat.id) === String(categoryId)) {
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color || '#6b7280',
        icon: cat.icon || null,
        parent_id: cat.parent_id || null,
      };
    }
    if ((cat as any).subcategories && Array.isArray((cat as any).subcategories)) {
      const sub = (cat as any).subcategories.find((s: any) => String(s.id) === String(categoryId));
      if (sub) {
        return {
          id: sub.id,
          name: sub.name,
          color: sub.color || cat.color || '#6b7280',
          icon: sub.icon || cat.icon || null,
          parent_id: cat.id,
        };
      }
    }
  }

  return { id: categoryId as any, name: 'Sin categoría', color: '#6b7280', icon: 'folder', parent_id: null };
}

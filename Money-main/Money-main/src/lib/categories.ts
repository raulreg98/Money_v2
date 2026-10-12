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

let cachedCategories: Category[] = [];

export function setCachedCategories(cats: Category[]) {
  if (cats && cats.length > 0) {
    cachedCategories = cats;
  }
}

export function resolveCategory(
  categoryId: number | string | null | undefined,
  categories?: Category[]
): { id: number | null; name: string; color: string; icon: string | null; parent_id: number | null } {
  if (!categoryId) {
    return { id: null, name: 'Sin categoría', color: '#6b7280', icon: null, parent_id: null };
  }

  const catList = (categories && categories.length > 0) ? categories : cachedCategories;

  for (const cat of catList) {
    if (String(cat.id) === String(categoryId)) {
      const parent = cat.parent_id ? catList.find(p => p.id === cat.parent_id) : null;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color || parent?.color || '#6b7280',
        icon: cat.icon || parent?.icon || null,
        parent_id: cat.parent_id || null,
      };
    }
  }

  return { id: Number(categoryId) || null, name: 'Sin categoría', color: '#6b7280', icon: null, parent_id: null };
}

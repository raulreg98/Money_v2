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

import type { Category, Transaction } from '@/types';
import { CHART_COLORS } from '@/lib/format';
import { resolveCategory } from '@/lib/categories';

export interface CategoryChartItem {
  name: string;
  value: number;
  color: string;
  icon?: string | null;
}

export function getCategoryColor(category: Category | null | undefined, categories: Category[] = []): string {
  if (!category) return '#6b7280';
  if (category.color && category.color.trim() !== '') return category.color;

  // Try parent color
  if (category.parent_id) {
    const parent = categories.find(c => c.id === category.parent_id);
    if (parent?.color && parent.color.trim() !== '') return parent.color;
  }

  // Fallback based on ID or index
  const index = Math.abs(category.id || 0) % CHART_COLORS.length;
  return CHART_COLORS[index] || '#3b82f6';
}

export function prepareCategoryExpensesChartData(
  transactions: Transaction[],
  categories: Category[],
  accountId?: number | null,
  dateRange?: { desde?: string; hasta?: string } | null
): CategoryChartItem[] {
  const map = new Map<string, CategoryChartItem>();
  const catMap = new Map<number, Category>(categories.map(c => [c.id, c]));

  const filteredExpenses = transactions.filter(t => {
    if (t.type !== 'gasto') return false;
    if (accountId && t.account_id !== accountId && t.to_account_id !== accountId) return false;
    if (dateRange?.desde && t.date < dateRange.desde) return false;
    if (dateRange?.hasta && t.date > dateRange.hasta) return false;
    return true;
  });

  for (const t of filteredExpenses) {
    const cat = t.category_id ? catMap.get(t.category_id) : null;
    let parentCat = cat;
    if (cat && cat.parent_id) {
      parentCat = catMap.get(cat.parent_id) || cat;
    }
    const resolved = resolveCategory(parentCat?.id || cat?.id, categories);
    const name = resolved.name;
    const color = resolved.color;
    const icon = parentCat?.icon || cat?.icon || null;

    const existing = map.get(name) || { name, value: 0, color, icon };
    existing.value += Math.abs(t.amount);
    map.set(name, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

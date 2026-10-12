import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Category } from '@/types';
import { api } from '@/lib/api';
import { resolveCategory as resolveCategoryLib } from '@/lib/categories';

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  resolveCategory: (categoryId: number | string | null | undefined) => ReturnType<typeof resolveCategoryLib>;
  refreshCategories: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType>({
  categories: [],
  loading: true,
  resolveCategory: (id) => resolveCategoryLib(id, []),
  refreshCategories: async () => {},
});

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCats = async () => {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const resolve = useCallback((categoryId: number | string | null | undefined) => {
    return resolveCategoryLib(categoryId, categories);
  }, [categories]);

  return (
    <CategoryContext.Provider value={{ categories, loading, resolveCategory: resolve, refreshCategories: fetchCats }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategoryContext = () => useContext(CategoryContext);

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: `Error ${resp.status}` }));
    throw new Error(data.error || `Error ${resp.status}`);
  }
  const text = await resp.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Respuesta inválida del servidor');
  }
}

export const api = {
  // Products
  getProducts: () => request<any[]>('/products'),
  createProduct: (data: any) => request<{ id: number }>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: number, data: any) => request<{ ok: boolean }>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: number) => request<any>(`/products/${id}`, { method: 'DELETE' }),
  deleteProductConfirm: (id: number) => request<{ ok: boolean }>(`/products/${id}?confirm=true`, { method: 'DELETE' }),
  archiveProduct: (id: number, archived: boolean) => request<{ ok: boolean }>(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ archived: archived ? 1 : 0 }) }),

  // Movements
  getMovements: (productId: number) => request<any[]>(`/movements/${productId}`),
  createMovement: (data: any) => request<{ id: number }>('/movements', { method: 'POST', body: JSON.stringify(data) }),
  updateMovement: (id: number, data: any) => request<{ ok: boolean }>(`/movements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMovement: (id: number) => request<{ ok: boolean }>(`/movements/${id}`, { method: 'DELETE' }),

  // Prices
  getPriceHistory: (productId: number, limit = 365) => request<any[]>(`/prices/${productId}?limit=${limit}`),
  savePrice: (productId: number, data: any) => request<{ ok: boolean }>(`/prices/${productId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateAllPrices: () => request<any>('/prices/update-all', { method: 'POST' }),
  testPriceSources: (symbol: string) => request<any[]>('/prices/test-sources', { method: 'POST', body: JSON.stringify({ symbol }) }),
  saveApiKey: (provider: string, key: string) => request<{ ok: boolean }>('/prices/save-api-key', { method: 'POST', body: JSON.stringify({ provider, key }) }),
  getApiKeys: () => request<Record<string, boolean>>('/prices/api-keys'),
  deletePrice: (priceId: number) => request<{ ok: boolean }>(`/prices/${priceId}`, { method: 'DELETE' }),
  updateProductPrice: (productId: number) => request<any>(`/prices/${productId}/update`, { method: 'POST' }),
  downloadHistory: (productId: number) => request<any>(`/prices/${productId}/history`, { method: 'POST' }),
  importCsvHistory: (productId: number, csv: string) => request<any>(`/prices/${productId}/import-csv`, { method: 'POST', body: JSON.stringify(csv) }),

  // Inversiones series
  getInvestmentSeries: (productos: number[], desde?: string, hasta?: string) =>
    request<any>(`/inversiones/series?productos=${productos.join(',')}${desde ? `&desde=${desde}` : ''}${hasta ? `&hasta=${hasta}` : ''}`),

  // Valuations
  getValuations: (productId: number) => request<any[]>(`/valuations/${productId}`),
  upsertValuation: (data: any) => request<{ ok: boolean }>('/valuations', { method: 'POST', body: JSON.stringify(data) }),
  bulkValuations: (data: any) => request<{ ok: boolean }>('/valuations/bulk', { method: 'POST', body: JSON.stringify(data) }),
  deleteValuation: (id: number) => request<{ ok: boolean }>(`/valuations/${id}`, { method: 'DELETE' }),

  // Search
  search: (q: string) => request<any[]>(`/search?q=${encodeURIComponent(q)}`),

  // Exchange rates
  getExchangeRates: () => request<Record<string, number>>('/exchange-rates'),
  refreshRates: () => request<any>('/exchange-rates/refresh', { method: 'POST' }),

  // Accounts
  getAccounts: () => request<any[]>('/accounts'),
  createAccount: (data: any) => request<{ id: number }>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: number, data: any) => request<{ ok: boolean }>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id: number) => request<{ ok: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),
  archiveAccount: (id: number, archived: boolean) => request<{ ok: boolean }>(`/accounts/${id}/archive`, { method: 'POST', body: JSON.stringify({ archived }) }),
  getAccountSummary: (id: number, params: Record<string, string | number>) => {
    const qs = Object.entries(params).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    return request<any>(`/cuentas/${id}/resumen${qs ? `?${qs}` : ''}`);
  },

  // Transactions
  getTransactions: () => request<any[]>('/transactions'),
  createTransaction: (data: any) => request<{ id: number }>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: number, data: any) => request<{ ok: boolean }>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id: number) => request<{ ok: boolean }>(`/transactions/${id}`, { method: 'DELETE' }),

  // Tags
  getTags: () => request<any[]>('/tags'),
  createTag: (data: any) => request<{ id: number }>('/tags', { method: 'POST', body: JSON.stringify(data) }),
  updateTag: (id: number, data: any) => request<{ ok: boolean }>(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTag: (id: number) => request<{ ok: boolean }>(`/tags/${id}`, { method: 'DELETE' }),
  getTagTransactions: (id: number, params: Record<string, string | number>) => {
    const qs = Object.entries(params).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    return request<any>(`/tags/${id}/transacciones${qs ? `?${qs}` : ''}`);
  },
  getMostUsedTags: () => request<any[]>('/tags/most-used'),
  bulkTagTransactions: (ids: number[], action: 'add' | 'remove', tag: string) =>
    request<{ ok: boolean }>('/transactions/bulk-tag', { method: 'POST', body: JSON.stringify({ ids, action, tag }) }),

  // Widgets
  getWidgets: () => request<any[]>('/widgets'),
  createWidget: (data: any) => request<{ id: number }>('/widgets', { method: 'POST', body: JSON.stringify(data) }),
  updateWidget: (id: number, data: any) => request<{ ok: boolean }>(`/widgets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWidget: (id: number) => request<{ ok: boolean }>(`/widgets/${id}`, { method: 'DELETE' }),
  reorderWidgets: (ids: number[]) => request<{ ok: boolean }>('/widgets/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  duplicateWidget: (id: number) => request<{ id: number }>(`/widgets/${id}/duplicate`, { method: 'POST' }),
  getGraficaDatos: (config: any) => request<any>('/graficas/datos', { method: 'POST', body: JSON.stringify(config) }),
  restoreDefaultWidgets: () => request<any>('/graficas/defaults', { method: 'POST' }),

  // Portfolio
  getPortfolioSummary: (longTermOnly = false) => request<any>(`/portfolio/summary${longTermOnly ? '?long_term=true' : ''}`),
  getProductDetail: (id: number) => request<any>(`/portfolio/product/${id}`),
  getComparator: () => request<any[]>('/portfolio/comparator'),
  getDashboard: () => request<any>('/dashboard'),

  // Import
  importCsv: (data: any) => request<any>('/import/csv', { method: 'POST', body: JSON.stringify(data) }),
  importMyInvestor: (data: any) => request<any>('/import/myinvestor', { method: 'POST', body: JSON.stringify(data) }),

  // Backups
  getBackups: () => request<any[]>('/backups'),
  createBackup: (label?: string) => request<any>('/backups/create', { method: 'POST', body: JSON.stringify({ label }) }),
  restoreBackup: (filename: string) => request<any>('/backups/restore', { method: 'POST', body: JSON.stringify({ filename }) }),
  downloadBackup: () => `${API_BASE}/backups/download`,
  restoreJson: (data: ArrayBuffer) => request<any>('/backups/restore-json', { method: 'POST', body: data, headers: { 'Content-Type': 'application/octet-stream' } }),
  resetDatabase: () => request<any>('/reset', { method: 'POST' }),

  // MoneyMatter import
  parseMoneyMatterZip: (file: File) => {
    return new Promise<any>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      fetch(`${API_BASE}/import/moneymatter/parse`, { method: 'POST', body: file })
        .then(async resp => {
          if (!resp.ok) {
            const data = await resp.json().catch(() => ({ error: 'Error desconocido' }));
            reject(new Error(data.error || 'Error desconocido'));
          } else {
            resolve(resp.json());
          }
        })
        .catch(reject);
    });
  },
  executeMoneyMatterImport: (preview: any) => request<any>('/import/moneymatter/execute', { method: 'POST', body: JSON.stringify(preview) }),

  // Settings
  getSettings: () => request<Record<string, string>>('/settings'),
  setSetting: (key: string, value: string) => request<any>('/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }),

  // Categories
  getCategories: () => request<any[]>('/categories'),
  reorderCategories: (ids: number[]) => request<{ ok: boolean }>('/categories/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  createCategory: (data: any) => request<{ id: number }>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: number, data: any) => request<{ ok: boolean }>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: number, reassignTo?: number) => request<{ ok: boolean }>(`/categories/${id}${reassignTo !== undefined ? `?reassign_to=${reassignTo}` : ''}`, { method: 'DELETE' }),
  getCategoryStats: (id: number) => request<{ txCount: number; totalGastos: number; totalIngresos: number }>(`/categories/${id}/stats`),
  getCategoryTransactions: (id: number, params?: Record<string, string | number>) => {
    const qs = params ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
    return request<any>(`/categories/${id}/transacciones${qs}`);
  },
};

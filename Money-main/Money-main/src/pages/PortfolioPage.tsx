import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { Product, ProductDetailFull } from '@/types';
import { Card } from '@/components/Card';
import { ProductEvolutionChart } from '@/components/ProductEvolutionChart';
import { formatEUR, formatPercent, formatDate, formatAxisEUR, formatAxisDate, formatUnits, PRODUCT_TYPES, CHART_COLORS } from '@/lib/format';
import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, Download, AlertTriangle, Pencil, Archive } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell, CartesianGrid, AreaChart, Area } from 'recharts';

export function PortfolioPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId !== null) {
    return <ProductDetail productId={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <ProductList onSelect={setSelectedId} />;
}

function ProductList({ onSelect }: { onSelect: (id: number) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ productDetails: any[] } | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [sortField, setSortField] = useState<string>('value');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [txFilterProduct, setTxFilterProduct] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [priceMessage, setPriceMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [movSortField, setMovSortField] = useState<string>('date');
  const [movSortAsc, setMovSortAsc] = useState<boolean>(false);

  const loadData = () => {
    Promise.all([api.getProducts(), api.getPortfolioSummary(), api.getAccounts()])
      .then(async ([prods, summ, accs]) => {
        setProducts(prods);
        setSummary(summ);
        setAccounts(accs);
        // Load movements for movements table
        const movPromises = prods.map(p => api.getMovements(p.id).catch(() => []));
        const movResults = await Promise.all(movPromises);
        const flat = movResults.flat();
        setAllMovements(flat);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => loadData(), []);

  const updateAllPrices = async () => {
    setUpdatingPrices(true);
    setPriceMessage('');
    try {
      const result = await api.updateAllPrices();
      const ok = result.results?.filter((r: any) => r.success).length || 0;
      const fail = result.results?.filter((r: any) => !r.success).length || 0;
      const errors = result.errors?.slice(0, 5) || [];
      setPriceMessage(`Actualizado: ${ok} correctos, ${fail} fallidos${errors.length ? '. Errores: ' + errors.join('; ') : ''}`);
      loadData();
    } catch (err: any) {
      setPriceMessage(`Error: ${err.message}`);
    } finally {
      setUpdatingPrices(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const filteredProducts = selectedAccountId
    ? products.filter(p => p.account_id === parseInt(selectedAccountId))
    : products;

  const detailMap = new Map((summary?.productDetails || []).map((d: any) => [d.id, d]));

  // Calculate top summary metrics
  let totalInvestedAcc = 0;
  let totalValueAcc = 0;
  for (const p of filteredProducts) {
    const d = detailMap.get(p.id);
    if (d) {
      totalInvestedAcc += d.invested || 0;
      totalValueAcc += d.value || 0;
    }
  }
  const totalGainAcc = totalValueAcc - totalInvestedAcc;
  const totalRetAcc = totalInvestedAcc > 0 ? (totalGainAcc / totalInvestedAcc) * 100 : 0;
  const gainColor = totalGainAcc > 0 ? 'text-emerald-400' : totalGainAcc < 0 ? 'text-red-400' : 'text-slate-400';

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const da = detailMap.get(a.id);
    const db = detailMap.get(b.id);
    let valA: any = 0;
    let valB: any = 0;

    if (sortField === 'name') { valA = a.name; valB = b.name; }
    else if (sortField === 'type') { valA = PRODUCT_TYPES[a.type] || a.type; valB = PRODUCT_TYPES[b.type] || b.type; }
    else if (sortField === 'account') { valA = accounts.find(ac => ac.id === a.account_id)?.name || ''; valB = accounts.find(ac => ac.id === b.account_id)?.name || ''; }
    else if (sortField === 'value') { valA = da?.value || 0; valB = db?.value || 0; }
    else if (sortField === 'invested') { valA = da?.invested || 0; valB = db?.invested || 0; }
    else if (sortField === 'gain') { valA = da?.gain || 0; valB = db?.gain || 0; }
    else if (sortField === 'ret') {
      valA = (da?.invested || 0) > 0 ? (da!.gain / da!.invested) : 0;
      valB = (db?.invested || 0) > 0 ? (db!.gain / db!.invested) : 0;
    }

    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const handleMovSort = (field: string) => {
    if (movSortField === field) setMovSortAsc(!movSortAsc);
    else { setMovSortField(field); setMovSortAsc(false); }
  };

  const filteredMovements = allMovements
    .filter(m => {
      const prod = products.find(p => p.id === m.product_id);
      if (!prod) return false;
      if (selectedAccountId && prod.account_id !== parseInt(selectedAccountId)) return false;
      if (txFilterProduct && prod.id !== parseInt(txFilterProduct)) return false;
      return m.type === 'compra' || m.type === 'saldo';
    })
    .sort((a, b) => {
      const prodA = products.find(p => p.id === a.product_id);
      const prodB = products.find(p => p.id === b.product_id);
      const dA = detailMap.get(a.product_id);
      const dB = detailMap.get(b.product_id);
      const unitPriceA = dA?.price || (dA?.units ? dA.value / dA.units : 0);
      const unitPriceB = dB?.price || (dB?.units ? dB.value / dB.units : 0);
      const valA = a.units ? a.units * unitPriceA : a.amount_eur;
      const valB = b.units ? b.units * unitPriceB : b.amount_eur;
      const gainA = valA - a.amount_eur;
      const gainB = valB - b.amount_eur;
      const retA = a.amount_eur > 0 ? (gainA / a.amount_eur) * 100 : 0;
      const retB = b.amount_eur > 0 ? (gainB / b.amount_eur) * 100 : 0;

      let vA: any = 0;
      let vB: any = 0;

      if (movSortField === 'date') { vA = a.date; vB = b.date; }
      else if (movSortField === 'product') { vA = prodA?.name || ''; vB = prodB?.name || ''; }
      else if (movSortField === 'amount') { vA = a.amount_eur; vB = b.amount_eur; }
      else if (movSortField === 'value') { vA = valA; vB = valB; }
      else if (movSortField === 'gain') { vA = gainA; vB = gainB; }
      else if (movSortField === 'ret') { vA = retA; vB = retB; }

      if (typeof vA === 'string') {
        return movSortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return movSortAsc ? vA - vB : vB - vA;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inversiones</h1>
          <p className="text-slate-400 text-sm mt-1">Tus productos de inversión</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="bg-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-700 outline-none"
          >
            <option value="">Todas las cuentas de inversión</option>
            {accounts.filter((a: any) => a.type === 'inversion').map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            onClick={updateAllPrices}
            disabled={updatingPrices}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${updatingPrices ? 'animate-spin' : ''}`} /> Actualizar precios
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Añadir
          </button>
        </div>
      </div>

      {/* Métricas de resumen general */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniStat label="Total aportado" value={formatEUR(totalInvestedAcc)} />
        <MiniStat label="Ganancias" value={formatEUR(totalGainAcc, { sign: true })} valueClass={gainColor} />
        <MiniStat label="Rentabilidad" value={formatPercent(totalRetAcc)} valueClass={gainColor} />
      </div>

      {error && <Card className="p-4"><p className="text-red-400 text-sm">{error}</p></Card>}
      {priceMessage && <Card className="p-3"><p className="text-slate-300 text-sm">{priceMessage}</p></Card>}

      {products.length > 0 && <ProductEvolutionChart products={products.map(p => ({ id: p.id, name: p.name, alias: p.alias, color: p.color }))} />}

      {/* Tabla de Productos de Inversión (situada por encima de los 4 gráficos inferiores) */}
      {products.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-500">No tienes productos aún. Añade tu primera inversión.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800 cursor-pointer select-none">
                <th className="px-5 py-3 font-medium hover:text-white" onClick={() => handleSort('name')}>Nombre {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-3 font-medium hover:text-white" onClick={() => handleSort('type')}>Tipo {sortField === 'type' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-3 font-medium hover:text-white" onClick={() => handleSort('account')}>Cuenta {sortField === 'account' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-3 font-medium text-right hover:text-white" onClick={() => handleSort('value')}>Valor {sortField === 'value' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-3 font-medium text-right hover:text-white" onClick={() => handleSort('invested')}>Invertido {sortField === 'invested' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-3 font-medium text-right hover:text-white" onClick={() => handleSort('gain')}>G/P {sortField === 'gain' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-3 font-medium text-right hover:text-white" onClick={() => handleSort('ret')}>Rentab. {sortField === 'ret' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((p) => {
                const d = detailMap.get(p.id);
                const value = d?.value || 0;
                const invested = d?.invested || 0;
                const gain = d?.gain || 0;
                const ret = invested > 0 ? (gain / invested) * 100 : 0;
                const color = gain > 0 ? 'text-emerald-400' : gain < 0 ? 'text-red-400' : 'text-slate-400';
                const estimated = d?.estimated;
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-white font-medium flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || '#3b82f6' }} />
                      <span>{p.alias || p.name}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{PRODUCT_TYPES[p.type] || p.type}</td>
                    <td className="px-5 py-3 text-slate-400">
                      {accounts.find(a => a.id === p.account_id)?.name || '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-200">
                      {formatEUR(value)}
                      {estimated && <span className="ml-1 text-amber-500 text-xs">est.</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-400">{formatEUR(invested)}</td>
                    <td className={`px-5 py-3 text-right ${color}`}>{formatEUR(gain, { sign: true })}</td>
                    <td className={`px-5 py-3 text-right ${color}`}>{formatPercent(ret)}</td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {/* 5 Nuevos Gráficos de Inversiones */}
      {products.length > 0 && (
        <InvestmentDashboardCharts
          products={filteredProducts}
          detailMap={detailMap}
          allMovements={allMovements}
        />
      )}

      {/* Histórico de Movimientos de Inversión */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-white font-semibold">Histórico de Aportaciones de Inversión</h2>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Filtrar por producto:</span>
            <select
              value={txFilterProduct}
              onChange={(e) => setTxFilterProduct(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 outline-none"
            >
              <option value="">Todos los productos</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        {filteredMovements.length === 0 ? (
          <p className="text-slate-500 text-sm p-5">Sin aportaciones registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800 cursor-pointer select-none">
                <th className="px-5 py-2 font-medium hover:text-white" onClick={() => handleMovSort('date')}>Fecha {movSortField === 'date' ? (movSortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-2 font-medium hover:text-white" onClick={() => handleMovSort('product')}>Producto {movSortField === 'product' ? (movSortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-2 font-medium text-right hover:text-white" onClick={() => handleMovSort('amount')}>Dinero aportado (€) {movSortField === 'amount' ? (movSortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-2 font-medium text-right hover:text-white" onClick={() => handleMovSort('value')}>Valor actual (€) {movSortField === 'value' ? (movSortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-2 font-medium text-right hover:text-white" onClick={() => handleMovSort('gain')}>Ganancia (€) {movSortField === 'gain' ? (movSortAsc ? '▲' : '▼') : ''}</th>
                <th className="px-5 py-2 font-medium text-right hover:text-white" onClick={() => handleMovSort('ret')}>Rentabilidad (%) {movSortField === 'ret' ? (movSortAsc ? '▲' : '▼') : ''}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((m: any) => {
                const prod = products.find(p => p.id === m.product_id);
                const d = detailMap.get(m.product_id);
                const unitPrice = d?.price || (d?.units ? d.value / d.units : 0);
                const currentValueMov = m.units ? m.units * unitPrice : m.amount_eur;
                const gainMov = currentValueMov - m.amount_eur;
                const retMov = m.amount_eur > 0 ? (gainMov / m.amount_eur) * 100 : 0;
                const color = gainMov > 0 ? 'text-emerald-400' : gainMov < 0 ? 'text-red-400' : 'text-slate-400';

                return (
                  <tr key={m.id} className="border-b border-slate-800/50">
                    <td className="px-5 py-2.5 text-slate-300">{formatDate(m.date)}</td>
                    <td className="px-5 py-2.5 text-white font-medium">{prod?.name || '—'}</td>
                    <td className="px-5 py-2.5 text-right text-slate-300">{formatEUR(m.amount_eur)}</td>
                    <td className="px-5 py-2.5 text-right text-slate-200">{formatEUR(currentValueMov)}</td>
                    <td className={`px-5 py-2.5 text-right font-medium ${color}`}>{formatEUR(gainMov, { sign: true })}</td>
                    <td className={`px-5 py-2.5 text-right font-medium ${color}`}>{formatPercent(retMov)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {showAdd && <AddProductModal onClose={() => { setShowAdd(false); loadData(); }} />}
      {deleteTarget && (
        <DeleteProductModal
          product={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); loadData(); }}
        />
      )}
    </div>
  );
}

function DeleteProductModal({ product, onCancel, onDeleted }: { product: Product; onCancel: () => void; onDeleted: () => void }) {
  const [info, setInfo] = useState<{ movements: number; prices: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.deleteProduct(product.id)
      .then((data) => {
        if (data.requiresConfirm) setInfo({ movements: data.movements, prices: data.prices });
        else setInfo({ movements: 0, prices: 0 });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [product.id]);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteProductConfirm(product.id);
      onDeleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const doArchive = async () => {
    setArchiving(true);
    try {
      await api.updateProduct(product.id, { archived: 1 });
      onDeleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">Eliminar "{product.name}"</h2>
        {loading ? (
          <p className="text-slate-400 text-sm">Comprobando…</p>
        ) : (
          <div className="space-y-3">
            {(info?.movements || 0) > 0 && (
              <p className="text-amber-400 text-sm">
                Se borrarán {info!.movements} movimiento(s) y {info!.prices} precio(s) asociados.
              </p>
            )}
            {(info?.movements || 0) === 0 && (
              <p className="text-slate-400 text-sm">Este producto no tiene movimientos.</p>
            )}
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <p className="text-slate-300 text-sm mb-2">Alternativa: archivar el producto</p>
              <button
                onClick={doArchive}
                disabled={archiving}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg transition-colors w-full"
              >
                <Archive className="w-4 h-4" /> {archiving ? 'Archivando…' : 'Archivar (mantener datos)'}
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={doDelete} disabled={deleting || loading} className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">
            {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}

const PRICE_SOURCES = [
  { value: 'yahoo', label: 'Yahoo Finance' },
  { value: 'stooq', label: 'Stooq' },
  { value: 'coingecko', label: 'CoinGecko' },
  { value: 'twelve-data', label: 'Twelve Data (clave)' },
  { value: 'alpha-vantage', label: 'Alpha Vantage (clave)' },
];

function AddProductModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [type, setType] = useState('renta_variable');
  const [isin, setIsin] = useState('');
  const [ticker, setTicker] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [accountId, setAccountId] = useState<string>('');
  const [investmentAccounts, setInvestmentAccounts] = useState<any[]>([]);
  const [priceSource, setPriceSource] = useState('yahoo');
  const [altSource, setAltSource] = useState('');
  const [altSymbol, setAltSymbol] = useState('');
  const [longTerm, setLongTerm] = useState(true);
  const [portfolio, setPortfolio] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.getAccounts().then(accs => {
      const inv = accs.filter((a: any) => !a.archived && a.type === 'inversion');
      setInvestmentAccounts(inv);
      if (inv.length > 0) setAccountId(String(inv[0].id));
    }).catch(() => {});
  }, []);

  const doSearch = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await api.search(q);
      setSearchResults(results);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const pickResult = (r: any) => {
    setName(r.name || '');
    if (r.isin) setIsin(r.isin);
    if (r.ticker) setTicker(r.ticker);
    if (r.currency) setCurrency(r.currency);
    if (r.type) setType(r.type);
    if (r.source === 'CoinGecko') setPriceSource('coingecko');
    setSearchResults([]);
  };

  const save = async () => {
    if (!name) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const id = await api.createProduct({
        name,
        alias: alias || null,
        type,
        isin: isin || null,
        ticker: ticker || null,
        currency,
        price_source: priceSource,
        alt_source: altSource || null,
        alt_symbol: altSymbol || null,
        long_term: longTerm ? 1 : 0,
        account_id: accountId ? parseInt(accountId) : null,
      });
      // Try to download price history right away
      api.downloadHistory(id).catch(() => {});
      api.updateProductPrice(id).catch(() => {});
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">Nuevo producto</h2>
        <div className="relative">
          <Field label="Buscar (ISIN, ticker o nombre)">
            <input
              onChange={(e) => doSearch(e.target.value)}
              placeholder="Ej: ES0000000000, AAPL, Vanguard"
              className={inputCls}
            />
          </Field>
          {searching && <p className="text-slate-500 text-xs mt-1">Buscando…</p>}
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg max-h-48 overflow-y-auto shadow-xl">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pickResult(r)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                >
                  <p className="text-white text-sm font-medium">{r.name}</p>
                  <p className="text-slate-400 text-xs">{r.ticker} · {r.type} · {r.source}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <Field label="Nombre largo"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Apodo / Alias (Opcional)"><input value={alias} onChange={(e) => setAlias(e.target.value)} className={inputCls} placeholder="Ej: MSCI World" /></Field>
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Cuenta de Inversión">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            <option value="">Sin cuenta vinculada</option>
            {investmentAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ISIN"><input value={isin} onChange={(e) => setIsin(e.target.value)} className={inputCls} placeholder="ES0000000000" /></Field>
          <Field label="Ticker"><input value={ticker} onChange={(e) => setTicker(e.target.value)} className={inputCls} placeholder="AAPL" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Moneda">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
            </select>
          </Field>
          <Field label="Cartera (broker)"><input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} className={inputCls} placeholder="Opcional" /></Field>
        </div>
        <Field label="Fuente del precio principal">
          <select value={priceSource} onChange={(e) => setPriceSource(e.target.value)} className={inputCls}>
            {PRICE_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fuente alternativa">
            <select value={altSource} onChange={(e) => setAltSource(e.target.value)} className={inputCls}>
              <option value="">Ninguna</option>
              {PRICE_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Símbolo alternativo"><input value={altSymbol} onChange={(e) => setAltSymbol(e.target.value)} className={inputCls} placeholder="Opcional" /></Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={longTerm} onChange={(e) => setLongTerm(e.target.checked)} className="w-4 h-4 accent-blue-500" />
          <span className="text-slate-300 text-sm">Inversión a largo plazo</span>
        </label>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function ProductDetail({ productId, onBack }: { productId: number; onBack: () => void }) {
  const [data, setData] = useState<ProductDetailFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [editingMovement, setEditingMovement] = useState<any | null>(null);
  const [editingProduct, setEditingProduct] = useState(false);

  useEffect(() => {
    api.getProductDetail(productId)
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [productId]);

  const reload = () => {
    api.getProductDetail(productId).then(setData).catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackButton onBack={onBack} />
        <Card className="p-6"><p className="text-red-400">{error || 'No se encontró el producto'}</p></Card>
      </div>
    );
  }

  const { product, movements, currentValue, invested, gain, returnPct, tir, units, averageCost, realizedGain, latestPrice } = data;
  const gainColor = gain > 0 ? 'text-emerald-400' : gain < 0 ? 'text-red-400' : 'text-slate-400';

  const hasPrice = (data as any).hasPrice;
  const estimated = (data as any).estimated;
  const priceDate = (data as any).priceDate || latestPrice?.date || null;
  const priceSource = (data as any).priceSource || latestPrice?.source || null;
  const priceAgeDays = (data as any).priceAgeDays;
  const priceStale = priceAgeDays != null && priceAgeDays > 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton onBack={onBack} />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{product.name}</h1>
            <p className="text-slate-400 text-sm">{PRODUCT_TYPES[product.type] || product.type}{product.isin ? ` · ${product.isin}` : ''}{product.ticker ? ` · ${product.ticker}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingProduct(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" /> Editar
          </button>
          <button
            onClick={() => setShowAddMovement(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Movimiento
          </button>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-4">
        {hasPrice ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Último precio:</span>
              <span className="text-white font-semibold">{latestPrice ? formatEUR(latestPrice.price) : '—'}</span>
              {estimated && <span className="text-amber-400 text-xs font-medium bg-amber-950 px-1.5 py-0.5 rounded">estimado</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Fecha:</span>
              <span className="text-slate-300 text-sm">{priceDate ? formatDate(priceDate) : '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Fuente:</span>
              <span className="text-slate-300 text-sm">{priceSource || '—'}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Sin precio — configura una fuente o introduce un precio manual</span>
          </div>
        )}
        {priceStale && (
          <div className="flex items-center gap-1.5 text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Hace {priceAgeDays} días sin actualizar</span>
          </div>
        )}
        <div className="flex items-center gap-2 border-l border-slate-700 pl-4 my-1">
          <span className="text-slate-400 text-xs">Cuenta vinculada:</span>
          <AccountQuickSelect product={product} onDone={reload} />
        </div>
        <div className="flex-1" />
        <PriceActions productId={productId} onDone={reload} />
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Valor actual" value={formatEUR(currentValue)} />
        <MiniStat label="Invertido" value={formatEUR(invested)} />
        <MiniStat label="Ganancia/Pérdida" value={formatEUR(gain, { sign: true })} valueClass={gainColor} />
        <MiniStat label="Rentabilidad" value={formatPercent(returnPct)} valueClass={gainColor} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Unidades" value={formatUnits(units)} />
        <MiniStat label="Coste medio" value={formatEUR(averageCost)} />
        <MiniStat label="TIR (XIRR)" value={tir !== null ? formatPercent(tir) : '—'} valueClass={tir !== null && tir > 0 ? 'text-emerald-400' : tir !== null && tir < 0 ? 'text-red-400' : 'text-slate-400'} />
        <MiniStat label="Ganancia realizada" value={formatEUR(realizedGain, { sign: true })} valueClass={realizedGain > 0 ? 'text-emerald-400' : realizedGain < 0 ? 'text-red-400' : 'text-slate-400'} />
      </div>

      {data.series.length > 0 && (
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Evolución del valor</h2>
          <SeriesChart series={data.series} movements={movements} />
        </Card>
      )}

      {/* Top 10 Posiciones, Países y Sectores */}
      <ProductBreakdowns product={product} />

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Movimientos ({movements.length})</h2>
        </div>
        {movements.length === 0 ? (
          <p className="text-slate-500 text-sm p-5">Sin movimientos</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800">
                <th className="px-5 py-2 font-medium">Fecha</th>
                <th className="px-5 py-2 font-medium">Tipo</th>
                <th className="px-5 py-2 font-medium text-right">Unidades</th>
                <th className="px-5 py-2 font-medium text-right">Importe</th>
                <th className="px-5 py-2 font-medium text-right">Comisión</th>
                <th className="px-5 py-2 font-medium">Nota</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-2.5 text-slate-300">{formatDate(m.date)}</td>
                  <td className="px-5 py-2.5"><MovementBadge type={m.type} /></td>
                  <td className="px-5 py-2.5 text-right text-slate-400">{m.units ? formatUnits(m.units) : '—'}</td>
                  <td className="px-5 py-2.5 text-right text-slate-200">{formatEUR(m.amount_eur)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-400">{m.fee ? formatEUR(m.fee) : '—'}</td>
                  <td className="px-5 py-2.5 text-slate-500 text-xs max-w-32 truncate">{m.note || ''}</td>
                  <td className="px-5 py-2.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditingMovement(m)}
                        className="text-slate-600 hover:text-blue-400 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => { await api.deleteMovement(m.id); reload(); }}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showAddMovement && <AddMovementModal productId={productId} onClose={() => { setShowAddMovement(false); reload(); }} />}
      {editingMovement && <AddMovementModal productId={productId} existing={editingMovement} onClose={() => { setEditingMovement(null); reload(); }} />}
      {editingProduct && <EditProductModal product={product} onClose={() => { setEditingProduct(false); reload(); }} />}
    </div>
  );
}

function EditProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [name, setName] = useState(product.name);
  const [alias, setAlias] = useState(product.alias || '');
  const [type, setType] = useState(product.type);
  const [isin, setIsin] = useState(product.isin || '');
  const [ticker, setTicker] = useState(product.ticker || '');
  const [currency, setCurrency] = useState(product.currency);
  const [accountId, setAccountId] = useState<string>(product.account_id ? String(product.account_id) : '');
  const [color, setColor] = useState(product.color || '#3b82f6');
  const [countryBreakdown, setCountryBreakdown] = useState(product.country_breakdown || '');
  const [sectorBreakdown, setSectorBreakdown] = useState(product.sector_breakdown || '');
  const [topHoldings, setTopHoldings] = useState(product.top_holdings || '');
  const [investmentAccounts, setInvestmentAccounts] = useState<any[]>([]);
  const [priceSource, setPriceSource] = useState(product.price_source || 'yahoo');
  const [altSource, setAltSource] = useState(product.alt_source || '');
  const [altSymbol, setAltSymbol] = useState(product.alt_symbol || '');
  const [longTerm, setLongTerm] = useState(product.long_term === 1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAccounts().then(accs => {
      const inv = accs.filter((a: any) => !a.archived && a.type === 'inversion');
      setInvestmentAccounts(inv);
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (!name) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await api.updateProduct(product.id, {
        name,
        alias: alias || null,
        type,
        isin: isin || null,
        ticker: ticker || null,
        currency,
        color: color || null,
        country_breakdown: countryBreakdown || null,
        sector_breakdown: sectorBreakdown || null,
        top_holdings: topHoldings || null,
        price_source: priceSource,
        alt_source: altSource || null,
        alt_symbol: altSymbol || null,
        long_term: longTerm ? 1 : 0,
        account_id: accountId ? parseInt(accountId) : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">Editar producto</h2>
        <Field label="Nombre largo"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Apodo / Alias (Opcional)"><input value={alias} onChange={(e) => setAlias(e.target.value)} className={inputCls} placeholder="Ej: MSCI World" /></Field>
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Cuenta de Inversión">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            <option value="">Sin cuenta vinculada</option>
            {investmentAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ISIN"><input value={isin} onChange={(e) => setIsin(e.target.value)} className={inputCls} placeholder="ES0000000000" /></Field>
          <Field label="Ticker"><input value={ticker} onChange={(e) => setTicker(e.target.value)} className={inputCls} placeholder="AAPL" /></Field>
        </div>
        <Field label="Moneda">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
          </select>
        </Field>
        <Field label="Color personalizado">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer" />
        </Field>
        <Field label="Desglose por País (JSON o líneas 'EEUU: 60%')">
          <textarea value={countryBreakdown} onChange={(e) => setCountryBreakdown(e.target.value)} rows={2} className={`${inputCls} resize-none font-mono text-xs`} placeholder="EEUU: 60&#10;España: 40" />
        </Field>
        <Field label="Desglose por Sector (JSON o líneas 'Tecnología: 35%')">
          <textarea value={sectorBreakdown} onChange={(e) => setSectorBreakdown(e.target.value)} rows={2} className={`${inputCls} resize-none font-mono text-xs`} placeholder="Tecnología: 35&#10;Finanzas: 20" />
        </Field>
        <Field label="Top 10 Posiciones (JSON o líneas 'Apple: 8.5%')">
          <textarea value={topHoldings} onChange={(e) => setTopHoldings(e.target.value)} rows={3} className={`${inputCls} resize-none font-mono text-xs`} placeholder="Apple Inc: 8.5&#10;Microsoft: 7.2" />
        </Field>
        <Field label="Fuente del precio principal">
          <select value={priceSource} onChange={(e) => setPriceSource(e.target.value)} className={inputCls}>
            {PRICE_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fuente alternativa">
            <select value={altSource} onChange={(e) => setAltSource(e.target.value)} className={inputCls}>
              <option value="">Ninguna</option>
              {PRICE_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Símbolo alternativo"><input value={altSymbol} onChange={(e) => setAltSymbol(e.target.value)} className={inputCls} placeholder="Opcional" /></Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={longTerm} onChange={(e) => setLongTerm(e.target.checked)} className="w-4 h-4 accent-blue-500" />
          <span className="text-slate-300 text-sm">Inversión a largo plazo</span>
        </label>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function AccountQuickSelect({ product, onDone }: { product: Product; onDone: () => void }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAccounts().then(accs => {
      const inv = accs.filter((a: any) => !a.archived && a.type === 'inversion');
      setAccounts(inv);
    }).catch(() => {});
  }, []);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const account_id = val ? parseInt(val) : null;
    setSaving(true);
    try {
      await api.updateProduct(product.id, { account_id });
      onDone();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      value={product.account_id ? String(product.account_id) : ''}
      onChange={onChange}
      disabled={saving}
      className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 outline-none focus:border-blue-500"
    >
      <option value="">Sin cuenta</option>
      {accounts.map(a => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

function PriceActions({ productId, onDone }: { productId: number; onDone: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [msg, setMsg] = useState('');

  const updatePrice = async () => {
    setUpdating(true);
    setMsg('');
    try {
      const result = await api.updateProductPrice(productId);
      if (result.success) {
        setMsg('Precio actualizado');
        onDone();
      } else {
        setMsg(result.error || 'No se pudo actualizar');
      }
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const downloadHist = async () => {
    setDownloading(true);
    setMsg('');
    try {
      const result = await api.downloadHistory(productId);
      setMsg(`Histórico descargado: ${result.count} precios`);
      onDone();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {msg && <span className="text-slate-400 text-xs mr-2">{msg}</span>}
      <button
        onClick={updatePrice}
        disabled={updating}
        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${updating ? 'animate-spin' : ''}`} /> Actualizar
      </button>
      <button
        onClick={downloadHist}
        disabled={downloading}
        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
      >
        <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-spin' : ''}`} /> Histórico
      </button>
      <button
        onClick={() => setShowManual(true)}
        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Precio manual
      </button>
      <button
        onClick={() => setShowCsv(true)}
        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> CSV
      </button>
      {showManual && <ManualPriceModal productId={productId} onClose={() => { setShowManual(false); onDone(); }} />}
      {showCsv && <CsvImportModal productId={productId} onClose={() => { setShowCsv(false); onDone(); }} />}
    </div>
  );
}

function ManualPriceModal({ productId, onClose }: { productId: number; onClose: () => void }) {
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!price) { setError('El precio es obligatorio'); return; }
    setSaving(true);
    try {
      await api.savePrice(productId, { price: parseFloat(price), date, source: 'manual' });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">Precio manual</h2>
        <Field label="Precio (€)"><input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} autoFocus /></Field>
        <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function CsvImportModal({ productId, onClose }: { productId: number; onClose: () => void }) {
  const [csv, setCsv] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!csv.trim()) { setError('Pega el contenido CSV'); return; }
    setSaving(true);
    try {
      const result = await api.importCsvHistory(productId, csv);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">Importar histórico CSV</h2>
        <p className="text-slate-400 text-sm">Formato: <code className="text-slate-300">fecha;precio</code> o <code className="text-slate-300">date,close</code></p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="w-full h-40 bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
          placeholder="fecha;precio&#10;2024-01-01;150.50&#10;2024-01-02;151.20"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Importando…' : 'Importar'}</button>
        </div>
      </div>
    </div>
  );
}

function AddMovementModal({ productId, existing, onClose }: { productId: number; existing?: any; onClose: () => void }) {
  const [type, setType] = useState(existing?.type || 'compra');
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [units, setUnits] = useState(existing?.units?.toString() || '');
  const initialUnitPrice = (existing?.units && existing?.amount_eur) ? ((existing.amount_eur - (existing.fee || 0)) / existing.units).toString() : '';
  const [unitPrice, setUnitPrice] = useState(initialUnitPrice);
  const [fee, setFee] = useState(existing?.fee?.toString() || '');
  const [amount, setAmount] = useState(existing?.amount_eur?.toString() || '');
  const [note, setNote] = useState(existing?.note || '');
  const [portfolio, setPortfolio] = useState(existing?.portfolio || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Recalculate Total Cost whenever Units, Unit Price or Fee changes
  const handleUnitsChange = (val: string) => {
    setUnits(val);
    const u = parseFloat(val);
    const p = parseFloat(unitPrice);
    const f = parseFloat(fee) || 0;
    if (!isNaN(u) && !isNaN(p)) {
      setAmount(((u * p) + f).toFixed(2));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setUnitPrice(val);
    const u = parseFloat(units);
    const p = parseFloat(val);
    const f = parseFloat(fee) || 0;
    if (!isNaN(u) && !isNaN(p)) {
      setAmount(((u * p) + f).toFixed(2));
    }
  };

  const handleFeeChange = (val: string) => {
    setFee(val);
    const u = parseFloat(units);
    const p = parseFloat(unitPrice);
    const f = parseFloat(val) || 0;
    if (!isNaN(u) && !isNaN(p)) {
      setAmount(((u * p) + f).toFixed(2));
    } else if (!isNaN(parseFloat(amount))) {
      // Keep existing total cost
    }
  };

  const save = async () => {
    if (!amount) { setError('El importe es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        product_id: productId, type, date,
        units: units ? parseFloat(units) : null,
        amount_eur: parseFloat(amount),
        fee: fee ? parseFloat(fee) : null,
        note: note || null,
        portfolio: portfolio || null,
      };
      if (existing) {
        await api.updateMovement(existing.id, payload);
      } else {
        await api.createMovement(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg">{existing ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="compra">Compra</option><option value="venta">Venta</option>
              <option value="dividendo">Dividendo</option><option value="comision">Comisión</option>
              <option value="saldo">Saldo inicial</option>
            </select>
          </Field>
          <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unidades/Participaciones"><input type="number" step="any" value={units} onChange={(e) => handleUnitsChange(e.target.value)} className={inputCls} placeholder="Ej: 10" /></Field>
          <Field label="Precio por unidad (€)"><input type="number" step="any" value={unitPrice} onChange={(e) => handleUnitPriceChange(e.target.value)} className={inputCls} placeholder="Ej: 150.00" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Comisiones (€)"><input type="number" step="any" value={fee} onChange={(e) => handleFeeChange(e.target.value)} className={inputCls} placeholder="Ej: 2.50" /></Field>
          <Field label="Coste Total (€)"><input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="=(Unidades * Precio) + Comisiones" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cartera (broker)"><input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} className={inputCls} placeholder="Opcional" /></Field>
          <Field label="Nota"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>{children}</div>;
}

function MiniStat({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <Card className="p-4">
      <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </Card>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
      <ArrowLeft className="w-4 h-4" /> Volver
    </button>
  );
}

function MonthYearPicker({ value, onChange, placeholder }: { value: string; onChange: (val: string) => void; placeholder: string }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear - 10 + i);
  const months = [
    { num: '01', label: 'Ene' }, { num: '02', label: 'Feb' }, { num: '03', label: 'Mar' },
    { num: '04', label: 'Abr' }, { num: '05', label: 'May' }, { num: '06', label: 'Jun' },
    { num: '07', label: 'Jul' }, { num: '08', label: 'Ago' }, { num: '09', label: 'Sep' },
    { num: '10', label: 'Oct' }, { num: '11', label: 'Nov' }, { num: '12', label: 'Dic' },
  ];

  const [selectedYear, selectedMonth] = value ? value.split('-') : ['', ''];

  const handleYearChange = (y: string) => {
    if (!y) { onChange(''); return; }
    const m = selectedMonth || '01';
    onChange(`${y}-${m}`);
  };

  const handleMonthChange = (m: string) => {
    if (!m) { onChange(''); return; }
    const y = selectedYear || String(currentYear);
    onChange(`${y}-${m}`);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap max-w-full">
      <select
        value={selectedMonth}
        onChange={(e) => handleMonthChange(e.target.value)}
        className="bg-slate-800 text-slate-200 text-[11px] rounded px-1 py-0.5 border border-slate-700 outline-none max-w-[70px]"
      >
        <option value="">{placeholder}</option>
        {months.map(m => (
          <option key={m.num} value={m.num}>{m.label}</option>
        ))}
      </select>
      <select
        value={selectedYear}
        onChange={(e) => handleYearChange(e.target.value)}
        className="bg-slate-800 text-slate-200 text-[11px] rounded px-1 py-0.5 border border-slate-700 outline-none max-w-[65px]"
      >
        <option value="">Año</option>
        {years.map(y => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}

function MovementBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    compra: 'bg-blue-950 text-blue-400 border-blue-900',
    venta: 'bg-emerald-950 text-emerald-400 border-emerald-900',
    dividendo: 'bg-amber-950 text-amber-400 border-amber-900',
    comision: 'bg-red-950 text-red-400 border-red-900',
    saldo: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  const labels: Record<string, string> = { compra: 'Compra', venta: 'Venta', dividendo: 'Dividendo', comision: 'Comisión', saldo: 'Saldo' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs border ${styles[type] || styles.saldo}`}>{labels[type] || type}</span>;
}

function parseKeyValueText(text: string | null): { name: string; value: number }[] {
  if (!text || !text.trim()) return [];
  const res: { name: string; value: number }[] = [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object') {
          const name = item.name || item.holdingName || item.country || item.sector || Object.keys(item)[0] || '';
          const rawVal = item.value ?? item.percentage ?? item.weight ?? item[name] ?? 0;
          const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/%/g, '').trim());
          if (name && !isNaN(num)) res.push({ name: String(name), value: num });
        }
      }
      if (res.length > 0) return res;
    } else if (typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/%/g, '').trim());
        if (k && !isNaN(num)) res.push({ name: k, value: num });
      }
      if (res.length > 0) return res;
    }
  } catch {}

  const lines = text.split('\n');
  for (const l of lines) {
    const parts = l.split(':');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const valStr = parts.slice(1).join(':').replace(/%/g, '').trim();
      const num = parseFloat(valStr);
      if (name && !isNaN(num)) res.push({ name, value: num });
    } else {
      const altParts = l.split(/[,;=]/);
      if (altParts.length >= 2) {
        const name = altParts[0].trim();
        const valStr = altParts[1].replace(/%/g, '').trim();
        const num = parseFloat(valStr);
        if (name && !isNaN(num)) res.push({ name, value: num });
      }
    }
  }
  return res;
}

function ProductBreakdowns({ product }: { product: Product }) {
  const holdings = parseKeyValueText(product.top_holdings).slice(0, 10);
  const countries = parseKeyValueText(product.country_breakdown);
  const sectors = parseKeyValueText(product.sector_breakdown);

  if (holdings.length === 0 && countries.length === 0 && sectors.length === 0) return null;

  return (
    <div className="space-y-6">
      {holdings.length > 0 && (
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Top 10 Mayores Posiciones</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800">
                <th className="pb-2 font-medium">Posición / Activo</th>
                <th className="pb-2 font-medium text-right">Peso (%)</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="py-2.5 text-slate-200 font-medium">{h.name}</td>
                  <td className="py-2.5 text-right text-blue-400 font-medium">{formatPercent(h.value, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {countries.length > 0 && (
          <Card className="p-5">
            <h2 className="text-white font-semibold mb-4">Distribución por País (%)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={countries} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'Peso']} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {sectors.length > 0 && (
          <Card className="p-5">
            <h2 className="text-white font-semibold mb-4">Distribución por Sector (%)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sectors} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'Peso']} />
                <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}

function InvestmentDashboardCharts({ products, detailMap, allMovements }: { products: Product[]; detailMap: Map<number, any>; allMovements: any[] }) {
  const [accumulatedMode, setAccumulatedMode] = useState<'eur' | 'pct'>('eur');
  const [returnPeriod, setReturnPeriod] = useState<'mensual' | 'anual'>('mensual');

  // Filtros temporales para gráficos de aportaciones y rentabilidad
  const [contribFrom, setContribFrom] = useState('');
  const [contribTo, setContribTo] = useState('');
  const [returnFrom, setReturnFrom] = useState('');
  const [returnTo, setReturnTo] = useState('');

  // 1. Gráfico de % por País
  const countryMap = new Map<string, number>();
  let totalCountryVal = 0;
  for (const p of products) {
    const d = detailMap.get(p.id);
    const val = d?.value || 0;
    const countries = parseKeyValueText(p.country_breakdown);
    if (countries.length > 0) {
      for (const c of countries) {
        const itemVal = val * (c.value / 100);
        countryMap.set(c.name, (countryMap.get(c.name) || 0) + itemVal);
        totalCountryVal += itemVal;
      }
    } else {
      countryMap.set('Otros / Sin especificar', (countryMap.get('Otros / Sin especificar') || 0) + val);
      totalCountryVal += val;
    }
  }
  const countryChartData = Array.from(countryMap.entries())
    .map(([name, val]) => ({ name, value: totalCountryVal > 0 ? (val / totalCountryVal) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // 2. Gráfico de % por Tipo de Inversión
  const typeMap = new Map<string, number>();
  let totalTypeVal = 0;
  for (const p of products) {
    const d = detailMap.get(p.id);
    const val = d?.value || 0;
    const typeLabel = PRODUCT_TYPES[p.type] || p.type;
    typeMap.set(typeLabel, (typeMap.get(typeLabel) || 0) + val);
    totalTypeVal += val;
  }
  const typeChartData = Array.from(typeMap.entries())
    .map(([name, val]) => ({ name, value: totalTypeVal > 0 ? (val / totalTypeVal) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // 3. Gráfico de Aportaciones mensuales por fondo
  const monthMap = new Map<string, Record<string, number>>();
  const relevantMovements = allMovements.filter(m => {
    const prod = products.find(p => p.id === m.product_id);
    return prod && (m.type === 'compra' || m.type === 'saldo');
  });

  const contribMovements = relevantMovements.filter(m => {
    if (contribFrom && m.date < contribFrom) return false;
    if (contribTo && m.date > contribTo) return false;
    return true;
  });

  for (const m of contribMovements) {
    const month = m.date.slice(0, 7);
    const prod = products.find(p => p.id === m.product_id);
    if (!prod) continue;
    if (!monthMap.has(month)) monthMap.set(month, {});
    const row = monthMap.get(month)!;
    row[prod.name] = (row[prod.name] || 0) + m.amount_eur;
  }

  const monthlyContributionsData = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, prodsObj]) => ({ month, ...prodsObj }));

  // 4. Rentabilidad (Mensual o Anual) calculada estrictamente dentro de cada periodo específico
  const returnMovements = relevantMovements.filter(m => {
    if (returnFrom && m.date < returnFrom) return false;
    if (returnTo && m.date > returnTo) return false;
    return true;
  });

  const returnMap = new Map<string, { startVal: number; endVal: number; netFlow: number }>();
  for (const m of returnMovements) {
    const key = returnPeriod === 'mensual' ? m.date.slice(0, 7) : m.date.slice(0, 4);
    const d = detailMap.get(m.product_id);
    const unitPrice = d?.price || (d?.units ? d.value / d.units : 0);
    const currentVal = m.units ? m.units * unitPrice : m.amount_eur;

    if (!returnMap.has(key)) returnMap.set(key, { startVal: 0, endVal: 0, netFlow: 0 });
    const entry = returnMap.get(key)!;
    entry.startVal += m.amount_eur;
    entry.endVal += currentVal;
    entry.netFlow += m.amount_eur;
  }

  const returnBarData = Array.from(returnMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodKey, data]) => {
      const gain = data.endVal - data.startVal;
      const ret = data.startVal > 0 ? (gain / data.startVal) * 100 : 0;
      return { period: periodKey, rentabilidad: ret };
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: % Invertido en cada País */}
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Inversión por País (%)</h2>
          {countryChartData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-12">Sin datos de país</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={countryChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => [formatPercent(Number(v), 1), 'Peso']} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Gráfico 2: % por Tipo de Inversión */}
        <Card className="p-5">
          <h2 className="text-white font-semibold mb-4">Inversión por Tipo (%)</h2>
          {typeChartData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-12">Sin datos por tipo</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={typeChartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => [formatPercent(Number(v), 1), 'Peso']} />
                <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]}>
                  {typeChartData.map((entry: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 3: Aportaciones mensuales por fondo */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <h2 className="text-white font-semibold">Aportaciones mensuales por producto</h2>
            <div className="flex items-center gap-1.5 text-xs">
              <MonthYearPicker
                value={contribFrom ? contribFrom.slice(0, 7) : ''}
                onChange={(val) => setContribFrom(val ? `${val}-01` : '')}
                placeholder="Desde"
              />
              <span className="text-slate-500">→</span>
              <MonthYearPicker
                value={contribTo ? contribTo.slice(0, 7) : ''}
                onChange={(val) => setContribTo(val ? `${val}-31` : '')}
                placeholder="Hasta"
              />
            </div>
          </div>
          {monthlyContributionsData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-12">Sin aportaciones</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyContributionsData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => formatEUR(Number(v))} />
                {products.map((p, idx) => (
                  <Bar key={p.id} dataKey={p.name} stackId="a" fill={p.color || CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Gráfico 4: Rentabilidad (Mensual / Anual) */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <h2 className="text-white font-semibold">Rentabilidad histórica</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <MonthYearPicker
                  value={returnFrom ? returnFrom.slice(0, 7) : ''}
                  onChange={(val) => setReturnFrom(val ? `${val}-01` : '')}
                  placeholder="Desde"
                />
                <span className="text-slate-500">→</span>
                <MonthYearPicker
                  value={returnTo ? returnTo.slice(0, 7) : ''}
                  onChange={(val) => setReturnTo(val ? `${val}-31` : '')}
                  placeholder="Hasta"
                />
              </div>
              <div className="flex items-center bg-slate-800 rounded border border-slate-700 p-0.5 text-xs">
                <button
                  onClick={() => setReturnPeriod('mensual')}
                  className={`px-2 py-0.5 rounded ${returnPeriod === 'mensual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setReturnPeriod('anual')}
                  className={`px-2 py-0.5 rounded ${returnPeriod === 'anual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Anual
                </button>
              </div>
            </div>
          </div>
          {returnBarData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-12">Sin datos de rentabilidad</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={returnBarData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} labelStyle={{ color: '#cbd5e1' }} formatter={(v: any) => [formatPercent(Number(v)), 'Rentabilidad']} />
                <Bar dataKey="rentabilidad" radius={[4, 4, 0, 0]}>
                  {returnBarData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.rentabilidad >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

function SeriesChart({ series, movements }: { series: { date: string; value: number }[]; movements?: any[] }) {
  const [range, setRange] = useState<'1M' | '3M' | '6M' | 'YTD' | '1A' | 'TODO'>('TODO');
  const purchasesSet = new Set((movements || []).filter(m => m.type === 'compra').map(m => m.date));

  const filteredSeries = useMemo(() => {
    if (!series || series.length === 0) return [];
    if (range === 'TODO') return series;
    const lastDateStr = series[series.length - 1].date;
    const lastDate = new Date(lastDateStr);
    const cutoff = new Date(lastDate);

    if (range === '1M') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (range === '3M') cutoff.setMonth(cutoff.getMonth() - 3);
    else if (range === '6M') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (range === '1A') cutoff.setFullYear(cutoff.getFullYear() - 1);
    else if (range === 'YTD') cutoff.setMonth(0, 1);

    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return series.filter(s => s.date >= cutoffStr);
  }, [series, range]);

  // Calculate cumulative invested total (TotalAportado_t) at each date
  const sortedMovements = [...(movements || [])]
    .filter(m => m.type === 'compra' || m.type === 'saldo' || m.type === 'venta')
    .sort((a, b) => a.date.localeCompare(b.date));

  const investedAtDate = (date: string): number => {
    let total = 0;
    for (const m of sortedMovements) {
      if (m.date <= date) {
        if (m.type === 'compra' || m.type === 'saldo') total += m.amount_eur;
        else if (m.type === 'venta') total -= m.amount_eur;
      } else {
        break;
      }
    }
    return total;
  };

  const data = filteredSeries.map((s) => {
    const totalAportado = investedAtDate(s.date);
    const gainPct = totalAportado > 0 ? ((s.value - totalAportado) / totalAportado) * 100 : 0;
    return {
      date: s.date,
      value: s.value,
      gainPct,
      isPurchase: purchasesSet.has(s.date),
    };
  });

  const CustomizedDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload && payload.isPurchase) {
      return (
        <circle cx={cx} cy={cy} r={5} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} />
      );
    }
    return null;
  };

  const RANGES: { id: '1M' | '3M' | '6M' | 'YTD' | '1A' | 'TODO'; label: string }[] = [
    { id: '1M', label: '1M' },
    { id: '3M', label: '3M' },
    { id: '6M', label: '6M' },
    { id: 'YTD', label: 'YTD' },
    { id: '1A', label: '1A' },
    { id: 'TODO', label: 'Todo' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 justify-end">
        {RANGES.map(r => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              range === r.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisDate} minTickGap={40} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#ffffff' }}
            labelStyle={{ color: '#cbd5e1' }}
            formatter={(v: any, name: any, item: any) => {
              const valEUR = formatEUR(Number(v));
              const pct = item.payload?.gainPct;
              const pctStr = pct !== undefined ? ` (${formatPercent(pct)})` : '';
              return [`${valEUR}${pctStr}`, 'Valor'];
            }}
          />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={<CustomizedDot />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

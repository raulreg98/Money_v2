import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Product, ProductDetailFull } from '@/types';
import { Card } from '@/components/Card';
import { ProductEvolutionChart } from '@/components/ProductEvolutionChart';
import { formatEUR, formatPercent, formatDate, formatAxisEUR, formatUnits, PRODUCT_TYPES } from '@/lib/format';
import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, Download, AlertTriangle, Pencil, Archive } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [priceMessage, setPriceMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const loadData = () => {
    Promise.all([api.getProducts(), api.getPortfolioSummary(), api.getAccounts()])
      .then(([prods, summ, accs]) => {
        setProducts(prods);
        setSummary(summ);
        setAccounts(accs);
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

  const detailMap = new Map((summary?.productDetails || []).map((d: any) => [d.id, d]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inversiones</h1>
          <p className="text-slate-400 text-sm mt-1">Tus productos de inversión</p>
        </div>
        <div className="flex items-center gap-2">
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

      {error && <Card className="p-4"><p className="text-red-400 text-sm">{error}</p></Card>}
      {priceMessage && <Card className="p-3"><p className="text-slate-300 text-sm">{priceMessage}</p></Card>}

      {products.length > 0 && <ProductEvolutionChart products={products.map(p => ({ id: p.id, name: p.name }))} />}

      {products.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-500">No tienes productos aún. Añade tu primera inversión.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Cuenta</th>
                <th className="px-5 py-3 font-medium text-right">Valor</th>
                <th className="px-5 py-3 font-medium text-right">Invertido</th>
                <th className="px-5 py-3 font-medium text-right">G/P</th>
                <th className="px-5 py-3 font-medium text-right">Rentab.</th>
                <th className="px-5 py-3 font-medium text-right">Precio</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const d = detailMap.get(p.id);
                const value = d?.value || 0;
                const invested = d?.invested || 0;
                const gain = d?.gain || 0;
                const ret = invested > 0 ? (gain / invested) * 100 : 0;
                const color = gain > 0 ? 'text-emerald-400' : gain < 0 ? 'text-red-400' : 'text-slate-400';
                const hasPrice = d?.hasPrice;
                const estimated = d?.estimated;
                const priceStale = d?.priceAgeDays != null && d.priceAgeDays > 5;
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-white font-medium">{p.name}</td>
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
                    <td className="px-5 py-3 text-right">
                      {hasPrice ? (
                        <span className="text-slate-300 text-xs">{d.priceDate}</span>
                      ) : (
                        <span className="text-red-400 text-xs">Sin precio</span>
                      )}
                      {priceStale && <AlertTriangle className="inline ml-1 w-3 h-3 text-amber-400" />}
                    </td>
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
        </Card>
      )}

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
  const [type, setType] = useState('fondo');
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
        name, type,
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
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
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
          <SeriesChart series={data.series} />
        </Card>
      )}

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
  const [type, setType] = useState(product.type);
  const [isin, setIsin] = useState(product.isin || '');
  const [ticker, setTicker] = useState(product.ticker || '');
  const [currency, setCurrency] = useState(product.currency);
  const [accountId, setAccountId] = useState<string>(product.account_id ? String(product.account_id) : '');
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
        name, type,
        isin: isin || null,
        ticker: ticker || null,
        currency,
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
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
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
  const [amount, setAmount] = useState(existing?.amount_eur?.toString() || '');
  const [fee, setFee] = useState(existing?.fee?.toString() || '');
  const [note, setNote] = useState(existing?.note || '');
  const [portfolio, setPortfolio] = useState(existing?.portfolio || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
          <Field label="Unidades"><input type="number" step="any" value={units} onChange={(e) => setUnits(e.target.value)} className={inputCls} /></Field>
          <Field label="Importe (€)"><input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Comisión (€)"><input type="number" step="any" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} /></Field>
          <Field label="Cartera (broker)"><input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} className={inputCls} placeholder="Opcional" /></Field>
        </div>
        <Field label="Nota"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
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

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function SeriesChart({ series }: { series: { date: string; value: number }[] }) {
  const data = series.map((s) => ({ date: s.date, value: s.value }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} minTickGap={40} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={formatAxisEUR} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          formatter={(v: any) => [formatEUR(Number(v)), 'Valor']}
        />
        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

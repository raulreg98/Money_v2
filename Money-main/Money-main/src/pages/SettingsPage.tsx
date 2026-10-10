import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/Card';
import { formatEUR, formatUnits } from '@/lib/format';
import { Download, Upload, RefreshCw, Database, AlertTriangle, FileArchive, CheckCircle, XCircle, AlertCircle, Zap, Key, ExternalLink } from 'lucide-react';

export function SettingsPage() {
  const [backups, setBackups] = useState<any[]>([]);
  const [backupMsg, setBackupMsg] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [rateMsg, setRateMsg] = useState('');
  const [myinvestorCsv, setMyinvestorCsv] = useState('');
  const [myinvestorIsin, setMyinvestorIsin] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [mmPreview, setMmPreview] = useState<any>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [mmError, setMmError] = useState('');
  const [mmExecuting, setMmExecuting] = useState(false);
  const [mmResult, setMmResult] = useState('');
  const [testSymbol, setTestSymbol] = useState('AAPL');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, boolean>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keyMsg, setKeyMsg] = useState('');

  useEffect(() => {
    api.getBackups().then(setBackups).catch(() => {});
    api.getExchangeRates().then(setRates).catch(() => {});
    api.getApiKeys().then(setApiKeys).catch(() => {});
  }, []);

  const testSources = async () => {
    setTesting(true);
    setTestResults([]);
    try {
      const results = await api.testPriceSources(testSymbol);
      setTestResults(results);
    } catch (err: any) {
      setTestResults([{ label: 'Error', success: false, error: err.message }]);
    } finally {
      setTesting(false);
    }
  };

  const saveKey = async (provider: string) => {
    const key = keyInputs[provider];
    if (!key) return;
    try {
      await api.saveApiKey(provider, key);
      const keys = await api.getApiKeys();
      setApiKeys(keys);
      setKeyInputs({ ...keyInputs, [provider]: '' });
      setKeyMsg(`Clave de ${provider} guardada`);
    } catch (err: any) {
      setKeyMsg(`Error: ${err.message}`);
    }
  };

  const createBackup = async () => {
    try { await api.createBackup('manual'); setBackupMsg('Copia creada'); api.getBackups().then(setBackups); } catch {}
  };

  const downloadBackup = () => {
    window.open(api.downloadBackup(), '_blank');
  };

  const refreshRates = async () => {
    setRateMsg('Actualizando…');
    try { await api.refreshRates(); const r = await api.getExchangeRates(); setRates(r); setRateMsg('Tipos actualizados'); } catch { setRateMsg('Error'); }
  };

  const importMyInvestor = async () => {
    setImportMsg(''); setImportError('');
    if (!myinvestorCsv || !myinvestorIsin) { setImportError('Pega el CSV e introduce el ISIN'); return; }
    try {
      const result = await api.importMyInvestor({ csv: myinvestorCsv, isin: myinvestorIsin });
      const csvResult = await api.importCsv({ rows: result.rows, replaceIsin: null });
      setImportMsg(`Importados: ${csvResult.imported}. Errores: ${csvResult.errors.length}`);
      setMyinvestorCsv(''); setMyinvestorIsin('');
    } catch (err: any) { setImportError(err.message); }
  };

  const resetDb = async () => {
    try { await api.resetDatabase(); setShowReset(false); setBackupMsg('Base de datos reseteada'); } catch {}
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Ajustes</h1>
        <p className="text-slate-400 text-sm mt-1">Configuración de la aplicación</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Exchange rates */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-slate-400" />
              <h2 className="text-white font-semibold">Tipos de cambio (BCE)</h2>
            </div>
            <button onClick={refreshRates} className="text-sm text-blue-400 hover:text-blue-300">{rateMsg || 'Actualizar'}</button>
          </div>
          <div className="space-y-1.5">
            {Object.entries(rates).slice(0, 10).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-slate-400">{k}</span>
                <span className="text-slate-200">{formatUnits(v)}</span>
              </div>
            ))}
            {Object.keys(rates).length === 0 && <p className="text-slate-500 text-sm">Sin datos. Pulsa actualizar.</p>}
          </div>
        </Card>

        {/* Backups */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-400" />
            <h2 className="text-white font-semibold">Copias de seguridad</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={createBackup} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-3 py-2 rounded-lg transition-colors">Crear copia</button>
            <button onClick={downloadBackup} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-3 py-2 rounded-lg transition-colors"><Download className="w-4 h-4" /> Descargar</button>
          </div>
          {backupMsg && <p className="text-emerald-400 text-sm">{backupMsg}</p>}
          {backups.length > 0 && (
            <div className="space-y-1">
              <p className="text-slate-400 text-xs">Copias disponibles:</p>
              {backups.slice(0, 5).map((b: any) => (
                <div key={b.filename} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{b.filename}</span>
                  <button onClick={async () => { await api.restoreBackup(b.filename); setBackupMsg('Restaurada'); }} className="text-blue-400 hover:text-blue-300 text-xs">Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Import */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-slate-400" />
            <h2 className="text-white font-semibold">Importar desde MyInvestor</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">ISIN del fondo</label>
            <input value={myinvestorIsin} onChange={(e) => setMyinvestorIsin(e.target.value)} className={inputCls} placeholder="ES0000000000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Pega el CSV exportado</label>
            <textarea value={myinvestorCsv} onChange={(e) => setMyinvestorCsv(e.target.value)} rows={4} className={`${inputCls} resize-none font-mono text-xs`} />
          </div>
          {importMsg && <p className="text-emerald-400 text-sm">{importMsg}</p>}
          {importError && <p className="text-red-400 text-sm">{importError}</p>}
          <button onClick={importMyInvestor} disabled={!myinvestorCsv || !myinvestorIsin} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">Importar</button>
        </Card>

        {/* MoneyMatter Import */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-slate-400" />
            <h2 className="text-white font-semibold">Importar desde MoneyMatter</h2>
          </div>
          {mmResult && <p className="text-emerald-400 text-sm">{mmResult}</p>}
          {mmError && <p className="text-red-400 text-sm">{mmError}</p>}
          {!mmPreview && !mmLoading && (
            <>
              <p className="text-slate-400 text-sm">Sube el archivo ZIP de copia de seguridad exportado desde MoneyMatter.</p>
              <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors cursor-pointer w-fit">
                <Upload className="w-4 h-4" /> Elegir archivo ZIP
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setMmLoading(true); setMmError(''); setMmResult('');
                    try {
                      const preview = await api.parseMoneyMatterZip(file);
                      setMmPreview(preview);
                    } catch (err: any) { setMmError(err.message); } finally { setMmLoading(false); }
                  }}
                />
              </label>
            </>
          )}
          {mmLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
              Procesando ZIP…
            </div>
          )}
          {mmPreview && (
            <MoneymatterPreview
              preview={mmPreview}
              executing={mmExecuting}
              onImport={async () => {
                setMmExecuting(true); setMmError('');
                try {
                  const result = await api.executeMoneyMatterImport(mmPreview);
                  if (result.errors.length > 0) {
                    setMmResult(`Importación completada con ${result.errors.length} errores`);
                  } else {
                    setMmResult('Importación completada correctamente');
                  }
                  setMmPreview(null);
                } catch (err: any) { setMmError(err.message); } finally { setMmExecuting(false); }
              }}
              onCancel={() => { setMmPreview(null); setMmError(''); }}
            />
          )}
        </Card>
      </div>

      {/* Price sources */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-slate-400" />
          <h2 className="text-white font-semibold">Fuentes de precios</h2>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Símbolo de prueba</label>
            <input value={testSymbol} onChange={(e) => setTestSymbol(e.target.value)} className={inputCls} placeholder="AAPL" />
          </div>
          <button
            onClick={testSources}
            disabled={testing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-slate-200 text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <Zap className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} /> Probar fuentes
          </button>
        </div>
        {testResults.length > 0 && (
          <div className="space-y-1.5">
            {testResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {r.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="text-slate-200 font-medium">{r.label || r.source}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {r.responseTime != null && <span className="text-slate-400">{r.responseTime}ms</span>}
                  {r.price != null && <span className="text-slate-300">{formatEUR(r.price)}</span>}
                  {r.error && <span className="text-red-400">{r.error}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-800 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-400" />
            <h3 className="text-white text-sm font-medium">Claves API (opcional)</h3>
          </div>
          <p className="text-slate-400 text-xs">Las claves se guardan solo en el servidor y nunca se envían al navegador.</p>

          <div className="space-y-3">
            <ApiKeyRow
              name="Twelve Data"
              description="Fondos y ETF. Plan gratuito: 8 peticiones/min, 800/día."
              helpUrl="https://twelvedata.com/pricing"
              hasKey={apiKeys['twelve-data']}
              value={keyInputs['twelve-data'] || ''}
              onChange={(v) => setKeyInputs({ ...keyInputs, 'twelve-data': v })}
              onSave={() => saveKey('twelve-data')}
            />
            <ApiKeyRow
              name="Alpha Vantage"
              description="Acciones y ETF. Plan gratuito: 25 peticiones/día."
              helpUrl="https://www.alphavantage.co/support/#api-key"
              hasKey={apiKeys['alpha-vantage']}
              value={keyInputs['alpha-vantage'] || ''}
              onChange={(v) => setKeyInputs({ ...keyInputs, 'alpha-vantage': v })}
              onSave={() => saveKey('alpha-vantage')}
            />
          </div>
          {keyMsg && <p className="text-slate-300 text-xs">{keyMsg}</p>}
        </div>
      </Card>

      {/* Reset */}
      <Card className="p-5 border-red-900/30">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="text-white font-semibold">Zona peligrosa</h2>
        </div>
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="text-red-400 hover:text-red-300 text-sm">Resetear base de datos…</button>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-300 text-sm">Esto borrará todos tus datos. ¿Estás seguro?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowReset(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-lg">Cancelar</button>
              <button onClick={resetDb} className="bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-lg">Sí, resetear</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

const inputCls = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors';

function ApiKeyRow({ name, description, helpUrl, hasKey, value, onChange, onSave }: {
  name: string; description: string; helpUrl: string; hasKey: boolean; value: string; onChange: (v: string) => void; onSave: () => void;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-200 text-sm font-medium flex items-center gap-2">
            {name}
            {hasKey && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">{description}</p>
        </div>
        <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
          Conseguir clave <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasKey ? 'Clave guardada (escribe nueva para reemplazar)' : 'Pega tu clave API'}
          className={inputCls}
        />
        <button
          onClick={onSave}
          disabled={!value}
          className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-slate-200 text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function MoneymatterPreview({ preview, executing, onImport, onCancel }: {
  preview: any;
  executing: boolean;
  onImport: () => void;
  onCancel: () => void;
}) {
  const c = preview.counts;
  const hasErrors = preview.errors.length > 0;
  const hasWarnings = preview.warnings.length > 0;

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {preview.formatVersion !== 1 && (
        <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-900/40 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-amber-300 text-xs">
            Versión del formato: {preview.formatVersion ?? 'desconocida'}. Se esperaba 1. Se intentará importar de todas formas.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Cuentas', value: c.accounts },
          { label: 'Categorías', value: c.categories },
          { label: 'Tags', value: c.tags },
          { label: 'Transacciones', value: c.transactions },
          { label: 'Transferencias', value: c.transfers },
          { label: 'Productos', value: c.products },
          { label: 'Movimientos', value: c.movements },
          { label: 'Efectivo', value: c.cashProducts },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs">Total ingresos</p>
          <p className="text-emerald-400 font-semibold text-sm mt-1">{formatEUR(preview.totals.income)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs">Total gastos</p>
          <p className="text-red-400 font-semibold text-sm mt-1">{formatEUR(preview.totals.expenses)}</p>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3">
        <p className="text-slate-400 text-xs">Rango de fechas</p>
        <p className="text-slate-200 text-sm mt-1">{preview.dateRange.min || '—'} a {preview.dateRange.max || '—'}</p>
      </div>

      {preview.balanceChecks.length > 0 && (
        <div>
          <p className="text-slate-300 text-sm font-medium mb-2">Verificación de saldos</p>
          <div className="space-y-1">
            {preview.balanceChecks.map((bc: any, i: number) => {
              const ok = Math.abs(bc.diff) < 0.01;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className={ok ? 'text-emerald-400' : 'text-amber-400'}>{bc.account}</span>
                  <span className={ok ? 'text-emerald-400' : 'text-amber-400'}>
                    {ok ? 'Coincide' : `Diferencia: ${formatEUR(Math.abs(bc.diff))}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {preview.holdingsChecks.length > 0 && (
        <div>
          <p className="text-slate-300 text-sm font-medium mb-2">Verificación de posiciones</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {preview.holdingsChecks.map((hc: any, i: number) => {
              const ok = hc.unitsMatch && hc.costMatch;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{hc.portfolio} / {hc.security}</span>
                  <span className={ok ? 'text-emerald-400' : 'text-amber-400'}>
                    {ok ? 'Coincide' : `No coincide${!hc.unitsMatch ? ' (unidades)' : ''}${!hc.costMatch ? ' (coste)' : ''}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasWarnings && (
        <div>
          <p className="text-amber-400 text-sm font-medium mb-1">Avisos ({preview.warnings.length})</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {preview.warnings.map((w: string, i: number) => (
              <p key={i} className="text-amber-300/80 text-xs">{w}</p>
            ))}
          </div>
        </div>
      )}

      {hasErrors && (
        <div>
          <p className="text-red-400 text-sm font-medium mb-1">Errores ({preview.errors.length})</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {preview.errors.map((e: any, i: number) => (
              <p key={i} className="text-red-300/80 text-xs">Fila {e.row}: {e.error}</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2 sticky bottom-0 bg-slate-900 pb-1">
        <button onClick={onCancel} disabled={executing} className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm py-2.5 rounded-lg transition-colors">Cancelar</button>
        <button onClick={onImport} disabled={executing} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm py-2.5 rounded-lg transition-colors">
          {executing ? 'Importando…' : 'Importar'}
        </button>
      </div>
    </div>
  );
}

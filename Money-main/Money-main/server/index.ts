import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { createServer as createHttpServer } from 'http';
import path from 'path';

import { getDb } from './db/database';
import { getSettings, setSetting } from './repositories/settingsRepo';
import { fetchAndSaveBceRates, getAllRates } from './services/exchangeRates';
import { updateAllPrices, updateProductPrice, downloadProductHistory, importCsvHistory, searchInstruments, testAllSources, saveApiKey, getApiKeyForProvider } from './services/priceService';
import { createBackup, listBackups, restoreFromBackup, exportFullJson, restoreFromJson, resetDatabase } from './services/backupService';
import { parseMoneyMatterZip, executeMoneyMatterImport } from './services/moneyMatterImport';

import * as productRepo from './repositories/productRepo';
import * as movementRepo from './repositories/movementRepo';
import * as priceRepo from './repositories/priceRepo';
import * as accountRepo from './repositories/accountRepo';
import * as transactionRepo from './repositories/transactionRepo';
import * as tagRepo from './repositories/tagRepo';
import * as chartRepo from './repositories/chartRepo';
import * as categoryRepo from './repositories/categoryRepo';

import { computeFifo } from './calculations/fifo';
import { xirrPercent } from './calculations/xirr';
import { computeDailySeries, computeMaxDrawdown, computeVolatility, computeSharpe } from './calculations/series';
import { simulateInvestment } from './calculations/comparator';
import { computeProductSeries } from './calculations/productValue';

const PORT = parseInt(process.env.PORT || '3000', 10);

function paramInt(req: any, key: string): number {
  const v = req.params[key];
  return parseInt(Array.isArray(v) ? v[0] : v);
}

function timeKey(dateStr: string, groupBy: string): string {
  const d = new Date(dateStr);
  if (groupBy === 'dia') return dateStr;
  if (groupBy === 'semana') {
    const monday = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    return monday.toISOString().slice(0, 10);
  }
  if (groupBy === 'ano') return String(d.getFullYear());
  return dateStr.slice(0, 7);
}

async function main() {
  await getDb();

  await fetchAndSaveBceRates().catch(err => console.error('Error al cargar tipos de cambio BCE:', err.message));

  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // === Productos ===
  app.get('/api/products', async (_req, res) => {
    res.json(await productRepo.getAllProductsWithArchived());
  });

  const productSchema = z.object({
    name: z.string().min(1), type: z.string(), isin: z.string().nullable().optional(),
    ticker: z.string().nullable().optional(), currency: z.string().default('EUR'),
    price_source: z.string().nullable().optional(), ter: z.number().nullable().optional(),
    risk: z.number().nullable().optional(), category: z.string().nullable().optional(),
    manual_price: z.number().optional(), long_term: z.number().optional(),
    alt_source: z.string().nullable().optional(), alt_symbol: z.string().nullable().optional(),
    account_id: z.number().nullable().optional(),
    alias: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    country_breakdown: z.string().nullable().optional(),
    sector_breakdown: z.string().nullable().optional(),
    top_holdings: z.string().nullable().optional(),
  });

  app.post('/api/products', async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const id = await productRepo.createProduct(parsed.data as any);
    res.json({ id });
  });

  app.put('/api/products/:id', async (req, res) => {
    await productRepo.updateProduct(paramInt(req, 'id'), req.body);
    res.json({ ok: true });
  });

  app.delete('/api/products/:id', async (req, res) => {
    const id = paramInt(req, 'id');
    if (req.query.confirm !== 'true') {
      const movements = await movementRepo.getMovementsByProduct(id);
      const pricesCount = await priceRepo.countPricesByProduct(id);
      return res.json({ requiresConfirm: true, movements: movements.length, prices: pricesCount });
    }
    await priceRepo.deletePricesByProduct(id);
    await movementRepo.deleteMovementsByProduct(id);
    await productRepo.deleteProduct(id);
    res.json({ ok: true });
  });

  // === Movimientos ===
  app.get('/api/movements/:productId', async (req, res) => {
    res.json(await movementRepo.getMovementsByProduct(paramInt(req, 'productId')));
  });

  const movementSchema = z.object({
    product_id: z.number(), type: z.string(), date: z.string(),
    units: z.number().nullable().optional(), amount_eur: z.number(),
    fee: z.number().nullable().optional(), note: z.string().nullable().optional(),
    portfolio: z.string().nullable().optional(),
  });

  app.post('/api/movements', async (req, res) => {
    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const id = await movementRepo.createMovement(parsed.data as any);

    // Si es un movimiento de compra y el producto tiene una cuenta vinculada, crear transacción de gasto automáticamente
    if (parsed.data.type === 'compra' && parsed.data.amount_eur > 0) {
      const product = await productRepo.getProductById(parsed.data.product_id);
      if (product && product.account_id) {
        await transactionRepo.createTransaction({
          type: 'gasto',
          date: parsed.data.date,
          amount: -Math.abs(parsed.data.amount_eur),
          account_id: product.account_id,
          note: `Compra de producto: ${product.name}`,
        } as any);
      }
    }

    res.json({ id });
  });

  app.put('/api/movements/:id', async (req, res) => {
    await movementRepo.updateMovement(paramInt(req, 'id'), req.body);
    res.json({ ok: true });
  });

  app.delete('/api/movements/:id', async (req, res) => {
    await movementRepo.deleteMovement(paramInt(req, 'id'));
    res.json({ ok: true });
  });

  // === Actualizar precios globales y configuración (rutas específicas antes de paramétricas) ===
  app.post('/api/prices/update-all', async (_req, res) => {
    const result = await updateAllPrices();
    res.json(result);
  });

  app.post('/api/prices/test-sources', async (req, res) => {
    const symbol = (req.body?.symbol as string) || 'AAPL';
    const results = await testAllSources(symbol);
    res.json(results);
  });

  app.post('/api/prices/save-api-key', async (req, res) => {
    const schema = z.object({ provider: z.string(), key: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    await saveApiKey(parsed.data.provider, parsed.data.key);
    res.json({ ok: true });
  });

  app.get('/api/prices/api-keys', async (_req, res) => {
    const providers = ['yahoo', 'stooq', 'coingecko', 'twelve-data', 'alpha-vantage'];
    const result: Record<string, boolean> = {};
    for (const p of providers) {
      const key = await getApiKeyForProvider(p);
      result[p] = !!key;
    }
    res.json(result);
  });

  // === Precios ===
  app.get('/api/prices/:productId', async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 365;
    res.json(await priceRepo.getPriceHistory(paramInt(req, 'productId'), limit));
  });

  app.post('/api/prices/:productId', async (req, res) => {
    const schema = z.object({ price: z.number(), currency: z.string().default('EUR'), date: z.string(), source: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    await priceRepo.savePrice(paramInt(req, 'productId'), parsed.data.price, parsed.data.currency, parsed.data.source || 'manual', parsed.data.date);
    res.json({ ok: true });
  });

  // === Valuaciones ===
  app.get('/api/valuations/:productId', async (req, res) => {
    res.json(await priceRepo.getValuationsByProduct(paramInt(req, 'productId')));
  });

  app.post('/api/valuations', async (req, res) => {
    const schema = z.object({ product_id: z.number(), value_eur: z.number(), date: z.string(), note: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    await priceRepo.upsertValuation(parsed.data.product_id, parsed.data.value_eur, parsed.data.date, parsed.data.note);
    res.json({ ok: true });
  });

  app.post('/api/valuations/bulk', async (req, res) => {
    const schema = z.object({ valuations: z.array(z.object({ product_id: z.number(), value_eur: z.number(), date: z.string() })) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    for (const v of parsed.data.valuations) {
      await priceRepo.upsertValuation(v.product_id, v.value_eur, v.date);
    }
    res.json({ ok: true, count: parsed.data.valuations.length });
  });

  app.delete('/api/valuations/:id', async (req, res) => {
    await priceRepo.deleteValuation(paramInt(req, 'id'));
    res.json({ ok: true });
  });

  // === Buscar instrumentos ===
  app.get('/api/search', async (req, res) => {
    const query = (req.query.q as string) || '';
    const results = await searchInstruments(query);
    res.json(results);
  });

  // === Tipos de cambio ===
  app.get('/api/exchange-rates', async (_req, res) => {
    const rates = await getAllRates();
    const result: Record<string, number> = {};
    for (const [k, v] of rates) result[k] = v;
    res.json(result);
  });

  app.post('/api/exchange-rates/refresh', async (_req, res) => {
    const result = await fetchAndSaveBceRates();
    res.json(result);
  });

  // === Cuentas ===
  app.get('/api/accounts', async (_req, res) => {
    const accounts = await accountRepo.getAllAccountsWithArchived();
    const allTx = await transactionRepo.getAllTransactions();
    const products = await productRepo.getAllProductsWithArchived();
    const allMovements = await movementRepo.getAllMovements();
    const latestPrices = await priceRepo.getAllLatestPrices();
    const latestValuations = await priceRepo.getAllLatestValuations();

    const result = accounts.map(acc => {
      const txs = allTx.filter(t => t.account_id === acc.id);
      const cash_balance = acc.initial_balance + txs.reduce((s, t) => s + t.amount, 0);

      let invested_value = 0;
      if (acc.type === 'inversion') {
        const portfolioNames = new Set(
          allMovements.filter(m => m.portfolio === acc.name).map(m => m.product_id)
        );
        for (const product of products) {
          if (product.archived) continue;
          const isLinkedByAccountId = product.account_id === acc.id;
          const isLinkedByPortfolio = !product.account_id && portfolioNames.has(product.id);
          if (!isLinkedByAccountId && !isLinkedByPortfolio) continue;

          const movements = allMovements.filter(m => m.product_id === product.id);
          const fifo = computeFifo(movements as any);
          const latestPrice = latestPrices.get(product.id);
          const latestValuation = latestValuations.get(product.id);
          const isPriced = ['fondo', 'etf', 'accion', 'cripto', 'materia_prima', 'bono', 'fondo_monetario', 'renta_variable'].includes(product.type);
          let value = 0;
          if (isPriced) {
            value = latestPrice ? fifo.remainingUnits * latestPrice.price : 0;
          } else {
            value = latestValuation ? latestValuation.value_eur : 0;
          }
          invested_value += value;
        }
      }

      return {
        ...acc,
        cash_balance,
        invested_value,
        total_balance: cash_balance + invested_value,
      };
    });

    res.json(result);
  });

  const accountSchema = z.object({
    name: z.string().min(1), currency: z.string().default('EUR'),
    initial_balance: z.number().default(0), color: z.string().default('#3b82f6'),
    type: z.string().default('corriente'),
    exclude_from_net_worth: z.number().optional(),
  });

  app.post('/api/accounts', async (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    const id = await accountRepo.createAccount(parsed.data);
    res.json({ id });
  });

  app.put('/api/accounts/:id', async (req, res) => {
    await accountRepo.updateAccount(paramInt(req, 'id'), req.body);
    res.json({ ok: true });
  });

  app.delete('/api/accounts/:id', async (req, res) => {
    await accountRepo.deleteAccount(paramInt(req, 'id'));
    res.json({ ok: true });
  });

  app.post('/api/accounts/:id/archive', async (req, res) => {
    const archived = req.body.archived === true || req.body.archived === 1;
    await accountRepo.archiveAccount(paramInt(req, 'id'), archived);
    res.json({ ok: true });
  });

  // Resumen de cuenta: balance, transacciones filtradas, series para gráficas, productos de inversión
  app.get('/api/cuentas/:id/resumen', async (req, res) => {
    const accountId = paramInt(req, 'id');
    const desde = (req.query.desde as string) || '';
    const hasta = (req.query.hasta as string) || new Date().toISOString().slice(0, 10);
    const tipoFiltro = (req.query.tipo as string) || '';
    const tagFiltro = (req.query.tag as string) || '';
    const catFiltro = (req.query.categoria as string) || '';
    const q = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const account = await accountRepo.getAccountById(accountId);
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const allTx = await transactionRepo.getTransactionsByAccount(accountId);
    const allAccounts = await accountRepo.getAllAccountsWithArchived();
    const categories = await categoryRepo.getAllCategories();
    const tags = await tagRepo.getAllTags();

    // Aplicar filtros
    let filtered = allTx;
    if (desde) filtered = filtered.filter(t => t.date >= desde);
    if (hasta) filtered = filtered.filter(t => t.date <= hasta);
    if (tipoFiltro) filtered = filtered.filter(t => t.type === tipoFiltro);
    if (catFiltro) {
      const catId = parseInt(catFiltro);
      const childIds = await categoryRepo.getChildCategoryIds(catId);
      const allCatIds = new Set([catId, ...childIds]);
      filtered = filtered.filter(t => t.category_id && allCatIds.has(t.category_id));
    }
    if (tagFiltro) {
      filtered = filtered.filter(t => {
        if (!t.tags) return false;
        return t.tags.split(',').map(s => s.trim()).includes(tagFiltro);
      });
    }
    if (q) {
      const lower = q.toLowerCase();
      filtered = filtered.filter(t =>
        (t.note || '').toLowerCase().includes(lower) ||
        t.type.toLowerCase().includes(lower)
      );
    }

    // Calcular saldo acumulado para todas las transacciones de la cuenta
    const sortedByDateAsc = [...allTx].filter(t => t.account_id === accountId).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.id - b.id;
    });
    let runningAccBalance = account.initial_balance;
    const runningMap = new Map<number, number>();
    for (const t of sortedByDateAsc) {
      runningAccBalance += t.amount;
      runningMap.set(t.id, runningAccBalance);
    }

    const pagedTx = filtered.slice(offset, offset + limit).map(t => ({
      ...t,
      running_balance: runningMap.get(t.id) ?? account.initial_balance,
    }));

    // Balance actual
    const balance = account.initial_balance + allTx
      .filter(t => t.account_id === accountId)
      .reduce((s, t) => s + t.amount, 0);

    // Serie de evolución del saldo (acumulativa)
    const sortedByDate = [...allTx].filter(t => t.account_id === accountId).sort((a, b) => a.date.localeCompare(b.date));
    const balanceSeries: { date: string; balance: number }[] = [];
    let runningBalance = account.initial_balance;
    const dateGroups = new Map<string, number>();
    for (const t of sortedByDate) {
      const day = t.date;
      dateGroups.set(day, (dateGroups.get(day) || 0) + t.amount);
    }
    for (const [date, dayChange] of dateGroups) {
      runningBalance += dayChange;
      balanceSeries.push({ date, balance: runningBalance });
    }

    // Ingresos vs gastos por mes (filtrados por fecha)
    const monthMap = new Map<string, { ingresos: number; gastos: number }>();
    for (const t of filtered) {
      if (t.account_id !== accountId) continue;
      const month = t.date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, { ingresos: 0, gastos: 0 });
      const entry = monthMap.get(month)!;
      if (t.type === 'ingreso') entry.ingresos += t.amount;
      else if (t.type === 'gasto') entry.gastos += Math.abs(t.amount);
    }
    const monthlyBars = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v }));

    // Gastos por categoría y por tag (filtrados por fecha)
    const catMap = new Map<string, number>();
    const tagMap = new Map<string, number>();
    for (const t of filtered) {
      if (t.account_id !== accountId || t.type !== 'gasto') continue;
      if (t.category_id) {
        const cat = categories.find(c => c.id === t.category_id);
        let parentCat = cat;
        if (cat && cat.parent_id) {
          parentCat = categories.find(c => c.id === cat.parent_id) || cat;
        }
        const name = parentCat ? parentCat.name : 'Sin categoría';
        catMap.set(name, (catMap.get(name) || 0) + Math.abs(t.amount));
      }
      if (t.tags) {
        for (const tagName of t.tags.split(',').map(s => s.trim())) {
          if (tagName) tagMap.set(tagName, (tagMap.get(tagName) || 0) + Math.abs(t.amount));
        }
      }
    }
    const gastosPorCategoria = Array.from(catMap.entries()).map(([name, value]) => {
      const cat = categories.find(c => c.name === name);
      return { name, value, color: cat?.color || '#6b7280', icon: cat?.icon || null };
    }).sort((a, b) => b.value - a.value);
    const gastosPorTag = Array.from(tagMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Productos de inversión (vinculados por account_id o nombre de cartera)
    let investmentProducts: any[] = [];
    let investedValue = 0;
    if (account.type === 'inversion') {
      const allMovements = await movementRepo.getAllMovements();
      const products = await productRepo.getAllProductsWithArchived();
      const portfolioNames = new Set(
        allMovements.filter(m => m.portfolio === account.name).map(m => m.product_id)
      );
      const latestPrices = await priceRepo.getAllLatestPrices();
      const latestValuations = await priceRepo.getAllLatestValuations();

      for (const product of products) {
        if (product.archived) continue;
        const isLinkedByAccountId = product.account_id === account.id;
        const isLinkedByPortfolio = !product.account_id && portfolioNames.has(product.id);
        if (!isLinkedByAccountId && !isLinkedByPortfolio) continue;

        const movements = allMovements.filter(m => m.product_id === product.id);
        const fifo = computeFifo(movements as any);
        const latestPrice = latestPrices.get(product.id);
        const latestValuation = latestValuations.get(product.id);
        const isPriced = ['fondo', 'etf', 'accion', 'cripto', 'materia_prima', 'bono', 'fondo_monetario', 'renta_variable'].includes(product.type);
        let value = 0;
        if (isPriced) {
          value = latestPrice ? fifo.remainingUnits * latestPrice.price : 0;
        } else {
          value = latestValuation ? latestValuation.value_eur : 0;
        }
        investedValue += value;
        investmentProducts.push({
          id: product.id, name: product.name, type: product.type,
          value, invested: fifo.totalCost, units: fifo.remainingUnits,
        });
      }
    }

    res.json({
      account,
      balance,
      investedValue,
      totalBalance: balance + investedValue,
      transactions: pagedTx,
      allTransactions: filtered,
      totalCount: filtered.length,
      accounts: allAccounts.map(a => ({ id: a.id, name: a.name, color: a.color, type: a.type })),
      categories: categories.map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id })),
      tags: tags.map(t => ({ id: t.id, name: t.name, color: t.color })),
      balanceSeries,
      monthlyBars,
      gastosPorCategoria,
      gastosPorTag,
      investmentProducts,
    });
  });

  // === Transacciones ===
  app.get('/api/transactions', async (_req, res) => {
    res.json(await transactionRepo.getAllTransactions());
  });

  const txSchema = z.object({
    type: z.enum(['gasto', 'ingreso', 'transferencia', 'ajuste']),
    date: z.string(), amount: z.number(),
    account_id: z.number(), to_account_id: z.number().nullable().optional(),
    to_amount: z.number().nullable().optional(), note: z.string().nullable().optional(),
    tags: z.string().nullable().optional(),
    category_id: z.number().nullable().optional(),
  });

  app.post('/api/transactions', async (req, res) => {
    const parsed = txSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const data = { ...parsed.data };

    if (data.type === 'gasto') {
      data.amount = -Math.abs(data.amount);
    } else if (data.type === 'ingreso') {
      data.amount = Math.abs(data.amount);
    }

    if (data.type === 'transferencia') {
      if (!data.to_account_id) return res.status(400).json({ error: 'Falta la cuenta destino' });
      const fromId = await transactionRepo.createTransaction({
        type: 'transferencia', date: data.date, amount: -Math.abs(data.amount),
        account_id: data.account_id, to_account_id: data.to_account_id,
        to_amount: data.to_amount, note: data.note, tags: data.tags,
        category_id: data.category_id,
      });
      const toId = await transactionRepo.createTransaction({
        type: 'transferencia', date: data.date, amount: Math.abs(data.to_amount || data.amount),
        account_id: data.to_account_id, to_account_id: data.account_id,
        to_amount: data.amount, note: data.note, tags: data.tags,
        linked_transfer_id: fromId,
        category_id: data.category_id,
      });
      await transactionRepo.updateTransaction(fromId, { linked_transfer_id: toId });
      res.json({ id: fromId });
    } else {
      const id = await transactionRepo.createTransaction(data as any);
      res.json({ id });
    }
  });

  app.put('/api/transactions/:id', async (req, res) => {
    const id = paramInt(req, 'id');
    const existing = (await transactionRepo.getAllTransactions()).find(t => t.id === id);
    if (existing?.type === 'transferencia' && existing.linked_transfer_id) {
      await transactionRepo.deleteTransferPair(id);
      const parsed = txSchema.safeParse(req.body);
      if (parsed.success) {
        if (parsed.data.type === 'transferencia' && parsed.data.to_account_id) {
          const fromId = await transactionRepo.createTransaction({
            type: 'transferencia', date: parsed.data.date, amount: -Math.abs(parsed.data.amount),
            account_id: parsed.data.account_id, to_account_id: parsed.data.to_account_id,
            to_amount: parsed.data.to_amount, note: parsed.data.note, tags: parsed.data.tags,
            category_id: parsed.data.category_id,
          });
          const toId = await transactionRepo.createTransaction({
            type: 'transferencia', date: parsed.data.date, amount: Math.abs(parsed.data.to_amount || parsed.data.amount),
            account_id: parsed.data.to_account_id, to_account_id: parsed.data.account_id,
            to_amount: parsed.data.amount, note: parsed.data.note, tags: parsed.data.tags,
            linked_transfer_id: fromId,
            category_id: parsed.data.category_id,
          });
          await transactionRepo.updateTransaction(fromId, { linked_transfer_id: toId });
        } else {
          const data = { ...parsed.data };
          if (data.type === 'gasto') data.amount = -Math.abs(data.amount);
          else if (data.type === 'ingreso') data.amount = Math.abs(data.amount);
          await transactionRepo.createTransaction(data as any);
        }
      }
    } else {
      const updateData = { ...req.body };
      if (updateData.type === 'gasto' && updateData.amount != null) {
        updateData.amount = -Math.abs(updateData.amount);
      } else if (updateData.type === 'ingreso' && updateData.amount != null) {
        updateData.amount = Math.abs(updateData.amount);
      }
      await transactionRepo.updateTransaction(id, updateData);
    }
    res.json({ ok: true });
  });

  app.delete('/api/transactions/:id', async (req, res) => {
    const id = paramInt(req, 'id');
    const all = await transactionRepo.getAllTransactions();
    const tx = all.find(t => t.id === id);
    if (tx?.type === 'transferencia' && tx.linked_transfer_id) {
      await transactionRepo.deleteTransferPair(id);
    } else {
      await transactionRepo.deleteTransaction(id);
    }
    res.json({ ok: true });
  });

  // Bulk tag operations on transactions
  app.post('/api/transactions/bulk-tag', async (req, res) => {
    const schema = z.object({
      ids: z.array(z.number()),
      action: z.enum(['add', 'remove']),
      tag: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    const { ids, action, tag } = parsed.data;
    const allTx = await transactionRepo.getAllTransactions();
    for (const id of ids) {
      const tx = allTx.find(t => t.id === id);
      if (!tx) continue;
      const currentTags = tx.tags ? tx.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
      let newTags: string[];
      if (action === 'add') {
        if (!currentTags.includes(tag)) newTags = [...currentTags, tag];
        else newTags = currentTags;
      } else {
        newTags = currentTags.filter(t => t !== tag);
      }
      await transactionRepo.updateTransaction(id, { tags: newTags.length > 0 ? newTags.join(',') : null });
    }
    res.json({ ok: true });
  });

  // === Categor\u00edas ===
  app.get('/api/categories', async (_req, res) => {
    res.json(await categoryRepo.getAllCategories());
  });

  app.post('/api/categories/reorder', async (req, res) => {
    const schema = z.object({ ids: z.array(z.number()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    await categoryRepo.reorderCategories(parsed.data.ids);
    res.json({ ok: true });
  });

  app.post('/api/categories', async (req, res) => {
    const schema = z.object({ name: z.string().min(1), color: z.string().default('#6b7280'), icon: z.string().nullable().optional(), parent_id: z.number().nullable().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const id = await categoryRepo.createCategory(parsed.data);
    res.json({ id });
  });

  app.put('/api/categories/:id', async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      icon: z.string().nullable().optional(),
      parent_id: z.number().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    await categoryRepo.updateCategory(paramInt(req, 'id'), parsed.data);
    res.json({ ok: true });
  });

  app.delete('/api/categories/:id', async (req, res) => {
    const reassignTo = req.query.reassign_to ? parseInt(req.query.reassign_to as string) : null;
    const id = paramInt(req, 'id');
    if (reassignTo !== null) {
      const childIds = await categoryRepo.getChildCategoryIds(id);
      for (const childId of childIds) {
        await categoryRepo.reassignCategoryTransactions(childId, reassignTo);
      }
      await categoryRepo.reassignCategoryTransactions(id, reassignTo);
    }
    await categoryRepo.deleteCategory(id);
    res.json({ ok: true });
  });

  app.get('/api/categories/:id/stats', async (req, res) => {
    const id = paramInt(req, 'id');
    const stats = await categoryRepo.getCategoryStats(id);
    res.json(stats);
  });

  app.get('/api/categories/:id/transacciones', async (req, res) => {
    const catId = paramInt(req, 'id');
    const desde = (req.query.desde as string) || '';
    const hasta = (req.query.hasta as string) || '';
    const tipo = (req.query.tipo as string) || '';
    const q = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    let txs = await transactionRepo.getAllTransactions();
    const childIds = await categoryRepo.getChildCategoryIds(catId);
    const allCatIds = [catId, ...childIds];
    txs = txs.filter(t => t.category_id && allCatIds.includes(t.category_id));
    if (desde) txs = txs.filter(t => t.date >= desde);
    if (hasta) txs = txs.filter(t => t.date <= hasta);
    if (tipo) txs = txs.filter(t => t.type === tipo);
    if (q) {
      const lower = q.toLowerCase();
      txs = txs.filter(t => (t.note || '').toLowerCase().includes(lower));
    }
    txs.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    const totalCount = txs.length;
    const paged = txs.slice(offset, offset + limit);
    const totalGastos = txs.filter(t => t.type === 'gasto').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalIngresos = txs.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);

    const monthMap = new Map<string, { ingresos: number; gastos: number }>();
    for (const t of txs) {
      const month = t.date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, { ingresos: 0, gastos: 0 });
      const entry = monthMap.get(month)!;
      if (t.type === 'ingreso') entry.ingresos += t.amount;
      else if (t.type === 'gasto') entry.gastos += Math.abs(t.amount);
    }
    const monthlyBars = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v }));

    const accounts = await accountRepo.getAllAccountsWithArchived();
    const categories = await categoryRepo.getAllCategories();
    res.json({
      transactions: paged, totalCount, totalGastos, totalIngresos, monthlyBars,
      accounts: accounts.map(a => ({ id: a.id, name: a.name })),
      categories,
    });
  });

  // === Tags ===
  app.get('/api/tags', async (_req, res) => {
    const tags = await tagRepo.getAllTags();
    const allTx = await transactionRepo.getAllTransactions();
    const tagStats = tags.map(tag => {
      let count = 0, gastos = 0, ingresos = 0;
      for (const tx of allTx) {
        if (!tx.tags) continue;
        const txTags = tx.tags.split(',').map(s => s.trim());
        if (!txTags.includes(tag.name)) continue;
        count++;
        if (tx.type === 'gasto') gastos += Math.abs(tx.amount);
        else if (tx.type === 'ingreso') ingresos += tx.amount;
      }
      return { ...tag, txCount: count, totalGastos: gastos, totalIngresos: ingresos };
    });
    res.json(tagStats);
  });

  app.get('/api/tags/:id/transacciones', async (req, res) => {
    const tagId = paramInt(req, 'id');
    const tag = await tagRepo.getAllTags().then(ts => ts.find(t => t.id === tagId));
    if (!tag) return res.status(404).json({ error: 'Tag no encontrado' });

    const desde = (req.query.desde as string) || '';
    const hasta = (req.query.hasta as string) || '';
    const cuenta = (req.query.cuenta as string) || '';
    const tipo = (req.query.tipo as string) || '';
    const q = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    let txs = await transactionRepo.getAllTransactions();
    txs = txs.filter(t => t.tags && t.tags.split(',').map(s => s.trim()).includes(tag.name));
    if (desde) txs = txs.filter(t => t.date >= desde);
    if (hasta) txs = txs.filter(t => t.date <= hasta);
    if (cuenta) txs = txs.filter(t => t.account_id === parseInt(cuenta) || t.to_account_id === parseInt(cuenta));
    if (tipo) txs = txs.filter(t => t.type === tipo);
    if (q) {
      const lower = q.toLowerCase();
      txs = txs.filter(t => (t.note || '').toLowerCase().includes(lower));
    }
    txs.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    const totalCount = txs.length;
    const paged = txs.slice(offset, offset + limit);

    const totalGastos = txs.filter(t => t.type === 'gasto').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalIngresos = txs.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);

    const monthMap = new Map<string, { ingresos: number; gastos: number }>();
    for (const t of txs) {
      const month = t.date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, { ingresos: 0, gastos: 0 });
      const entry = monthMap.get(month)!;
      if (t.type === 'ingreso') entry.ingresos += t.amount;
      else if (t.type === 'gasto') entry.gastos += Math.abs(t.amount);
    }
    const monthlyBars = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v }));

    const accounts = await accountRepo.getAllAccountsWithArchived();
    res.json({
      tag, transactions: paged, totalCount, totalGastos, totalIngresos, monthlyBars,
      accounts: accounts.map(a => ({ id: a.id, name: a.name })),
    });
  });

  app.get('/api/tags/most-used', async (_req, res) => {
    const allTx = await transactionRepo.getAllTransactions();
    const countMap = new Map<string, number>();
    for (const tx of allTx) {
      if (!tx.tags) continue;
      for (const tagName of tx.tags.split(',').map(s => s.trim())) {
        if (tagName) countMap.set(tagName, (countMap.get(tagName) || 0) + 1);
      }
    }
    const tags = await tagRepo.getAllTags();
    const result = Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => {
        const tag = tags.find(t => t.name === name);
        return { name, count, color: tag?.color || '#6b7280', id: tag?.id || null };
      });
    res.json(result);
  });

  app.post('/api/tags', async (req, res) => {
    const schema = z.object({ name: z.string().min(1), color: z.string().default('#6b7280') });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    const id = await tagRepo.createTag(parsed.data.name, parsed.data.color);
    res.json({ id });
  });

  app.put('/api/tags/:id', async (req, res) => {
    await tagRepo.updateTag(paramInt(req, 'id'), req.body);
    res.json({ ok: true });
  });

  app.delete('/api/tags/:id', async (req, res) => {
    await tagRepo.deleteTag(paramInt(req, 'id'));
    res.json({ ok: true });
  });

  // === Gráficas ===
  app.get('/api/widgets', async (_req, res) => {
    res.json(await chartRepo.getAllWidgets());
  });

  const widgetSchema = z.object({
    name: z.string().min(1), chart_type: z.string().default('bar'),
    metric: z.string().default('gastos'), group_by: z.string().default('mes'),
    period: z.string().default('3m'), custom_from: z.string().nullable().optional(),
    custom_to: z.string().nullable().optional(), account_filter: z.string().nullable().optional(),
    tag_filter: z.string().nullable().optional(), pinned: z.number().default(0),
    sort_order: z.number().default(0),
    default_key: z.string().nullable().optional(),
    size: z.number().default(1),
  });

  app.post('/api/widgets', async (req, res) => {
    const parsed = widgetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const id = await chartRepo.createWidget(parsed.data as any);
    res.json({ id });
  });

  app.post('/api/widgets/:id/duplicate', async (req, res) => {
    const id = paramInt(req, 'id');
    const all = await chartRepo.getAllWidgets();
    const w = all.find(x => x.id === id);
    if (!w) return res.status(404).json({ error: 'Widget no encontrado' });
    const newId = await chartRepo.createWidget({
      name: `${w.name} (copia)`, chart_type: w.chart_type, metric: w.metric,
      group_by: w.group_by, period: w.period, custom_from: w.custom_from,
      custom_to: w.custom_to, account_filter: w.account_filter, tag_filter: w.tag_filter,
      pinned: 0, sort_order: all.length, default_key: null, size: w.size ?? 1,
    } as any);
    res.json({ id: newId });
  });

  // Endpoint de datos para gráficas (vista previa y tarjetas)
  const graficaDatosSchema = z.object({
    metric: z.string().default('gastos'),
    group_by: z.string().default('mes'),
    period: z.string().default('3m'),
    custom_from: z.string().nullable().optional(),
    custom_to: z.string().nullable().optional(),
    account_filter: z.string().nullable().optional(),
    category_filter: z.string().nullable().optional(),
    chart_type: z.string().default('bar'),
    top_n: z.number().nullable().optional(),
  });

  app.post('/api/graficas/datos', async (req, res) => {
    const parsed = graficaDatosSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    const cfg = parsed.data;
    const allTx = await transactionRepo.getAllTransactions();
    const accounts = await accountRepo.getAllAccountsWithArchived();
    const categories = await categoryRepo.getAllCategories();

    // Filtrar transferencias y ajustes (no cuentan como gasto ni ingreso global)
    let txs = allTx.filter(t => t.type !== 'transferencia' && t.type !== 'ajuste');

    // Filtro por periodo
    const now = new Date();
    let from = new Date(2000, 0, 1);
    const to = new Date();
    if (cfg.period === 'este_mes') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (cfg.period === '3m') from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    else if (cfg.period === '6m') from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    else if (cfg.period === '12m') from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    else if (cfg.period === 'este_ano') from = new Date(now.getFullYear(), 0, 1);
    else if (cfg.period === 'custom') {
      if (cfg.custom_from) from = new Date(cfg.custom_from);
      if (cfg.custom_to) to.setTime(new Date(cfg.custom_to).getTime());
    }
    txs = txs.filter(t => { const d = new Date(t.date); return d >= from && d <= to; });

    // Filtro por cuenta
    if (cfg.account_filter) {
      const accIds = cfg.account_filter.split(',').map(s => parseInt(s.trim()));
      txs = txs.filter(t => accIds.includes(t.account_id));
    }

    // Filtro por categoría
    if (cfg.category_filter) {
      const catIds = cfg.category_filter.split(',').map(s => parseInt(s.trim()));
      txs = txs.filter(t => t.category_id && catIds.includes(t.category_id));
    }

    const catMap = new Map(categories.map(c => [c.id, c]));
    const accName = (id: number) => accounts.find(a => a.id === id)?.name || '—';

    // Agrupación por categoría o cuenta (donut/bar)
    if (cfg.group_by === 'categoria' || cfg.group_by === 'categoria_principal' || cfg.group_by === 'cuenta') {
      const map = new Map<string, number>();
      for (const t of txs) {
        if (cfg.metric === 'gastos' && t.type !== 'gasto') continue;
        if (cfg.metric === 'ingresos' && t.type !== 'ingreso') continue;
        let key = 'Sin categoría';
        if (cfg.group_by === 'cuenta') {
          key = accName(t.account_id);
        } else if (t.category_id) {
          const cat = catMap.get(t.category_id);
          if (cat) {
            if (cfg.group_by === 'categoria_principal' && cat.parent_id) {
              const parent = catMap.get(cat.parent_id);
              key = parent?.name || cat.name;
            } else {
              key = cat.name;
            }
          }
        }
        map.set(key, (map.get(key) || 0) + Math.abs(t.amount));
      }
      let entries = Array.from(map.entries()).map(([name, value]) => {
        const cat = categories.find(c => c.name === name);
        let color = cat?.color;
        if (!color && cat?.parent_id) {
          const parent = catMap.get(cat.parent_id);
          color = parent?.color;
        }
        return { name, value, color: color || '#6b7280', icon: cat?.icon || null };
      });
      entries.sort((a, b) => b.value - a.value);
      if (cfg.top_n && cfg.top_n > 0 && entries.length > cfg.top_n) {
        const top = entries.slice(0, cfg.top_n);
        const otros = entries.slice(cfg.top_n).reduce((s, e) => s + e.value, 0);
        top.push({ name: 'Otros', value: otros, color: '#64748b', icon: null });
        entries = top;
      }
      res.json({ type: 'category', data: entries, categories });
      return;
    }

    // Agrupación temporal (día, semana, mes, año)
    if (cfg.metric === 'neto') {
      const map = new Map<string, { gastos: number; ingresos: number }>();
      for (const t of txs) {
        const key = timeKey(t.date, cfg.group_by);
        if (!map.has(key)) map.set(key, { gastos: 0, ingresos: 0 });
        const entry = map.get(key)!;
        if (t.type === 'gasto') entry.gastos += Math.abs(t.amount);
        else if (t.type === 'ingreso') entry.ingresos += t.amount;
      }
      const data = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, ...v, neto: v.ingresos - v.gastos }));
      res.json({ type: 'neto', data, categories });
      return;
    }

    if (cfg.metric === 'saldo') {
      const initial = accounts.filter(a => !a.archived).reduce((s, a) => s + a.initial_balance, 0);
      const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
      const map = new Map<string, number>();
      let running = initial;
      for (const t of sorted) {
        running += t.amount;
        const key = timeKey(t.date, cfg.group_by);
        map.set(key, running);
      }
      const data = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, value: v }));
      res.json({ type: 'saldo', data, categories });
      return;
    }

    // Default: gastos o ingresos por periodo
    {
      const map = new Map<string, number>();
      for (const t of txs) {
        if (cfg.metric === 'gastos' && t.type !== 'gasto') continue;
        if (cfg.metric === 'ingresos' && t.type !== 'ingreso') continue;
        const key = timeKey(t.date, cfg.group_by);
        map.set(key, (map.get(key) || 0) + Math.abs(t.amount));
      }
      const data = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, value: v }));
      res.json({ type: 'series', data, categories });
    }
  });

  // Gráficas por defecto
  app.post('/api/graficas/defaults', async (_req, res) => {
    const existing = await chartRepo.getAllWidgets();
    const existingKeys = new Set(existing.map(w => (w as any).default_key).filter(Boolean));
    const defaults = [
      { name: 'Gastos por categoría (mes)', chart_type: 'pie', metric: 'gastos', group_by: 'categoria', period: 'este_mes', pinned: 1, default_key: 'default_gastos_cat_mes' },
      { name: 'Ingresos vs gastos (12m)', chart_type: 'bar', metric: 'neto', group_by: 'mes', period: '12m', pinned: 1, default_key: 'default_ing_vs_gas_12m' },
      { name: 'Saldo acumulado', chart_type: 'line', metric: 'saldo', group_by: 'mes', period: '12m', pinned: 1, default_key: 'default_saldo_acum' },
      { name: 'Gasto por grupo de categorías', chart_type: 'stacked_bar', metric: 'gastos', group_by: 'categoria_principal', period: '6m', pinned: 0, default_key: 'default_gasto_grupo_cat' },
      { name: 'Gastos por cuenta (mes)', chart_type: 'pie', metric: 'gastos', group_by: 'cuenta', period: 'este_mes', pinned: 0, default_key: 'default_gastos_cuenta' },
      { name: 'Ahorro neto mensual', chart_type: 'bar', metric: 'neto', group_by: 'mes', period: '12m', pinned: 0, default_key: 'default_ahorro_neto' },
    ];
    const created: number[] = [];
    for (const d of defaults) {
      if (existingKeys.has(d.default_key)) continue;
      const id = await chartRepo.createWidget({ ...d, custom_from: null, custom_to: null, account_filter: null, tag_filter: null, sort_order: 0, size: 1 } as any);
      created.push(id);
    }
    res.json({ created: created.length, ids: created });
  });

  app.put('/api/widgets/:id', async (req, res) => {
    await chartRepo.updateWidget(paramInt(req, 'id'), req.body);
    res.json({ ok: true });
  });

  app.delete('/api/widgets/:id', async (req, res) => {
    await chartRepo.deleteWidget(paramInt(req, 'id'));
    res.json({ ok: true });
  });

  app.post('/api/widgets/reorder', async (req, res) => {
    const schema = z.object({ ids: z.array(z.number()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    await chartRepo.reorderWidgets(parsed.data.ids);
    res.json({ ok: true });
  });

  // === Panel de patrimonio ===
  app.get('/api/portfolio/summary', async (req, res) => {
    const longTermOnly = req.query.long_term === 'true';
    const products = await productRepo.getAllProductsWithArchived();
    const allMovements = await movementRepo.getAllMovements();
    const latestPrices = await priceRepo.getAllLatestPrices();
    const latestValuations = await priceRepo.getAllLatestValuations();

    let totalValue = 0;
    let totalInvested = 0;
    let totalGain = 0;
    const allCashFlows: { date: Date; amount: number }[] = [];
    const byType: Record<string, { value: number; invested: number }> = {};
    const productDetails: any[] = [];

    for (const product of products) {
      if (product.archived) continue;
      if (longTermOnly && !product.long_term) continue;

      const movements = allMovements.filter(m => m.product_id === product.id);
      const fifo = computeFifo(movements as any);
      const latestPrice = latestPrices.get(product.id);
      const latestValuation = latestValuations.get(product.id);

      let value = 0;
      let hasPrice = false;
      let estimated = false;
      let pricePerUnit: number | null = null;
      let priceDate: string | null = null;
      let priceSource: string | null = null;
      const isPriced = ['renta_variable', 'fondo_monetario', 'cripto', 'materia_prima', 'accion', 'fondo', 'etf', 'bono'].includes(product.type);
      if (isPriced) {
        if (latestPrice) {
          pricePerUnit = latestPrice.price;
          priceDate = latestPrice.date;
          priceSource = latestPrice.source;
          hasPrice = true;
          if (latestPrice.source === 'estimado') estimated = true;
          value = fifo.remainingUnits * latestPrice.price;
        } else {
          const purchases = movements.filter(m => m.type === 'compra' && m.units && m.units > 0).sort((a, b) => b.date.localeCompare(a.date));
          if (purchases.length > 0) {
            const lastPurchase = purchases[0];
            pricePerUnit = Math.abs(lastPurchase.amount_eur) / lastPurchase.units!;
            priceDate = lastPurchase.date;
            priceSource = 'estimado';
            estimated = true;
            value = fifo.remainingUnits * pricePerUnit;
          }
        }
      } else {
        value = latestValuation ? latestValuation.value_eur : 0;
        hasPrice = !!latestValuation;
      }

      const invested = fifo.totalCost;
      const gain = value - invested;

      totalValue += value;
      totalInvested += invested;
      totalGain += gain;

      for (const m of movements) {
        if (m.type === 'compra' || m.type === 'saldo') {
          allCashFlows.push({ date: new Date(m.date), amount: -m.amount_eur });
        } else if (m.type === 'venta') {
          allCashFlows.push({ date: new Date(m.date), amount: m.amount_eur });
        } else if (m.type === 'dividendo') {
          allCashFlows.push({ date: new Date(m.date), amount: m.amount_eur });
        }
      }

      if (!byType[product.type]) byType[product.type] = { value: 0, invested: 0 };
      byType[product.type].value += value;
      byType[product.type].invested += invested;

      const priceAgeDays = priceDate ? Math.floor((Date.now() - new Date(priceDate).getTime()) / 86400000) : null;

      productDetails.push({
        id: product.id, name: product.name, type: product.type,
        value, invested, gain, units: fifo.remainingUnits,
        averageCost: fifo.averageCost, price: pricePerUnit,
        priceDate, priceSource, hasPrice, estimated,
        priceAgeDays, longTerm: !!product.long_term,
      });
    }

    if (totalValue > 0) {
      allCashFlows.push({ date: new Date(), amount: totalValue });
    }

    const tir = xirrPercent(allCashFlows);
    const totalReturnPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    res.json({
      totalValue, totalInvested, totalGain, tir, totalReturnPct,
      byType, productDetails, longTermOnly,
    });
  });

  app.get('/api/portfolio/product/:id', async (req, res) => {
    const id = paramInt(req, 'id');
    const product = await productRepo.getProductById(id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const movements = await movementRepo.getMovementsByProduct(id);
    const prices = await priceRepo.getPriceHistory(id, 365);
    const valuations = await priceRepo.getValuationsByProduct(id);
    const fifo = computeFifo(movements as any);

    const latestPrice = prices.length > 0 ? prices[0] : null;
    const latestValuation = valuations.length > 0 ? valuations[valuations.length - 1] : null;

    const isPriced = ['renta_variable', 'fondo_monetario', 'cripto', 'materia_prima', 'accion', 'fondo', 'etf', 'bono'].includes(product.type);
    let currentValue = 0;
    let hasPrice = false;
    let estimated = false;
    let pricePerUnit: number | null = null;
    let priceDate: string | null = null;
    let priceSource: string | null = null;
    if (isPriced) {
      if (latestPrice) {
        pricePerUnit = latestPrice.price;
        priceDate = latestPrice.date;
        priceSource = latestPrice.source;
        hasPrice = true;
        if (latestPrice.source === 'estimado') estimated = true;
        currentValue = fifo.remainingUnits * latestPrice.price;
      } else {
        const purchases = movements.filter(m => m.type === 'compra' && m.units && m.units > 0).sort((a, b) => b.date.localeCompare(a.date));
        if (purchases.length > 0) {
          const lastPurchase = purchases[0];
          pricePerUnit = Math.abs(lastPurchase.amount_eur) / lastPurchase.units!;
          priceDate = lastPurchase.date;
          priceSource = 'estimado';
          estimated = true;
          currentValue = fifo.remainingUnits * pricePerUnit;
        }
      }
    } else {
      currentValue = latestValuation ? latestValuation.value_eur : 0;
      hasPrice = !!latestValuation;
    }

    const priceAgeDays = priceDate ? Math.floor((Date.now() - new Date(priceDate).getTime()) / 86400000) : null;

    const invested = fifo.totalCost;
    const gain = currentValue - invested;
    const returnPct = invested > 0 ? (gain / invested) * 100 : 0;

    const cashFlows = movements.map(m => {
      let amount = 0;
      if (m.type === 'compra' || m.type === 'saldo') amount = -m.amount_eur;
      else if (m.type === 'venta' || m.type === 'dividendo') amount = m.amount_eur;
      return { date: new Date(m.date), amount };
    });
    if (currentValue > 0) cashFlows.push({ date: new Date(), amount: currentValue });
    const tir = xirrPercent(cashFlows);

    const priceHistoryData = prices.map(p => ({ date: p.date, price: p.price })).reverse();
    const series = computeDailySeries(
      movements as any,
      isPriced ? priceHistoryData : [],
      valuations.map(v => ({ date: v.date, value_eur: v.value_eur })),
      currentValue,
    );

    const maxDrawdown = computeMaxDrawdown(series);
    const volatility = computeVolatility(series);
    const sharpe = computeSharpe(series);

    res.json({
      product, movements, currentValue, invested, gain, returnPct, tir,
      units: fifo.remainingUnits, averageCost: fifo.averageCost,
      realizedGain: fifo.realizedGain, latestPrice, latestValuation,
      priceHistory: priceHistoryData, series, maxDrawdown, volatility, sharpe,
      hasPrice, estimated, pricePerUnit, priceDate, priceSource, priceAgeDays,
    });
  });

  // === Comparador ===
  app.get('/api/portfolio/comparator', async (_req, res) => {
    const allMovements = await movementRepo.getAllMovements();
    const products = await productRepo.getAllProductsWithArchived();

    const userMovements = allMovements
      .filter(m => {
        const p = products.find(p => p.id === m.product_id);
        return p && !p.archived && (m.type === 'compra' || m.type === 'venta' || m.type === 'saldo');
      })
      .map(m => ({ date: m.date, type: m.type, amount_eur: m.amount_eur }));

    const benchmarks = [
      { name: 'MSCI World (IWDA)', ticker: 'IWDA.L' },
      { name: 'S&P 500 (SXR8)', ticker: 'SXR8.DE' },
      { name: 'Cartera 60/40', ticker: '6040' },
      { name: 'Sin riesgo (XEON)', ticker: 'XEON.DE' },
    ];

    const results = [];
    for (const bench of benchmarks) {
      let priceHistory: { date: string; price: number }[] = [];
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(bench.ticker)}?interval=1d&range=max`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json() as any;
          const result = data?.chart?.result?.[0];
          if (result) {
            const timestamps = result.timestamp || [];
            const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.close?.[0]?.close || [];
            const currency = result.meta?.currency || 'EUR';
            const rates = await getAllRates();
            const rate = rates.get(currency) || 1;
            for (let i = 0; i < timestamps.length; i++) {
              if (closes[i] != null) {
                priceHistory.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), price: closes[i] * rate });
              }
            }
          }
        }
      } catch {}

      if (bench.ticker === '6040') {
        let iwdaHist: { date: string; price: number }[] = [];
        let eunaHist: { date: string; price: number }[] = [];
        try {
          for (const t of ['IWDA.L', 'EUNA.DE']) {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?interval=1d&range=max`;
            const resp = await fetch(url);
            if (resp.ok) {
              const data = await resp.json() as any;
              const result = data?.chart?.result?.[0];
              if (result) {
                const timestamps = result.timestamp || [];
                const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.close?.[0]?.close || [];
                const currency = result.meta?.currency || 'EUR';
                const rates = await getAllRates();
                const rate = rates.get(currency) || 1;
                const hist = timestamps.map((ts: number, i: number) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), price: (closes[i] || 0) * rate })).filter((p: any) => p.price > 0);
                if (t === 'IWDA.L') iwdaHist = hist;
                else eunaHist = hist;
              }
            }
          }
          const dateMap = new Map<string, { iwda: number; euna: number }>();
          for (const p of iwdaHist) {
            if (!dateMap.has(p.date)) dateMap.set(p.date, { iwda: 0, euna: 0 });
            dateMap.get(p.date)!.iwda = p.price;
          }
          for (const p of eunaHist) {
            if (!dateMap.has(p.date)) dateMap.set(p.date, { iwda: 0, euna: 0 });
            dateMap.get(p.date)!.euna = p.price;
          }
          priceHistory = Array.from(dateMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, v]) => ({ date, price: v.iwda > 0 && v.euna > 0 ? (v.iwda * 0.6 + v.euna * 0.4) / 100 : 0 }))
            .filter(p => p.price > 0);
        } catch {}
      }

      const result = simulateInvestment(userMovements, priceHistory, bench.name);
      results.push(result);
    }

    res.json(results);
  });

  // === Datos del panel general ===
  app.get('/api/dashboard', async (_req, res) => {
    const products = await productRepo.getAllProductsWithArchived();
    const allMovements = await movementRepo.getAllMovements();
    const latestPrices = await priceRepo.getAllLatestPrices();
    const latestValuations = await priceRepo.getAllLatestValuations();
    const accounts = await accountRepo.getAllAccounts();
    const allTx = await transactionRepo.getAllTransactions();

    let investmentValue = 0;
    for (const product of products) {
      if (product.archived) continue;
      const movements = allMovements.filter(m => m.product_id === product.id);
      const fifo = computeFifo(movements as any);
      const latestPrice = latestPrices.get(product.id);
      const latestValuation = latestValuations.get(product.id);
      const isPriced = ['fondo', 'etf', 'accion', 'cripto', 'materia_prima', 'bono', 'fondo_monetario', 'renta_variable'].includes(product.type);
      if (isPriced) {
        if (latestPrice) {
          investmentValue += fifo.remainingUnits * latestPrice.price;
        } else {
          const purchases = movements.filter(m => m.type === 'compra' && m.units && m.units > 0).sort((a, b) => b.date.localeCompare(a.date));
          if (purchases.length > 0) {
            investmentValue += fifo.remainingUnits * (Math.abs(purchases[0].amount_eur) / purchases[0].units!);
          }
        }
      } else {
        investmentValue += latestValuation ? latestValuation.value_eur : 0;
      }
    }

    let accountsBalance = 0;
    for (const acc of accounts) {
      if (acc.archived) continue;
      if (acc.exclude_from_net_worth) continue;
      const txs = allTx.filter(t => t.account_id === acc.id);
      const balance = acc.initial_balance + txs.reduce((s, t) => {
        if (t.type === 'gasto') return s + t.amount;
        if (t.type === 'ingreso') return s + t.amount;
        if (t.type === 'transferencia') {
          return s + t.amount;
        }
        return s;
      }, 0);
      accountsBalance += balance;
    }

    const pinnedWidgets = await chartRepo.getPinnedWidgets();
    res.json({
      netWorth: investmentValue + accountsBalance,
      investmentValue,
      accountsBalance,
      pinnedWidgets: pinnedWidgets.map(w => w.id),
    });
  });

  // === Importar CSV ===
  app.post('/api/import/csv', async (req, res) => {
    const schema = z.object({
      rows: z.array(z.object({
        fecha: z.string(), identificador: z.string(), nombre: z.string(),
        tipo_producto: z.string(), tipo_movimiento: z.string(),
        unidades: z.number().nullable().optional(), importe: z.number(),
        moneda: z.string().default('EUR'), comision: z.number().nullable().optional(),
        nota: z.string().nullable().optional(),
      })),
      replaceIsin: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

    await createBackup('pre-import');
    const errors: { row: number; error: string }[] = [];
    let imported = 0;

    for (let i = 0; i < parsed.data.rows.length; i++) {
      const row = parsed.data.rows[i];
      try {
        let product = (await productRepo.getAllProductsWithArchived()).find(p => p.isin === row.identificador || p.ticker === row.identificador);
        if (!product) {
          const id = await productRepo.createProduct({
            name: row.nombre, type: row.tipo_producto, isin: row.identificador.match(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/) ? row.identificador : null,
            ticker: row.identificador.match(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/) ? null : row.identificador,
            currency: row.moneda, price_source: null, ter: null, risk: null, category: null,
          });
          product = await productRepo.getProductById(id);
        }
        if (!product) { errors.push({ row: i + 1, error: 'No se pudo crear el producto' }); continue; }
        await movementRepo.createMovement({
          product_id: product.id, type: row.tipo_movimiento, date: row.fecha,
          units: row.unidades || null, amount_eur: row.importe, fee: row.comision || 0,
          note: row.nota,
        });
        imported++;
      } catch (e: any) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    res.json({ imported, errors });
  });

  app.post('/api/import/myinvestor', async (req, res) => {
    const schema = z.object({ csv: z.string(), isin: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

    const lines = parsed.data.csv.trim().split('\n');
    const header = lines[0].split(/[;,]/).map(h => h.trim().replace(/"/g, ''));
    const rows: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/"/g, ''));
        const dateCol = header.findIndex(h => h.toLowerCase().includes('fecha'));
        const amountCol = header.findIndex(h => h.toLowerCase().includes('importe') || h.toLowerCase().includes('importe'));
        const typeCol = header.findIndex(h => h.toLowerCase().includes('tipo') || h.toLowerCase().includes('operación'));
        const unitsCol = header.findIndex(h => h.toLowerCase().includes('unidades') || h.toLowerCase().includes('participaciones'));
        if (dateCol < 0 || amountCol < 0) { errors.push({ row: i, error: 'No se encontraron columnas de fecha o importe' }); continue; }
        const date = parseDate(cols[dateCol]);
        const amount = parseFloat(cols[amountCol].replace(/\./g, '').replace(',', '.')) || 0;
        const units = unitsCol >= 0 ? parseFloat(cols[unitsCol].replace(/\./g, '').replace(',', '.')) || null : null;
        const type = typeCol >= 0 ? mapMyInvestorType(cols[typeCol]) : 'compra';
        rows.push({ fecha: date, identificador: parsed.data.isin, nombre: parsed.data.isin, tipo_producto: 'fondo', tipo_movimiento: type, unidades: units, importe: Math.abs(amount), moneda: 'EUR', comision: null, nota: null });
      } catch (e: any) {
        errors.push({ row: i, error: e.message });
      }
    }

    res.json({ rows, errors });
  });

  function parseDate(s: string): string {
    const parts = s.split(/[/-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return s;
  }

  function mapMyInvestorType(s: string): string {
    const lower = s.toLowerCase();
    if (lower.includes('compra') || lower.includes('aportación') || lower.includes('suscrip')) return 'compra';
    if (lower.includes('venta') || lower.includes('reembolso')) return 'venta';
    if (lower.includes('dividendo') || lower.includes('renta')) return 'dividendo';
    return 'compra';
  }

  // === Importar desde MoneyMatter ===
  app.post('/api/import/moneymatter/parse', async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const zipBuffer = Buffer.concat(chunks);
        const preview = parseMoneyMatterZip(zipBuffer);
        res.json(preview);
      });
      req.on('error', () => res.status(500).json({ error: 'Error al leer el archivo' }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/import/moneymatter/execute', async (req, res) => {
    try {
      const preview = req.body;
      if (!preview || !preview.parsedData) {
        return res.status(400).json({ error: 'Faltan los datos de la vista previa' });
      }
      const result = await executeMoneyMatterImport(preview);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // === Copias de seguridad ===
  app.get('/api/backups', async (_req, res) => {
    res.json(await listBackups());
  });

  app.post('/api/backups/create', async (req, res) => {
    const label = (req.body?.label as string) || 'manual';
    const backupPath = await createBackup(label);
    res.json({ ok: true, path: backupPath });
  });

  app.post('/api/backups/restore', async (req, res) => {
    const schema = z.object({ filename: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Falta el nombre del archivo' });
    const ok = await restoreFromBackup(parsed.data.filename);
    res.json({ ok });
  });

  app.get('/api/backups/download', async (_req, res) => {
    const data = await exportFullJson();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="mi-patrimonio-${new Date().toISOString().slice(0, 10)}.db"`);
    res.send(data);
  });

  app.post('/api/backups/restore-json', async (req, res) => {
    const data = req.body as Buffer;
    const ok = await restoreFromJson(Buffer.from(data));
    res.json({ ok });
  });

  app.post('/api/reset', async (_req, res) => {
    await resetDatabase();
    res.json({ ok: true });
  });

  // === Settings ===
  app.get('/api/settings', async (_req, res) => {
    res.json(await getSettings());
  });

  app.put('/api/settings', async (req, res) => {
    const schema = z.object({ key: z.string(), value: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
    await setSetting(parsed.data.key, parsed.data.value);
    res.json({ ok: true });
  });

  // === Inversiones series ===
  app.get('/api/inversiones/series', async (req, res) => {
    try {
      const productIds = ((req.query.productos as string) || '')
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n > 0);
      const desde = (req.query.desde as string) || '';
      const hasta = (req.query.hasta as string) || new Date().toISOString().slice(0, 10);

      if (productIds.length === 0) return res.json({ products: [] });

      const result: any[] = [];
      for (const pid of productIds) {
        const product = await productRepo.getProductById(pid);
        if (!product) continue;
        const movements = await movementRepo.getMovementsByProduct(pid);
        const prices = await priceRepo.getPriceHistory(pid, 5000);

        let firstMovementDate = movements.length > 0
          ? movements.reduce((min, m) => m.date < min ? m.date : min, movements[0].date)
          : '';

        if (!firstMovementDate) {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 1);
          firstMovementDate = d.toISOString().slice(0, 10);
        }

        const fromDate = desde || firstMovementDate;
        const toDate = hasta;

        const priceData = prices.map(p => ({ date: p.date, price: p.price, source: p.source }));
        const series = computeProductSeries(movements as any, priceData, fromDate, toDate);

        result.push({
          productId: pid,
          name: product.name,
          series: series.map(s => ({
            date: s.date,
            price: s.price,
            units: s.units,
            value: s.value,
            invested: s.invested,
            source: s.source,
          })),
        });
      }

      res.json({ products: result });
    } catch (err: any) {
      console.error('Error en /api/inversiones/series:', err.message);
      res.status(500).json({ error: 'Error al obtener las series' });
    }
  });

  // === Histórico de precios por producto ===
  app.post('/api/prices/:productId/history', async (req, res) => {
    const productId = paramInt(req, 'productId');
    const result = await downloadProductHistory(productId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ ok: true, count: result.count });
  });

  app.post('/api/prices/:productId/import-csv', async (req, res) => {
    const productId = paramInt(req, 'productId');
    const csvText = typeof req.body === 'string' ? req.body : req.body?.csv || '';
    const result = await importCsvHistory(productId, csvText);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ ok: true, count: result.count });
  });

  app.post('/api/prices/:productId/update', async (req, res) => {
    const productId = paramInt(req, 'productId');
    const result = await updateProductPrice(productId);
    res.json(result);
  });

  app.delete('/api/prices/:priceId', async (req, res) => {
    await priceRepo.deletePrice(paramInt(req, 'priceId'));
    res.json({ ok: true });
  });

  // === Estático (client compilado) ===
  const clientDist = path.resolve(process.cwd(), 'client', 'dist');
  app.use(express.static(clientDist));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) {
        res.status(404).json({ error: 'Cliente no compilado. Ejecuta npm run build.' });
      }
    });
  });

  const server = createHttpServer(app);
  server.listen(PORT, () => {
    console.log(`Mi Patrimonio escuchando en el puerto ${PORT}`);
    // Actualizar precios al arrancar (en segundo plano, sin bloquear)
    setTimeout(() => {
      updateAllPrices().catch(err => console.error('Error en actualización inicial de precios:', err.message));
    }, 5000);
  });

  setInterval(() => {
    updateAllPrices().catch(err => console.error('Error en actualización programada de precios:', err.message));
  }, 4 * 60 * 60 * 1000);
}

main().catch(err => {
  console.error('Error fatal al arrancar:', err);
  process.exit(1);
});

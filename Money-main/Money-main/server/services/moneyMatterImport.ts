import { unzipSync, strFromU8 } from 'fflate';
import * as accountRepo from '../repositories/accountRepo';
import * as categoryRepo from '../repositories/categoryRepo';
import * as tagRepo from '../repositories/tagRepo';
import * as transactionRepo from '../repositories/transactionRepo';
import * as productRepo from '../repositories/productRepo';
import * as movementRepo from '../repositories/movementRepo';
import * as priceRepo from '../repositories/priceRepo';
import { getDb, scheduleSave } from '../db/database';
import { createBackup } from './backupService';

interface MMAccount {
  id: string;
  name: string;
  currencyCode: string;
  initialBalance: number;
  currentBalance: number;
  status: string;
  accountCategory: string;
  excludeFromStats?: boolean;
}

interface MMCategory {
  id: string;
  name: string;
  color: string;
  parentId?: string | null;
  type?: string;
}

interface MMTag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface MMTransaction {
  id: string;
  transactionType: string;
  amount: number;
  time: string;
  accountId: string;
  categoryId?: string | null;
  note?: string;
  transferNature: string;
  transferId?: string | null;
}

interface MMPortfolioTransfer {
  transactionId?: string;
  toPortfolioId: string;
  isAdjustment?: boolean;
}

interface MMPortfolio {
  id: string;
  name: string;
}

interface MMSecurity {
  id: string;
  name: string;
  symbol?: string;
  currencyCode?: string;
}

interface MMInvestmentTx {
  id: string;
  securityId: string;
  category: string;
  date: string;
  quantity: number;
  amount: number;
  fees: number;
  portfolioId: string;
}

interface MMPortfolioBalance {
  portfolioId: string;
  totalCash: number;
}

interface MMHolding {
  portfolioId: string;
  securityId: string;
  quantity: number;
  costBasis: number;
}

interface ImportPreview {
  formatVersion: number | null;
  warnings: string[];
  errors: { row: string; error: string }[];
  counts: {
    accounts: number;
    categories: number;
    tags: number;
    transactions: number;
    transfers: number;
    products: number;
    movements: number;
    cashProducts: number;
  };
  totals: {
    income: number;
    expenses: number;
  };
  dateRange: { min: string | null; max: string | null };
  balanceChecks: { account: string; expected: number; calculated: number; diff: number }[];
  holdingsChecks: { portfolio: string; security: string; unitsMatch: boolean; costMatch: boolean }[];
  parsedData: ParsedData;
}

interface ParsedData {
  accounts: ParsedAccount[];
  categories: ParsedCategory[];
  tags: ParsedTag[];
  transactions: ParsedTransaction[];
  transfers: ParsedTransfer[];
  products: ParsedProduct[];
  movements: ParsedMovement[];
  cashProducts: ParsedCashProduct[];
  tagLinks: { txId: string; tagId: string }[];
}

interface ParsedAccount {
  externalId: string;
  name: string;
  currency: string;
  initialBalance: number;
  currentBalance: number;
  archived: boolean;
  type: string;
  excludeFromNetWorth: boolean;
}

interface ParsedCategory {
  externalId: string;
  name: string;
  color: string;
  parentExternalId: string | null;
}

interface ParsedTag {
  externalId: string;
  name: string;
  color: string;
  description: string;
}

interface ParsedTransaction {
  externalId: string;
  type: string;
  amount: number;
  date: string;
  accountExternalId: string;
  categoryExternalId: string | null;
  note: string;
  isFuture: boolean;
}

interface ParsedTransfer {
  externalId: string;
  amount: number;
  date: string;
  fromAccountExternalId: string;
  toAccountExternalId: string;
  note: string;
  categoryExternalId: string | null;
}

interface ParsedProduct {
  externalId: string;
  name: string;
  type: string;
  currency: string;
  priceSource: string | null;
  ticker: string | null;
}

interface ParsedMovement {
  externalId: string;
  productExternalId: string;
  type: string;
  date: string;
  units: number | null;
  amountEur: number;
  fee: number;
  portfolio: string | null;
  isFuture: boolean;
}

interface ParsedCashProduct {
  name: string;
  amount: number;
  date: string;
  portfolio: string;
}

function safeParseJson(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

function convertUtcToMadridDate(utcIso: string): string {
  const d = new Date(utcIso);
  const madridStr = d.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
  return madridStr.slice(0, 10);
}

function dateOnly(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function classifySecurityType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('etc')) return 'materia_prima';
  if (lower.includes('bitcoin') || lower.includes('btc')) return 'cripto';
  return 'fondo';
}

export function parseMoneyMatterZip(zipBuffer: Buffer): ImportPreview {
  const warnings: string[] = [];
  const errors: { row: string; error: string }[] = [];

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(zipBuffer));
  } catch {
    return {
      formatVersion: null,
      warnings: ['No se pudo descomprimir el ZIP'],
      errors: [],
      counts: { accounts: 0, categories: 0, tags: 0, transactions: 0, transfers: 0, products: 0, movements: 0, cashProducts: 0 },
      totals: { income: 0, expenses: 0 },
      dateRange: { min: null, max: null },
      balanceChecks: [],
      holdingsChecks: [],
      parsedData: { accounts: [], categories: [], tags: [], transactions: [], transfers: [], products: [], movements: [], cashProducts: [], tagLinks: [] },
    };
  }

  const getFile = (path: string): any => {
    const key = Object.keys(files).find(k => k.endsWith(path) || k === path);
    if (!key) return null;
    return safeParseJson(strFromU8(files[key]));
  };

  const manifest = getFile('manifest.json');
  const formatVersion = manifest?.formatVersion ?? null;
  if (formatVersion !== 1) {
    warnings.push(`Versión del formato: ${formatVersion ?? 'desconocida'}. Se esperaba 1. Se intentará importar de todas formas.`);
  }

  const accountsJson: MMAccount[] = getFile('data/accounts.json') || [];
  const categoriesJson: MMCategory[] = getFile('data/categories.json') || [];
  const tagsJson: MMTag[] = getFile('data/tags.json') || [];
  const transactionsJson: MMTransaction[] = getFile('data/transactions.json') || [];
  const txTagsJson: any[] = getFile('data/transaction-tags.json') || [];
  const portfolioTransfers: MMPortfolioTransfer[] = getFile('data/portfolios-transfers.json') || [];
  const portfolios: MMPortfolio[] = getFile('data/portfolios.json') || [];
  const securities: MMSecurity[] = getFile('reference/securities.json') || [];
  const investmentTxs: MMInvestmentTx[] = getFile('data/investment-transactions.json') || [];
  const portfolioBalances: MMPortfolioBalance[] = getFile('data/portfolio-balances.json') || [];
  const holdings: MMHolding[] = getFile('data/holdings.json') || [];

  const portfolioName = (id: string) => portfolios.find(p => p.id === id)?.name || id;

  // Parse accounts.
  // Note: If transactions exist for the account, initial balance from MoneyMatter is set to 0 to prevent double-counting
  // initial balance on top of the imported transaction stream.
  const accountHasTxs = new Set(transactionsJson.map(t => t.accountId));

  const parsedAccounts: ParsedAccount[] = accountsJson.map((a) => {
    let type = 'corriente';
    if (a.accountCategory === 'cash') type = 'efectivo';
    else if (a.accountCategory === 'investment') type = 'inversión';

    // Avoid double counting initial balance when full transaction history is imported
    const hasTxs = accountHasTxs.has(a.id);
    const initialBalance = hasTxs ? 0 : a.initialBalance / 100;

    return {
      externalId: a.id,
      name: a.name,
      currency: a.currencyCode || 'EUR',
      initialBalance,
      currentBalance: a.currentBalance / 100,
      archived: a.status === 'archived',
      type,
      excludeFromNetWorth: !!a.excludeFromStats,
    };
  });

  // Parse categories
  const parsedCategories: ParsedCategory[] = categoriesJson.map((c) => ({
    externalId: c.id,
    name: c.name,
    color: c.color || '#6b7280',
    parentExternalId: c.parentId || null,
  }));

  // Parse tags
  const parsedTags: ParsedTag[] = tagsJson.map((t) => ({
    externalId: t.id,
    name: t.name,
    color: t.color || '#6b7280',
    description: t.description || '',
  }));

  const tagLinks = txTagsJson.map((tl: any) => ({ txId: tl.transactionId, tagId: tl.tagId }));

  // Group transactions by transferId
  const transferGroups = new Map<string, MMTransaction[]>();
  const normalTxs: MMTransaction[] = [];

  for (const tx of transactionsJson) {
    if (tx.transferNature === 'transfer_between_user_accounts' && tx.transferId) {
      const group = transferGroups.get(tx.transferId) || [];
      group.push(tx);
      transferGroups.set(tx.transferId, group);
    } else {
      normalTxs.push(tx);
    }
  }

  const parsedTransactions: ParsedTransaction[] = [];
  const parsedTransfers: ParsedTransfer[] = [];

  const today = new Date().toISOString().slice(0, 10);
  let totalIncome = 0;
  let totalExpenses = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  const updateDateRange = (d: string) => {
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  };

  // Process transfers between user accounts
  for (const [transferId, group] of transferGroups) {
    if (group.length !== 2) {
      errors.push({ row: `transferId ${transferId}`, error: `Se esperaban 2 filas, se encontraron ${group.length}` });
      for (const tx of group) {
        const date = convertUtcToMadridDate(tx.time);
        const amount = Math.abs(tx.amount / 100);
        if (tx.transactionType === 'expense') totalExpenses += amount;
        else totalIncome += amount;
        parsedTransactions.push({
          externalId: tx.id,
          type: tx.transactionType === 'expense' ? 'gasto' : 'ingreso',
          amount,
          date,
          accountExternalId: tx.accountId,
          categoryExternalId: tx.categoryId || null,
          note: tx.note || '',
          isFuture: date > today,
        });
        updateDateRange(date);
      }
      continue;
    }

    const expense = group.find(t => t.transactionType === 'expense');
    const income = group.find(t => t.transactionType === 'income');
    if (!expense || !income) {
      errors.push({ row: `transferId ${transferId}`, error: 'Falta la fila de gasto o ingreso' });
      continue;
    }

    const amount = Math.abs(expense.amount / 100);
    const date = convertUtcToMadridDate(expense.time);
    parsedTransfers.push({
      externalId: `transfer-${transferId}`,
      amount,
      date,
      fromAccountExternalId: expense.accountId,
      toAccountExternalId: income.accountId,
      note: expense.note || income.note || '',
      categoryExternalId: expense.categoryId || null,
    });
    updateDateRange(date);
  }

  // Process transfer_to_portfolio
  for (const tx of transactionsJson) {
    if (tx.transferNature !== 'transfer_to_portfolio') continue;

    const pfTransfer = portfolioTransfers.find(pt => pt.transactionId === tx.id);
    if (!pfTransfer) {
      warnings.push(`Transacción ${tx.id} con transfer_to_portfolio sin portfolio-transfer correspondiente`);
      continue;
    }

    const portfolio = portfolios.find(p => p.id === pfTransfer.toPortfolioId);
    if (!portfolio) {
      warnings.push(`Portfolio ${pfTransfer.toPortfolioId} no encontrado para transacción ${tx.id}`);
      continue;
    }

    const amount = Math.abs(tx.amount / 100);
    const date = convertUtcToMadridDate(tx.time);

    const existingAccount = parsedAccounts.find(a => a.name === portfolio.name && a.type === 'inversión');
    if (!existingAccount) {
      parsedAccounts.push({
        externalId: `portfolio-${portfolio.id}`,
        name: portfolio.name,
        currency: 'EUR',
        initialBalance: 0,
        currentBalance: 0,
        archived: false,
        type: 'inversión',
        excludeFromNetWorth: true,
      });
    }

    parsedTransfers.push({
      externalId: `portfolio-transfer-${tx.id}`,
      amount,
      date,
      fromAccountExternalId: tx.accountId,
      toAccountExternalId: `portfolio-${portfolio.id}`,
      note: tx.note || `Transferencia a ${portfolio.name}`,
      categoryExternalId: null,
    });
    updateDateRange(date);
  }

  // Process transfer_out_wallet (no pair, import as normal with tag)
  const externalTagName = 'Transferencia externa';
  let hasExternalTransferTag = parsedTags.some(t => t.name === externalTagName);
  if (!hasExternalTransferTag) {
    parsedTags.push({
      externalId: 'auto-external-transfer-tag',
      name: externalTagName,
      color: '#f59e0b',
      description: 'Transferencias externas desde MoneyMatter',
    });
  }

  for (const tx of transactionsJson) {
    if (tx.transferNature !== 'transfer_out_wallet') continue;
    const date = convertUtcToMadridDate(tx.time);
    const type = tx.transactionType === 'expense' ? 'gasto' : 'ingreso';
    const rawAmount = Math.abs(tx.amount / 100);
    const signedAmount = type === 'gasto' ? -rawAmount : rawAmount;
    if (type === 'gasto') totalExpenses += rawAmount;
    else totalIncome += rawAmount;

    parsedTransactions.push({
      externalId: tx.id,
      type,
      amount: signedAmount,
      date,
      accountExternalId: tx.accountId,
      categoryExternalId: tx.categoryId || null,
      note: tx.note || '',
      isFuture: date > today,
    });
    tagLinks.push({ txId: tx.id, tagId: 'auto-external-transfer-tag' });
    updateDateRange(date);
  }

  // Process normal transactions (not_transfer)
  for (const tx of normalTxs) {
    if (tx.transferNature !== 'not_transfer') continue;
    const date = convertUtcToMadridDate(tx.time);
    const type = tx.transactionType === 'expense' ? 'gasto' : 'ingreso';
    const rawAmount = Math.abs(tx.amount / 100);
    const signedAmount = type === 'gasto' ? -rawAmount : rawAmount;
    if (type === 'gasto') totalExpenses += rawAmount;
    else totalIncome += rawAmount;

    parsedTransactions.push({
      externalId: tx.id,
      type,
      amount: signedAmount,
      date,
      accountExternalId: tx.accountId,
      categoryExternalId: tx.categoryId || null,
      note: tx.note || '',
      isFuture: date > today,
    });
    updateDateRange(date);
  }

  // Check for adjustment-only portfolio transfers
  for (const pt of portfolioTransfers) {
    if (pt.isAdjustment && !pt.transactionId) {
      warnings.push(`Portfolio-transfer con isAdjustment=true y sin transacción (portfolio: ${portfolioName(pt.toPortfolioId)}). Ignorada.`);
    }
  }

  // Parse securities as products
  const parsedProducts: ParsedProduct[] = securities.map((s) => ({
    externalId: s.id,
    name: s.name,
    type: classifySecurityType(s.name),
    currency: s.currencyCode || 'EUR',
    priceSource: s.symbol ? 'yahoo' : null,
    ticker: s.symbol || null,
  }));

  // Parse investment transactions as movements
  const parsedMovements: ParsedMovement[] = [];
  for (const itx of investmentTxs) {
    let type = 'compra';
    if (itx.category === 'buy') type = 'compra';
    else if (itx.category === 'sell') type = 'venta';
    else if (itx.category === 'dividend') type = 'dividendo';
    else if (itx.category === 'fee' || itx.category === 'commission') type = 'comision';
    else {
      warnings.push(`Movimiento de inversión ${itx.id} con categoría desconocida: ${itx.category}. Importado como compra.`);
    }

    const date = dateOnly(itx.date);
    parsedMovements.push({
      externalId: itx.id,
      productExternalId: itx.securityId,
      type,
      date,
      units: itx.quantity != null ? Math.round(itx.quantity * 1e6) / 1e6 : null,
      amountEur: itx.amount,
      fee: itx.fees || 0,
      portfolio: portfolioName(itx.portfolioId),
      isFuture: date > today,
    });
    updateDateRange(date);
  }

  // Parse cash products from portfolio balances only if there are no transfers into investment accounts
  // that already account for cash to prevent duplicate net worth inflation.
  const exportedAt = manifest?.exportedAt ? dateOnly(manifest.exportedAt) : today;
  const parsedCashProducts: ParsedCashProduct[] = [];
  const hasPfTransfers = portfolioTransfers.length > 0;

  if (!hasPfTransfers) {
    for (const pb of portfolioBalances) {
      if (pb.totalCash > 0.5) {
        const name = `Efectivo en ${portfolioName(pb.portfolioId)}`;
        parsedCashProducts.push({
          name,
          amount: pb.totalCash,
          date: exportedAt,
          portfolio: portfolioName(pb.portfolioId),
        });
      }
    }
  }

  // Balance checks
  const balanceChecks = parsedAccounts.map((a) => {
    const accTxs = parsedTransactions.filter(t => t.accountExternalId === a.externalId);
    const transfersOut = parsedTransfers.filter(t => t.fromAccountExternalId === a.externalId);
    const transfersIn = parsedTransfers.filter(t => t.toAccountExternalId === a.externalId);
    let calculated = a.initialBalance;
    for (const t of accTxs) {
      calculated += t.amount;
    }
    for (const t of transfersOut) calculated -= t.amount;
    for (const t of transfersIn) calculated += t.amount;
    return { account: a.name, expected: a.currentBalance, calculated, diff: a.currentBalance - calculated };
  });

  // Holdings checks
  const holdingsChecks = holdings.map((h) => {
    const portfolio = portfolioName(h.portfolioId);
    const security = securities.find(s => s.id === h.securityId);
    const securityName = security?.name || h.securityId;
    const relevantMovements = parsedMovements.filter(
      m => m.productExternalId === h.securityId && m.portfolio === portfolio
    );
    let units = 0;
    let cost = 0;
    for (const m of relevantMovements) {
      if (m.type === 'compra') { units += m.units || 0; cost += m.amountEur; }
      else if (m.type === 'venta') { units -= m.units || 0; cost -= m.amountEur; }
    }
    return {
      portfolio,
      security: securityName,
      unitsMatch: Math.abs(units - h.quantity) < 0.0001,
      costMatch: Math.abs(cost - h.costBasis) < 0.01,
    };
  });

  return {
    formatVersion,
    warnings,
    errors,
    counts: {
      accounts: parsedAccounts.length,
      categories: parsedCategories.length,
      tags: parsedTags.length,
      transactions: parsedTransactions.length,
      transfers: parsedTransfers.length,
      products: parsedProducts.length,
      movements: parsedMovements.length,
      cashProducts: parsedCashProducts.length,
    },
    totals: { income: totalIncome, expenses: totalExpenses },
    dateRange: { min: minDate, max: maxDate },
    balanceChecks,
    holdingsChecks,
    parsedData: {
      accounts: parsedAccounts,
      categories: parsedCategories,
      tags: parsedTags,
      transactions: parsedTransactions,
      transfers: parsedTransfers,
      products: parsedProducts,
      movements: parsedMovements,
      cashProducts: parsedCashProducts,
      tagLinks,
    },
  };
}

export async function executeMoneyMatterImport(preview: ImportPreview): Promise<{ imported: boolean; errors: string[] }> {
  const errors: string[] = [];
  const data = preview.parsedData;

  await createBackup('pre-moneymatter-import');

  const db = await getDb();

  // Create import batch record
  const batchId = `mm-${Date.now()}`;
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [`import_batch_${batchId}`, new Date().toISOString()]);
  scheduleSave();

  const externalIdMap = (table: string) => {
    const result = db.exec(`SELECT id_externo, entidad_id FROM external_ids WHERE tabla = ?`, [table]);
    const map = new Map<string, number>();
    if (result.length > 0) {
      for (const row of result[0].values) {
        map.set(row[0] as string, row[1] as number);
      }
    }
    return map;
  };

  const storeExternalId = (table: string, externalId: string, entityId: number) => {
    db.run(`INSERT OR REPLACE INTO external_ids (tabla, id_externo, entidad_id, origen) VALUES (?, ?, ?, ?)`, [table, externalId, entityId, 'moneymatter']);
    scheduleSave();
  };

  // Ensure external_ids table exists
  db.run(`CREATE TABLE IF NOT EXISTS external_ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT NOT NULL,
    id_externo TEXT NOT NULL,
    entidad_id INTEGER NOT NULL,
    origen TEXT NOT NULL DEFAULT 'moneymatter',
    UNIQUE(tabla, id_externo)
  )`);

  // Import categories
  const catMap = new Map<string, number>();
  const existingCats = externalIdMap('categories');
  for (const cat of data.categories) {
    if (existingCats.has(cat.externalId)) {
      catMap.set(cat.externalId, existingCats.get(cat.externalId)!);
      continue;
    }
    const parentId = cat.parentExternalId ? catMap.get(cat.parentExternalId) || null : null;
    const id = await categoryRepo.createCategory({ name: cat.name, color: cat.color, parent_id: parentId });
    catMap.set(cat.externalId, id);
    storeExternalId('categories', cat.externalId, id);
  }

  // Import tags
  const tagMap = new Map<string, number>();
  const existingTags = externalIdMap('tags');
  const allTags = await tagRepo.getAllTags();
  for (const tag of data.tags) {
    if (existingTags.has(tag.externalId)) {
      tagMap.set(tag.externalId, existingTags.get(tag.externalId)!);
      continue;
    }
    const existing = allTags.find(t => t.name === tag.name);
    if (existing) {
      tagMap.set(tag.externalId, existing.id);
      storeExternalId('tags', tag.externalId, existing.id);
      continue;
    }
    const id = await tagRepo.createTag(tag.name, tag.color);
    tagMap.set(tag.externalId, id);
    storeExternalId('tags', tag.externalId, id);
  }

  // Import accounts
  const accMap = new Map<string, number>();
  const existingAccounts = externalIdMap('accounts');
  for (const acc of data.accounts) {
    if (existingAccounts.has(acc.externalId)) {
      accMap.set(acc.externalId, existingAccounts.get(acc.externalId)!);
      continue;
    }
    const id = await accountRepo.createAccount({
      name: acc.name,
      currency: acc.currency,
      initial_balance: acc.initialBalance,
      color: '#3b82f6',
      type: acc.type,
      archived: acc.archived ? 1 : 0,
      exclude_from_net_worth: acc.excludeFromNetWorth ? 1 : 0,
    });
    accMap.set(acc.externalId, id);
    storeExternalId('accounts', acc.externalId, id);
  }

  // Import products
  const productMap = new Map<string, number>();
  const existingProducts = externalIdMap('products');
  for (const prod of data.products) {
    if (existingProducts.has(prod.externalId)) {
      productMap.set(prod.externalId, existingProducts.get(prod.externalId)!);
      continue;
    }
    const id = await productRepo.createProduct({
      name: prod.name,
      type: prod.type,
      isin: null,
      ticker: prod.ticker,
      currency: prod.currency,
      price_source: prod.priceSource,
      ter: null,
      risk: null,
      category: null,
    });
    productMap.set(prod.externalId, id);
    storeExternalId('products', prod.externalId, id);
  }

  // Import cash products
  for (const cash of data.cashProducts) {
    const existing = await productRepo.getAllProductsWithArchived();
    let product = existing.find(p => p.name === cash.name);
    if (!product) {
      const id = await productRepo.createProduct({
        name: cash.name,
        type: 'cuenta_efectivo',
        isin: null,
        ticker: null,
        currency: 'EUR',
        price_source: null,
        ter: null,
        risk: null,
        category: null,
      });
      product = await productRepo.getProductById(id);
    }
    if (product) {
      await priceRepo.upsertValuation(product.id, cash.amount, cash.date, 'Importación MoneyMatter');
    }
  }

  // Import transactions
  const txMap = new Map<string, number>();
  const existingTxs = externalIdMap('transactions');
  for (const tx of data.transactions) {
    if (existingTxs.has(tx.externalId)) {
      txMap.set(tx.externalId, existingTxs.get(tx.externalId)!);
      continue;
    }
    const accountId = accMap.get(tx.accountExternalId);
    if (!accountId) {
      errors.push(`Transacción ${tx.externalId}: cuenta ${tx.accountExternalId} no encontrada`);
      continue;
    }
    const categoryId = tx.categoryExternalId ? catMap.get(tx.categoryExternalId) || null : null;

    const tagNames: string[] = [];
    for (const link of data.tagLinks) {
      if (link.txId === tx.externalId) {
        const tagId = tagMap.get(link.tagId);
        if (tagId) {
          const allTags2 = await tagRepo.getAllTags();
          const tag = allTags2.find(t => t.id === tagId);
          if (tag) tagNames.push(tag.name);
        }
      }
    }

    const id = await transactionRepo.createTransaction({
      type: tx.type,
      date: tx.date,
      amount: tx.amount,
      account_id: accountId,
      to_account_id: null,
      to_amount: null,
      note: tx.note || null,
      tags: tagNames.length > 0 ? tagNames.join(',') : null,
      category_id: categoryId,
    });
    txMap.set(tx.externalId, id);
    storeExternalId('transactions', tx.externalId, id);
  }

  // Import transfers
  const existingTransfers = externalIdMap('transfers');
  for (const transfer of data.transfers) {
    if (existingTransfers.has(transfer.externalId)) continue;
    const fromId = accMap.get(transfer.fromAccountExternalId);
    const toId = accMap.get(transfer.toAccountExternalId);
    if (!fromId || !toId) {
      errors.push(`Transferencia ${transfer.externalId}: cuenta origen o destino no encontrada`);
      continue;
    }
    const categoryId = transfer.categoryExternalId ? catMap.get(transfer.categoryExternalId) || null : null;

    const fromTxId = await transactionRepo.createTransaction({
      type: 'transferencia',
      date: transfer.date,
      amount: -transfer.amount,
      account_id: fromId,
      to_account_id: toId,
      to_amount: transfer.amount,
      note: transfer.note || null,
      tags: null,
      category_id: categoryId,
    });
    const toTxId = await transactionRepo.createTransaction({
      type: 'transferencia',
      date: transfer.date,
      amount: transfer.amount,
      account_id: toId,
      to_account_id: fromId,
      to_amount: transfer.amount,
      note: transfer.note || null,
      tags: null,
      linked_transfer_id: fromTxId,
      category_id: categoryId,
    });
    await transactionRepo.updateTransaction(fromTxId, { linked_transfer_id: toTxId });
    storeExternalId('transfers', transfer.externalId, fromTxId);
  }

  // Import investment movements
  const existingMovements = externalIdMap('movements');
  for (const mov of data.movements) {
    if (existingMovements.has(mov.externalId)) continue;
    const productId = productMap.get(mov.productExternalId);
    if (!productId) {
      errors.push(`Movimiento ${mov.externalId}: producto ${mov.productExternalId} no encontrado`);
      continue;
    }
    const id = await movementRepo.createMovement({
      product_id: productId,
      type: mov.type,
      date: mov.date,
      units: mov.units,
      amount_eur: mov.amountEur,
      fee: mov.fee,
      note: null,
      portfolio: mov.portfolio,
    });
    storeExternalId('movements', mov.externalId, id);
  }

  return { imported: true, errors };
}

export async function undoImportBatch(batchId: string): Promise<boolean> {
  return false;
}

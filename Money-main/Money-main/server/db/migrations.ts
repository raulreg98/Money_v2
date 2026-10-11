export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        isin TEXT,
        ticker TEXT,
        currency TEXT NOT NULL DEFAULT 'EUR',
        price_source TEXT,
        ter REAL,
        risk REAL,
        category TEXT,
        manual_price INTEGER NOT NULL DEFAULT 0,
        long_term INTEGER NOT NULL DEFAULT 1,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS product_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        price REAL NOT NULL,
        currency TEXT NOT NULL,
        source TEXT,
        date TEXT NOT NULL,
        UNIQUE(product_id, date),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        units REAL,
        amount_eur REAL NOT NULL,
        fee REAL DEFAULT 0,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(date);
      CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS valuations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        value_eur REAL NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(product_id, date),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_valuations_product ON valuations(product_id);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        initial_balance REAL NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        type TEXT NOT NULL DEFAULT 'corriente',
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        account_id INTEGER NOT NULL,
        to_account_id INTEGER,
        to_amount REAL,
        note TEXT,
        tags TEXT,
        linked_transfer_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6b7280',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chart_widgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        chart_type TEXT NOT NULL DEFAULT 'bar',
        metric TEXT NOT NULL DEFAULT 'gastos',
        group_by TEXT NOT NULL DEFAULT 'mes',
        period TEXT NOT NULL DEFAULT '3m',
        custom_from TEXT,
        custom_to TEXT,
        account_filter TEXT,
        tag_filter TEXT,
        pinned INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        currency TEXT NOT NULL UNIQUE,
        rate REAL NOT NULL,
        date TEXT NOT NULL,
        source TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6b7280',
        parent_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

      ALTER TABLE transactions ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
      ALTER TABLE accounts ADD COLUMN exclude_from_net_worth INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE movements ADD COLUMN portfolio TEXT;
    `,
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS exchange_rate_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        currency TEXT NOT NULL,
        rate_to_eur REAL NOT NULL,
        source TEXT,
        UNIQUE(date, currency)
      );

      CREATE INDEX IF NOT EXISTS idx_exrate_history_date ON exchange_rate_history(date);

      ALTER TABLE products ADD COLUMN alt_source TEXT;
      ALTER TABLE products ADD COLUMN alt_symbol TEXT;
    `,
  },
  {
    version: 7,
    sql: `
      ALTER TABLE chart_widgets ADD COLUMN default_key TEXT;
      ALTER TABLE chart_widgets ADD COLUMN size INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE categories ADD COLUMN icon TEXT;
    `,
  },
  {
    version: 8,
    sql: `
      ALTER TABLE products ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
    `,
  },
  {
    version: 9,
    sql: `
      ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 10,
    sql: `
      ALTER TABLE products ADD COLUMN color TEXT;
      ALTER TABLE products ADD COLUMN country_breakdown TEXT;
      ALTER TABLE products ADD COLUMN sector_breakdown TEXT;
      ALTER TABLE products ADD COLUMN top_holdings TEXT;
    `,
  },
  {
    version: 11,
    sql: `
      ALTER TABLE products ADD COLUMN alias TEXT;
    `,
  },
];

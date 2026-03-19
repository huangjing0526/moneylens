import type { TursoClient } from './turso-client';

export async function initSchema(db: TursoClient) {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_income INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      category_slug TEXT NOT NULL,
      source TEXT DEFAULT 'default' CHECK(source IN ('default', 'user', 'learned')),
      priority INTEGER DEFAULT 0,
      FOREIGN KEY (category_slug) REFERENCES categories(slug)
    )`,
    `CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      source TEXT NOT NULL,
      total_count INTEGER DEFAULT 0,
      imported_count INTEGER DEFAULT 0,
      duplicate_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL CHECK(source IN ('alipay', 'wechat', 'bank', 'manual', 'ocr')),
      source_id TEXT,
      date TEXT NOT NULL,
      time TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      description TEXT NOT NULL,
      counterparty TEXT,
      category_slug TEXT DEFAULT 'uncategorized',
      payment_method TEXT,
      note TEXT,
      is_duplicate INTEGER DEFAULT 0,
      duplicate_of INTEGER,
      import_id INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_slug) REFERENCES categories(slug),
      FOREIGN KEY (import_id) REFERENCES import_history(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_slug)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON transactions(source_id)`,
    `CREATE INDEX IF NOT EXISTS idx_category_rules_keyword ON category_rules(keyword)`,
  ], 'write');
}

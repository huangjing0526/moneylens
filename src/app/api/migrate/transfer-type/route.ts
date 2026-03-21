import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST() {
  const db = await getDb();

  try {
    // Check if migration is needed by looking at the CHECK constraint
    // If 'transfer' type already works, skip migration
    try {
      await db.execute({
        sql: "SELECT COUNT(*) FROM transactions WHERE type = 'transfer' LIMIT 1",
        args: [],
      });
      // If above succeeds, check if we still need to migrate data
    } catch {
      // CHECK constraint doesn't allow 'transfer' yet — need table rebuild
      // SQLite doesn't support ALTER CHECK, so we rebuild the table
      await db.batch([
        // 1. Create new table with updated CHECK constraint
        `CREATE TABLE transactions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL CHECK(source IN ('alipay', 'wechat', 'bank', 'manual', 'ocr')),
          source_id TEXT,
          date TEXT NOT NULL,
          time TEXT,
          amount REAL NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
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
        // 2. Copy data, correcting type for transfer categories
        `INSERT INTO transactions_new (id, source, source_id, date, time, amount, type, description, counterparty, category_slug, payment_method, note, is_duplicate, duplicate_of, import_id, created_at, updated_at)
         SELECT id, source, source_id, date, time, amount,
           CASE WHEN category_slug IN ('transfer', 'transfer_self') THEN 'transfer' ELSE type END,
           description, counterparty, category_slug, payment_method, note, is_duplicate, duplicate_of, import_id, created_at, updated_at
         FROM transactions`,
        // 3. Drop old table and rename
        `DROP TABLE transactions`,
        `ALTER TABLE transactions_new RENAME TO transactions`,
        // 4. Recreate indexes
        `CREATE INDEX idx_transactions_date ON transactions(date)`,
        `CREATE INDEX idx_transactions_category ON transactions(category_slug)`,
        `CREATE INDEX idx_transactions_source_id ON transactions(source_id)`,
      ], 'write');
    }

    // Count how many records were migrated to transfer type
    const result = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM transactions WHERE type = 'transfer'",
      args: [],
    });
    const transferCount = (result.rows[0] as unknown as { cnt: number }).cnt;

    return NextResponse.json({
      success: true,
      message: `Migration complete. ${transferCount} transactions now have type=transfer.`,
      transferCount,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Migration failed: ${(error as Error).message}`,
    }, { status: 500 });
  }
}

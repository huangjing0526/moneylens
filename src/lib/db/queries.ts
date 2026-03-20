import { getDb } from './index';
import type { Transaction, TransactionInput, Category, CategoryRule, ImportHistory } from '@/types';
import type { InValue } from './turso-client';

const STATS_EXCLUDE_SQL = `category_slug NOT IN ('credit_card', 'transfer_self')`;

// ---- Transactions ----

export async function getTransactions(filters?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
  type?: 'income' | 'expense';
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> {
  const db = await getDb();
  const conditions: string[] = ['is_duplicate = 0'];
  const params: InValue[] = [];

  if (filters?.startDate) { conditions.push('date >= ?'); params.push(filters.startDate); }
  if (filters?.endDate) { conditions.push('date <= ?'); params.push(filters.endDate); }
  if (filters?.category) { conditions.push('category_slug = ?'); params.push(filters.category); }
  if (filters?.type) { conditions.push('type = ?'); params.push(filters.type); }
  if (filters?.search) {
    conditions.push('(description LIKE ? OR counterparty LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit ? `LIMIT ${filters.limit}` : '';
  const offset = filters?.offset ? `OFFSET ${filters.offset}` : '';

  const result = await db.execute({
    sql: `SELECT * FROM transactions ${where} ORDER BY date DESC, time DESC ${limit} ${offset}`,
    args: params,
  });
  return result.rows as unknown as Transaction[];
}

export async function getTransactionById(id: number): Promise<Transaction | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql: 'SELECT * FROM transactions WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as Transaction | undefined;
}

export async function insertTransactions(transactions: TransactionInput[], importId?: number): Promise<number[]> {
  const db = await getDb();
  const ids: number[] = [];

  const stmts = transactions.map(t => ({
    sql: `INSERT INTO transactions (source, source_id, date, time, amount, type, description, counterparty, category_slug, payment_method, note, import_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      t.source, t.source_id || null, t.date, t.time || null,
      t.amount, t.type, t.description, t.counterparty || null,
      t.category_slug || 'uncategorized', t.payment_method || null,
      t.note || null, importId || null,
    ] as InValue[],
  }));

  const results = await db.batch(stmts, 'write');
  for (const r of results) {
    ids.push(Number(r.lastInsertRowid));
  }
  return ids;
}

export async function updateTransaction(id: number, updates: Partial<Transaction>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: InValue[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['id', 'created_at'].includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value as InValue);
  }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now', 'localtime')");
  values.push(id);

  await db.execute({
    sql: `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
    args: values,
  });
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM transactions WHERE id = ?', args: [id] });
}

export async function getTransactionCount(filters?: { startDate?: string; endDate?: string }): Promise<number> {
  const db = await getDb();
  const conditions: string[] = ['is_duplicate = 0'];
  const params: InValue[] = [];
  if (filters?.startDate) { conditions.push('date >= ?'); params.push(filters.startDate); }
  if (filters?.endDate) { conditions.push('date <= ?'); params.push(filters.endDate); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.execute({ sql: `SELECT COUNT(*) as cnt FROM transactions ${where}`, args: params });
  return (result.rows[0] as unknown as { cnt: number }).cnt;
}

// ---- Categories ----

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  const result = await db.execute('SELECT * FROM categories ORDER BY is_income, sort_order');
  return result.rows as unknown as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql: 'SELECT * FROM categories WHERE slug = ?', args: [slug] });
  return result.rows[0] as unknown as Category | undefined;
}

// ---- Category Rules ----

export async function getCategoryRules(): Promise<CategoryRule[]> {
  const db = await getDb();
  const result = await db.execute('SELECT * FROM category_rules ORDER BY priority DESC');
  return result.rows as unknown as CategoryRule[];
}

export async function addCategoryRule(keyword: string, categorySlug: string, source: string = 'user'): Promise<void> {
  const db = await getDb();
  const priority = source === 'user' ? 20 : 15;

  // Upsert: update if same keyword+source exists, otherwise insert
  const existing = await db.execute({
    sql: 'SELECT id FROM category_rules WHERE keyword = ? AND source = ?',
    args: [keyword, source],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE category_rules SET category_slug = ?, priority = ? WHERE id = ?',
      args: [categorySlug, priority, (existing.rows[0] as unknown as { id: number }).id],
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO category_rules (keyword, category_slug, source, priority) VALUES (?, ?, ?, ?)',
      args: [keyword, categorySlug, source, priority],
    });
  }
}

// ---- Import History ----

export async function createImportRecord(filename: string, source: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute({
    sql: 'INSERT INTO import_history (filename, source) VALUES (?, ?)',
    args: [filename, source],
  });
  return Number(result.lastInsertRowid);
}

export async function updateImportRecord(id: number, totalCount: number, importedCount: number, duplicateCount: number): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: 'UPDATE import_history SET total_count = ?, imported_count = ?, duplicate_count = ? WHERE id = ?',
    args: [totalCount, importedCount, duplicateCount, id],
  });
}

export async function getImportHistory(): Promise<ImportHistory[]> {
  const db = await getDb();
  const result = await db.execute('SELECT * FROM import_history ORDER BY created_at DESC');
  return result.rows as unknown as ImportHistory[];
}

// ---- Aggregations (excluding internal transfers & credit card repayment) ----

export async function getMonthlySummary(yearMonth: string) {
  const db = await getDb();
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-31`;

  const totals = await db.execute({
    sql: `SELECT type, COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
          WHERE date >= ? AND date <= ? AND is_duplicate = 0 AND ${STATS_EXCLUDE_SQL} GROUP BY type`,
    args: [startDate, endDate],
  });
  const totalsRows = totals.rows as unknown as { type: string; total: number }[];
  const totalIncome = totalsRows.find(t => t.type === 'income')?.total || 0;
  const totalExpense = totalsRows.find(t => t.type === 'expense')?.total || 0;

  const byCat = await db.execute({
    sql: `SELECT t.category_slug as slug, c.name, c.icon, c.color, COALESCE(SUM(ABS(t.amount)), 0) as amount
          FROM transactions t JOIN categories c ON t.category_slug = c.slug
          WHERE t.date >= ? AND t.date <= ? AND t.type = 'expense' AND t.is_duplicate = 0 AND ${STATS_EXCLUDE_SQL}
          GROUP BY t.category_slug ORDER BY amount DESC`,
    args: [startDate, endDate],
  });

  const daily = await db.execute({
    sql: `SELECT date, COALESCE(SUM(ABS(amount)), 0) as amount FROM transactions
          WHERE date >= ? AND date <= ? AND type = 'expense' AND is_duplicate = 0 AND ${STATS_EXCLUDE_SQL}
          GROUP BY date ORDER BY date`,
    args: [startDate, endDate],
  });

  const excluded = await db.execute({
    sql: `SELECT t.category_slug as slug, c.name, c.icon, c.color, COALESCE(SUM(ABS(t.amount)), 0) as amount
          FROM transactions t JOIN categories c ON t.category_slug = c.slug
          WHERE t.date >= ? AND t.date <= ? AND t.is_duplicate = 0 AND t.category_slug IN ('credit_card', 'transfer_self')
          GROUP BY t.category_slug ORDER BY amount DESC`,
    args: [startDate, endDate],
  });

  return {
    totalIncome,
    totalExpense,
    byCategory: byCat.rows as unknown as { slug: string; name: string; icon: string; color: string; amount: number }[],
    dailyExpense: daily.rows as unknown as { date: string; amount: number }[],
    excludedSummary: excluded.rows as unknown as { slug: string; name: string; icon: string; color: string; amount: number }[],
  };
}

export async function getMonthlyTrend(months: number = 6) {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT strftime('%Y-%m', date) as month,
           COALESCE(SUM(CASE WHEN type = 'income' THEN ABS(amount) ELSE 0 END), 0) as income,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) as expense
          FROM transactions
          WHERE date >= date('now', '-' || ? || ' months') AND is_duplicate = 0 AND ${STATS_EXCLUDE_SQL}
          GROUP BY month ORDER BY month`,
    args: [months],
  });
  return result.rows as unknown as { month: string; income: number; expense: number }[];
}

export async function getDailyExpenseHeatmap(startDate: string, endDate: string) {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT date, COALESCE(SUM(ABS(amount)), 0) as amount FROM transactions
          WHERE date >= ? AND date <= ? AND type = 'expense' AND is_duplicate = 0 AND ${STATS_EXCLUDE_SQL}
          GROUP BY date ORDER BY date`,
    args: [startDate, endDate],
  });
  return result.rows as unknown as { date: string; amount: number }[];
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { classifyTransaction } from '@/lib/categories/engine';
import { clearRulesCache } from '@/lib/categories/engine';
import type { TransactionInput } from '@/types';
import type { InStatement } from '@/lib/db/turso-client';

export async function POST(request: NextRequest) {
  clearRulesCache();
  const db = await getDb();

  const params = request.nextUrl.searchParams;
  const all = params.get('all') === 'true';

  const whereClause = all
    ? "WHERE source != 'manual'"
    : "WHERE category_slug = 'uncategorized'";

  const rowsResult = await db.execute(
    `SELECT id, description, counterparty, source, category_slug FROM transactions ${whereClause}`
  );
  const rows = rowsResult.rows as unknown as { id: number; description: string; counterparty: string | null; source: string; category_slug: string }[];

  const learnedResult = await db.execute("SELECT keyword FROM category_rules WHERE source = 'learned'");
  const learnedKeys = new Set(
    (learnedResult.rows as unknown as { keyword: string }[]).map(r => r.keyword)
  );

  const updates: InStatement[] = [];
  for (const row of rows) {
    if (learnedKeys.has(row.counterparty || '') || learnedKeys.has(row.description.slice(0, 10))) {
      continue;
    }

    const slug = await classifyTransaction({
      description: row.description,
      counterparty: row.counterparty,
      source: row.source as TransactionInput['source'],
      date: '',
      amount: 0,
      type: 'expense',
    });

    if (slug !== row.category_slug) {
      updates.push({
        sql: "UPDATE transactions SET category_slug = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
        args: [slug, row.id],
      });
    }
  }

  if (updates.length > 0) {
    // Batch in chunks of 100
    for (let i = 0; i < updates.length; i += 100) {
      await db.batch(updates.slice(i, i + 100), 'write');
    }
  }

  return NextResponse.json({ total: rows.length, updated: updates.length });
}

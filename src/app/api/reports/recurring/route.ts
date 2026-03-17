import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { RecurringExpense } from '@/types';

export async function GET() {
  const db = await getDb();

  const result = await db.execute(`
    WITH monthly AS (
      SELECT
        COALESCE(counterparty, description) as key,
        description,
        counterparty,
        category_slug,
        strftime('%Y-%m', date) as month,
        AVG(ABS(amount)) as avg_amount,
        MIN(ABS(amount)) as min_amount,
        MAX(ABS(amount)) as max_amount,
        COUNT(*) as cnt
      FROM transactions
      WHERE date >= date('now', '-3 months')
        AND type = 'expense'
        AND is_duplicate = 0
      GROUP BY key, month
    )
    SELECT
      key,
      description,
      counterparty,
      category_slug,
      AVG(avg_amount) as averageAmount,
      GROUP_CONCAT(DISTINCT month) as months,
      COUNT(DISTINCT month) as month_count,
      MIN(min_amount) as overall_min,
      MAX(max_amount) as overall_max
    FROM monthly
    GROUP BY key
    HAVING month_count >= 2
      AND (overall_max - overall_min) / NULLIF(AVG(avg_amount), 0) <= 0.05
    ORDER BY averageAmount DESC
  `);

  const recurring = result.rows as unknown as Array<{
    key: string;
    description: string;
    counterparty: string | null;
    category_slug: string;
    averageAmount: number;
    months: string;
    month_count: number;
  }>;

  const mapped: RecurringExpense[] = recurring.map(r => ({
    description: r.description,
    counterparty: r.counterparty,
    averageAmount: Math.round(r.averageAmount * 100) / 100,
    frequency: 'monthly',
    months: r.months.split(','),
    category_slug: r.category_slug,
  }));

  const totalMonthly = mapped.reduce((sum, r) => sum + r.averageAmount, 0);

  return NextResponse.json({ recurring: mapped, totalMonthly });
}

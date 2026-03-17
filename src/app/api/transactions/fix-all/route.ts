import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { InValue } from '@libsql/client';

export async function POST() {
  const db = await getDb();
  const results: string[] = [];

  const refundFix = await db.execute(`
    UPDATE transactions
    SET type = 'income', amount = ABS(amount), category_slug = 'refund',
        updated_at = datetime('now', 'localtime')
    WHERE description LIKE '退款%' AND type = 'expense'
  `);
  results.push(`退款修复: ${refundFix.rowsAffected} 条改为收入`);

  const fixes: { where: string; params: InValue[]; set: Record<string, InValue> }[] = [
    { where: "description LIKE '%飞鹤%' OR description LIKE '%奶粉%'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%婴%' OR description LIKE '%宝宝%'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%曼哈顿手抓球%' OR description LIKE '%牙胶%'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%学饮水杯%' OR description LIKE '%吸管%奶瓶%'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%口水巾%' OR description LIKE '%纱布毛巾%'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%减速带%' OR description LIKE '%减速板%'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%享淘卡%'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%太子参%' OR description LIKE '%中草药%'", params: [], set: { category_slug: 'medical' } },
    { where: "description LIKE '%88VIP%'", params: [], set: { category_slug: 'subscription' } },
    { where: "description LIKE '%红包袋%' OR description LIKE '%利是封%' OR description LIKE '%红包封%'", params: [], set: { category_slug: 'shopping' } },
    { where: "counterparty LIKE '%房东%'", params: [], set: { category_slug: 'housing' } },
    { where: "description LIKE '%一淘%提现%'", params: [], set: { category_slug: 'income_other' } },
    { where: "description LIKE '%经营码%' OR counterparty LIKE '%批发%'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%SaleSmartly%' OR description LIKE '%ADSPOWER%'", params: [], set: { category_slug: 'subscription' } },
    { where: "description LIKE '%LIDI%' OR description LIKE '%黎蒂%'", params: [], set: { category_slug: 'shopping' } },
    { where: "counterparty = '客小妹'", params: [], set: { category_slug: 'food' } },
    { where: "description LIKE '%服饰%' OR counterparty LIKE '%服饰%'", params: [], set: { category_slug: 'shopping' } },
    { where: "counterparty LIKE '%服装%' AND category_slug != 'shopping'", params: [], set: { category_slug: 'shopping' } },
    { where: "description LIKE '%医疗器械%'", params: [], set: { category_slug: 'medical' } },
    { where: "description LIKE '%叮当团%'", params: [], set: { category_slug: 'shopping' } },
    { where: "counterparty LIKE '%甘蔗%'", params: [], set: { category_slug: 'food' } },
  ];

  for (const fix of fixes) {
    const cols = Object.entries(fix.set).map(([k]) => `${k} = ?`).join(', ');
    const vals = [...Object.values(fix.set), ...fix.params];
    const result = await db.execute({
      sql: `UPDATE transactions SET ${cols}, updated_at = datetime('now', 'localtime') WHERE ${fix.where}`,
      args: vals,
    });
    if (result.rowsAffected > 0) {
      results.push(`${fix.where}: ${result.rowsAffected} 条`);
    }
  }

  return NextResponse.json({ results });
}

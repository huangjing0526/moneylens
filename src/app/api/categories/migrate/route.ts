import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST() {
  const db = await getDb();
  const results: string[] = [];

  const hasSelf = await db.execute({ sql: "SELECT id FROM categories WHERE slug = 'transfer_self'", args: [] });
  if (hasSelf.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO categories (slug, name, icon, color, sort_order, is_income) VALUES (?, ?, ?, ?, ?, ?)",
      args: ['transfer_self', '内部转账', 'RefreshCw', '#c7c7cc', 13, 0],
    });
    results.push('新增"内部转账"分类');
  }

  const hasCC = await db.execute({ sql: "SELECT id FROM categories WHERE slug = 'credit_card'", args: [] });
  if (hasCC.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO categories (slug, name, icon, color, sort_order, is_income) VALUES (?, ?, ?, ?, ?, ?)",
      args: ['credit_card', '信用卡还款', 'CreditCard', '#636366', 11, 0],
    });
    results.push('新增"信用卡还款"分类');
  }

  const colorUpdates: Record<string, { color: string; icon?: string }> = {
    'education': { color: '#32ade6' },
    'transfer': { color: '#a2845e' },
    'refund': { color: '#64d2ff' },
    'income_other': { color: '#30db5b' },
    'subscription': { color: '#ff6b6b', icon: 'Repeat' },
  };

  for (const [slug, updates] of Object.entries(colorUpdates)) {
    await db.execute({
      sql: 'UPDATE categories SET color = ?, icon = COALESCE(?, icon) WHERE slug = ?',
      args: [updates.color, updates.icon || null, slug],
    });
  }
  results.push(`颜色修复: ${Object.keys(colorUpdates).length} 个`);

  const selfTransferPatterns = [
    "description LIKE '%余利宝%'",
    "description LIKE '%余额宝%'",
    "description LIKE '%银行卡转入%'",
    "description LIKE '%银行卡定时转入%'",
    "(counterparty LIKE '%网商银行%' AND (description LIKE '%转入%' OR description LIKE '%转账%'))",
    "(counterparty LIKE '%网商银行%' AND description LIKE '%网商银行%')",
  ];

  const selfResult = await db.execute(`
    UPDATE transactions SET category_slug = 'transfer_self', updated_at = datetime('now', 'localtime')
    WHERE category_slug = 'transfer' AND (${selfTransferPatterns.join(' OR ')})
  `);
  results.push(`内部转账重分类: ${selfResult.rowsAffected} 条`);

  const newRules = [
    { keyword: '信用卡还款', category_slug: 'credit_card', priority: 10 },
    { keyword: '还款', category_slug: 'credit_card', priority: 5 },
    { keyword: '信用卡', category_slug: 'credit_card', priority: 8 },
    { keyword: '花呗', category_slug: 'credit_card', priority: 8 },
    { keyword: '白条', category_slug: 'credit_card', priority: 8 },
    { keyword: '零食', category_slug: 'shopping', priority: 8 },
    { keyword: '赵一鸣', category_slug: 'shopping', priority: 10 },
    { keyword: '良品铺子', category_slug: 'shopping', priority: 10 },
    { keyword: '三只松鼠', category_slug: 'shopping', priority: 10 },
    { keyword: '来伊份', category_slug: 'shopping', priority: 10 },
    { keyword: '烟花', category_slug: 'shopping', priority: 8 },
    { keyword: '爆竹', category_slug: 'shopping', priority: 8 },
    { keyword: '白酒', category_slug: 'shopping', priority: 8 },
    { keyword: '汾酒', category_slug: 'shopping', priority: 10 },
    { keyword: '茅台', category_slug: 'shopping', priority: 10 },
    { keyword: '日用', category_slug: 'shopping', priority: 5 },
    { keyword: '百货', category_slug: 'shopping', priority: 5 },
    { keyword: '名创优品', category_slug: 'shopping', priority: 10 },
  ];

  let added = 0;
  for (const r of newRules) {
    const exists = await db.execute({
      sql: 'SELECT id FROM category_rules WHERE keyword = ? AND category_slug = ?',
      args: [r.keyword, r.category_slug],
    });
    if (exists.rows.length === 0) {
      await db.execute({
        sql: 'INSERT INTO category_rules (keyword, category_slug, source, priority) VALUES (?, ?, ?, ?)',
        args: [r.keyword, r.category_slug, 'default', r.priority],
      });
      added++;
    }
  }
  if (added > 0) results.push(`新增规则: ${added} 条`);

  return NextResponse.json({ results });
}

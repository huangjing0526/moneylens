import { NextRequest, NextResponse } from 'next/server';
import { getCategories } from '@/lib/db/queries';
import { getDb } from '@/lib/db';

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, name, icon, color, is_income } = body;

  if (!slug || !name) {
    return NextResponse.json({ error: '分类标识和名称不能为空' }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.execute({ sql: 'SELECT id FROM categories WHERE slug = ?', args: [slug] });
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: '分类标识已存在' }, { status: 400 });
  }

  const maxOrder = await db.execute({
    sql: 'SELECT MAX(sort_order) as m FROM categories WHERE is_income = ?',
    args: [is_income ? 1 : 0],
  });
  const maxVal = (maxOrder.rows[0] as unknown as { m: number | null })?.m || 0;

  await db.execute({
    sql: 'INSERT INTO categories (slug, name, icon, color, sort_order, is_income) VALUES (?, ?, ?, ?, ?, ?)',
    args: [slug, name, icon || 'CircleDashed', color || '#8e8e93', maxVal + 1, is_income ? 1 : 0],
  });

  return NextResponse.json({ success: true });
}

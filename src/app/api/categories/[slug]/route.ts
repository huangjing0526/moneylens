import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { InValue } from '@libsql/client';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json();
  const db = await getDb();

  const fields: string[] = [];
  const values: InValue[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.icon !== undefined) { fields.push('icon = ?'); values.push(body.icon); }
  if (body.color !== undefined) { fields.push('color = ?'); values.push(body.color); }
  if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }

  if (fields.length === 0) {
    return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
  }

  values.push(slug);
  await db.execute({
    sql: `UPDATE categories SET ${fields.join(', ')} WHERE slug = ?`,
    args: values,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();

  if (['uncategorized'].includes(slug)) {
    return NextResponse.json({ error: '不能删除系统分类' }, { status: 400 });
  }

  await db.batch([
    { sql: "UPDATE transactions SET category_slug = 'uncategorized' WHERE category_slug = ?", args: [slug] },
    { sql: 'DELETE FROM category_rules WHERE category_slug = ?', args: [slug] },
    { sql: 'DELETE FROM categories WHERE slug = ?', args: [slug] },
  ], 'write');

  return NextResponse.json({ success: true });
}

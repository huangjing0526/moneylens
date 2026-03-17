import { NextRequest, NextResponse } from 'next/server';
import { getTransactionById, updateTransaction, deleteTransaction, addCategoryRule } from '@/lib/db/queries';
import { clearRulesCache } from '@/lib/categories/engine';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const transaction = await getTransactionById(parseInt(id));
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(transaction);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const txId = parseInt(id);

  if (body.category_slug) {
    const existing = await getTransactionById(txId);
    if (existing && existing.category_slug !== body.category_slug) {
      const keyword = existing.counterparty || existing.description.slice(0, 10);
      if (keyword) {
        await addCategoryRule(keyword, body.category_slug, 'learned');
        clearRulesCache();
      }
    }
  }

  await updateTransaction(txId, body);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteTransaction(parseInt(id));
  return NextResponse.json({ success: true });
}

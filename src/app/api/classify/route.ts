import { NextRequest, NextResponse } from 'next/server';
import { classifyTransaction } from '@/lib/categories/engine';

export async function POST(request: NextRequest) {
  try {
    const { description, type } = await request.json();
    const slug = await classifyTransaction({
      description: description || '',
      source: 'manual',
      date: '',
      amount: 0,
      type: type || 'expense',
    });
    return NextResponse.json({ category_slug: slug });
  } catch (e) {
    return NextResponse.json({ category_slug: 'uncategorized' });
  }
}

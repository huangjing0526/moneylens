import { NextRequest, NextResponse } from 'next/server';
import { getTransactions, insertTransactions, getTransactionCount, addCategoryRule } from '@/lib/db/queries';
import { classifyTransactions, clearRulesCache } from '@/lib/categories/engine';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const filters = {
      startDate: params.get('startDate') || undefined,
      endDate: params.get('endDate') || undefined,
      category: params.get('category') || undefined,
      search: params.get('search') || undefined,
      type: (params.get('type') as 'income' | 'expense' | 'transfer') || undefined,
      limit: params.get('limit') ? parseInt(params.get('limit')!) : 50,
      offset: params.get('offset') ? parseInt(params.get('offset')!) : 0,
    };

    const transactions = await getTransactions(filters);
    const total = await getTransactionCount({ startDate: filters.startDate, endDate: filters.endDate });
    return NextResponse.json({ transactions, total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('GET /api/transactions error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactions: rawTransactions, importId } = body;

    const classified = await classifyTransactions(rawTransactions);
    const ids = await insertTransactions(classified, importId);

    // Learn from user's manual category pick
    if (body.learn?.keyword && body.learn?.category_slug) {
      await addCategoryRule(body.learn.keyword, body.learn.category_slug, 'learned');
      clearRulesCache();
    }

    return NextResponse.json({ ids, count: ids.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/transactions error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

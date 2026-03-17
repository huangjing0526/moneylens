import { NextRequest, NextResponse } from 'next/server';
import { updateTransaction } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { transactionId, action } = body;

  if (action === 'mark_duplicate') {
    await updateTransaction(transactionId, { is_duplicate: true } as never);
  }

  return NextResponse.json({ success: true });
}

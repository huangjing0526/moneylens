import { NextRequest, NextResponse } from 'next/server';
import { getAccountById, updateAccount, updateAccountBalance, deleteAccount } from '@/lib/db/queries';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const account = await getAccountById(Number(id));
    if (!account) return NextResponse.json({ error: '账户不存在' }, { status: 404 });
    return NextResponse.json(account);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const accountId = Number(id);

    // If balance is being updated, use the special function that auto-snapshots
    if (body.balance !== undefined) {
      await updateAccountBalance(accountId, body.balance);
    }

    // Update other fields
    const { balance, ...otherUpdates } = body;
    if (Object.keys(otherUpdates).length > 0) {
      await updateAccount(accountId, otherUpdates);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteAccount(Number(id));
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

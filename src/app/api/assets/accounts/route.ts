import { NextRequest, NextResponse } from 'next/server';
import { getAccounts, createAccount } from '@/lib/db/queries';

export async function GET() {
  try {
    const accounts = await getAccounts();
    return NextResponse.json({ accounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, icon, color, balance, institution } = body;

    if (!name || !type) {
      return NextResponse.json({ error: '名称和类型不能为空' }, { status: 400 });
    }

    const id = await createAccount({ name, type, icon, color, balance, institution });
    return NextResponse.json({ id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

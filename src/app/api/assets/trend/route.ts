import { NextRequest, NextResponse } from 'next/server';
import { getNetWorthTrend } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const months = Number(request.nextUrl.searchParams.get('months') || 6);
    const trend = await getNetWorthTrend(months);
    return NextResponse.json(trend);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

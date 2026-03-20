import { NextResponse } from 'next/server';
import { getAssetSummary } from '@/lib/db/queries';

export async function GET() {
  try {
    const summary = await getAssetSummary();
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars
  checks.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ? `set (${process.env.TURSO_DATABASE_URL.substring(0, 30)}...)` : 'MISSING';
  checks.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ? `set (${process.env.TURSO_AUTH_TOKEN.substring(0, 20)}...)` : 'MISSING';

  // Try DB connection
  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    const result = await db.execute({ sql: "SELECT COUNT(*) as cnt FROM categories", args: [] });
    const count = (result.rows[0] as unknown as { cnt: number }).cnt;
    checks.db_connection = `ok (${count} categories)`;
  } catch (e) {
    checks.db_connection = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(checks);
}

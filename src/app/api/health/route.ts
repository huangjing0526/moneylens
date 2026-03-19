import { NextResponse } from 'next/server';

function getEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    return (env as Record<string, string>)[name];
  } catch {
    return undefined;
  }
}

export async function GET() {
  const checks: Record<string, string> = {};

  const dbUrl = getEnvVar('TURSO_DATABASE_URL');
  const authToken = getEnvVar('TURSO_AUTH_TOKEN');
  checks.TURSO_DATABASE_URL = dbUrl ? `set (${dbUrl.substring(0, 30)}...)` : 'MISSING';
  checks.TURSO_AUTH_TOKEN = authToken ? `set (${authToken.substring(0, 20)}...)` : 'MISSING';

  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    const result = await db.execute("SELECT COUNT(*) as cnt FROM categories");
    const count = (result.rows[0] as { cnt: number }).cnt;
    checks.db_connection = `ok (${count} categories)`;
  } catch (e) {
    checks.db_connection = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(checks);
}

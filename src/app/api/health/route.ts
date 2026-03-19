import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, string> = {};

  // Use literal access so Next.js can inline at build time
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  checks.TURSO_DATABASE_URL = dbUrl ? `set (${dbUrl.substring(0, 30)}...)` : 'MISSING';
  checks.TURSO_AUTH_TOKEN = authToken ? `set (${authToken.substring(0, 20)}...)` : 'MISSING';

  // Also check Cloudflare context
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    const cfEnv = env as Record<string, unknown>;
    checks.cf_TURSO_DATABASE_URL = cfEnv.TURSO_DATABASE_URL ? 'set' : 'MISSING';
    checks.cf_TURSO_AUTH_TOKEN = cfEnv.TURSO_AUTH_TOKEN ? 'set' : 'MISSING';
    checks.cf_env_keys = Object.keys(cfEnv).join(', ');
  } catch (e) {
    checks.cloudflare_context = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

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

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
  checks.process_env_keys = Object.keys(process.env).filter(k => k.startsWith('TURSO') || k.startsWith('APP')).join(', ') || 'none';

  // Check Cloudflare context
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    const cfKeys = Object.keys(env as Record<string, unknown>).join(', ');
    checks.cloudflare_env_keys = cfKeys || 'empty';
  } catch (e) {
    checks.cloudflare_context = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

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

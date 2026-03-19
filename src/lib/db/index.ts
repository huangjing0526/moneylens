import { createClient, type Client } from '@libsql/client';
import { initSchema } from './schema';
import { seedCategories } from './seed';

let client: Client | null = null;
let initPromise: Promise<void> | null = null;

function getEnvVar(name: string): string | undefined {
  // Try process.env first (works in Node.js / local dev)
  if (process.env[name]) return process.env[name];

  // Try Cloudflare context (works in Workers runtime)
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    return (env as Record<string, string>)[name];
  } catch {
    return undefined;
  }
}

function getClient(): Client {
  if (!client) {
    let url = getEnvVar('TURSO_DATABASE_URL');
    if (!url) {
      throw new Error('请配置 TURSO_DATABASE_URL 环境变量');
    }
    // Convert libsql:// to https:// for HTTP transport (required for Cloudflare Workers)
    if (url.startsWith('libsql://')) {
      url = url.replace('libsql://', 'https://');
    }
    client = createClient({
      url,
      authToken: getEnvVar('TURSO_AUTH_TOKEN'),
    });
  }
  return client;
}

export async function getDb(): Promise<Client> {
  const c = getClient();
  if (!initPromise) {
    initPromise = (async () => {
      await initSchema(c);
      await seedCategories(c);
    })();
  }
  await initPromise;
  return c;
}

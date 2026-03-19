import { createTursoClient, type TursoClient } from './turso-client';
import { initSchema } from './schema';
import { seedCategories } from './seed';

let client: TursoClient | null = null;
let initPromise: Promise<void> | null = null;

function getDbUrl(): string | undefined {
  // Literal access so Next.js inlines at build time
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  // Fallback: Cloudflare Workers runtime bindings
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    return (env as Record<string, string>).TURSO_DATABASE_URL;
  } catch {
    return undefined;
  }
}

function getAuthToken(): string | undefined {
  if (process.env.TURSO_AUTH_TOKEN) return process.env.TURSO_AUTH_TOKEN;
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    return (env as Record<string, string>).TURSO_AUTH_TOKEN;
  } catch {
    return undefined;
  }
}

function getClient(): TursoClient {
  if (!client) {
    const url = getDbUrl();
    if (!url) {
      throw new Error('请配置 TURSO_DATABASE_URL 环境变量');
    }
    client = createTursoClient(url, getAuthToken());
  }
  return client;
}

export async function getDb(): Promise<TursoClient> {
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

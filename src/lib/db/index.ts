import { createTursoClient, type TursoClient } from './turso-client';
import { initSchema } from './schema';
import { seedCategories } from './seed';

let client: TursoClient | null = null;
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

function getClient(): TursoClient {
  if (!client) {
    const url = getEnvVar('TURSO_DATABASE_URL');
    if (!url) {
      throw new Error('请配置 TURSO_DATABASE_URL 环境变量');
    }
    client = createTursoClient(url, getEnvVar('TURSO_AUTH_TOKEN'));
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

import { createClient, type Client } from '@libsql/client';
import { initSchema } from './schema';
import { seedCategories } from './seed';

let client: Client | null = null;
let initPromise: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error('请配置 TURSO_DATABASE_URL 环境变量');
    }
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
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

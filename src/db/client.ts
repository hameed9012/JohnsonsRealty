import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import ws from 'ws';
import * as schema from './schema';

export type DB = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
/** Anything queries can run on: the db or an open transaction. */
export type Executor = DB | Tx;

const globalForDb = globalThis as unknown as { __jrDb?: DB };

/**
 * Neon over WebSockets (real transactions). A `pglite:<dir>` URL runs an embedded Postgres instead,
 * for local development and end-to-end tests without a Neon database.
 */
function create(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  if (url.startsWith('pglite:')) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('pglite is for local use only.');
    // Loaded lazily so the embedded engine is only touched when asked for.
    const req = createRequire(import.meta.url);
    const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite');
    const { drizzle: pgliteDrizzle } = req('drizzle-orm/pglite') as typeof import('drizzle-orm/pglite');
    const dir = url.slice('pglite:'.length);
    if (dir && !dir.startsWith('memory:')) mkdirSync(dir, { recursive: true });
    return pgliteDrizzle(new PGlite(dir || undefined), { schema }) as unknown as DB;
  }
  if (typeof WebSocket === 'undefined') neonConfig.webSocketConstructor = ws;
  return drizzle(new Pool({ connectionString: url }), { schema });
}

export function getDb(): DB {
  if (!globalForDb.__jrDb) globalForDb.__jrDb = create();
  return globalForDb.__jrDb;
}

/** Proxy so modules can `import { db }` without connecting at import time (e.g. during `next build`). */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

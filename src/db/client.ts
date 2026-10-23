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

type PGliteClient = import('@electric-sql/pglite').PGlite;

// The raw connection is cached on globalThis so dev hot reloads reuse it (pglite holds a file lock).
// The drizzle wrapper is rebuilt per module load so it always carries the current schema objects.
const g = globalThis as unknown as { __jrConn?: { url: string; kind: 'neon'; pool: Pool } | { url: string; kind: 'pglite'; client: PGliteClient } };
let instance: DB | null = null;

function connection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  if (g.__jrConn && g.__jrConn.url === url) return g.__jrConn;
  if (url.startsWith('pglite:')) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('pglite is for local use only.');
    const req = createRequire(import.meta.url);
    const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite');
    const dir = url.slice('pglite:'.length);
    if (dir && !dir.startsWith('memory:')) mkdirSync(dir, { recursive: true });
    g.__jrConn = { url, kind: 'pglite', client: new PGlite(dir || undefined) };
  } else {
    if (typeof WebSocket === 'undefined') neonConfig.webSocketConstructor = ws;
    g.__jrConn = { url, kind: 'neon', pool: new Pool({ connectionString: url }) };
  }
  return g.__jrConn;
}

/**
 * Neon over WebSockets (real transactions). A `pglite:<dir>` URL runs an embedded Postgres instead,
 * for local development and end-to-end tests without a Neon database.
 */
export function getDb(): DB {
  if (instance) return instance;
  const c = connection();
  if (c.kind === 'pglite') {
    const req = createRequire(import.meta.url);
    const { drizzle: pgliteDrizzle } = req('drizzle-orm/pglite') as typeof import('drizzle-orm/pglite');
    instance = pgliteDrizzle(c.client, { schema }) as unknown as DB;
  } else {
    instance = drizzle(c.pool, { schema });
  }
  return instance;
}

/** Proxy so modules can `import { db }` without connecting at import time (e.g. during `next build`). */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

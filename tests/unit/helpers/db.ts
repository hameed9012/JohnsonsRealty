import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { DB } from '@/db/client';
import * as schema from '@/db/schema';

/** A fresh in-memory Postgres with all migrations applied. */
export async function testDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db as unknown as DB;
}

/** Empties every table, so one migrated database can serve a whole test file. */
export async function resetDb(db: DB) {
  const { sql } = await import('drizzle-orm');
  const res = (await db.execute(sql`select tablename from pg_tables where schemaname = 'public'`)) as unknown as { rows: { tablename: string }[] };
  const names = res.rows.map((r) => `"${r.tablename}"`).join(', ');
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
}

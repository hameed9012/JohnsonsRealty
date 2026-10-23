// Applies drizzle/*.sql migrations, then the migration-safe base seed. Run with `npm run db:migrate`.
import 'dotenv/config';
import { getDb } from './client';
import { seedBase } from './seed-base';

async function main() {
  const db = getDb();
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('pglite:')) {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as never, { migrationsFolder: 'drizzle' });
  } else {
    const { migrate } = await import('drizzle-orm/neon-serverless/migrator');
    await migrate(db, { migrationsFolder: 'drizzle' });
  }
  console.log('Migrations applied.');
  await seedBase(db);
  console.log('Base data checked (areas, features, settings).');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

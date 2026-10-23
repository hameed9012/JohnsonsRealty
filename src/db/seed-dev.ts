// `npm run seed:dev` — clearly fake "Example …" records for local development only.
// Refuses to run against production. Listing, client and sale examples are added in Phase 2.
import 'dotenv/config';
import { getDb } from './client';
import { seedBase } from './seed-base';
import { users } from './schema';

export function assertNotProduction(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') {
    throw new Error('seed:dev never runs on Vercel or in production.');
  }
}

async function main() {
  assertNotProduction();
  const db = getDb();
  await seedBase(db);
  await db
    .insert(users)
    .values([
      { id: 'example-owner', name: 'Example Owner', displayName: 'Example Owner', role: 'owner', robloxUsername: 'ExampleOwner', onboardedAt: new Date() },
      { id: 'example-admin', name: 'Example Admin', displayName: 'Example Admin', role: 'admin', robloxUsername: 'ExampleAdmin', onboardedAt: new Date() },
      { id: 'example-agent', name: 'Example Agent', displayName: 'Example Agent', role: 'agent', robloxUsername: 'ExampleAgent', onboardedAt: new Date() },
      { id: 'example-client', name: 'Example Client', displayName: 'Example Client', role: 'client', robloxUsername: 'ExampleClient', onboardedAt: new Date() },
    ])
    .onConflictDoNothing();
  console.log('Dev seed done: Example Owner, Example Admin, Example Agent, Example Client.');
  process.exit(0);
}

if (process.argv[1]?.includes('seed-dev')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

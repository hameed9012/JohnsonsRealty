// Seeds the end-to-end database with clearly fake test users. Runs before the test server starts.
import 'dotenv/config';
import { getDb } from '@/db/client';
import { agentProfiles, users } from '@/db/schema';
import { testAuthEnabled } from '@/lib/test-auth';

async function main() {
  if (!testAuthEnabled()) throw new Error('E2E seed needs E2E_TEST_AUTH=1 and a pglite: database.');
  const db = getDb();
  const now = new Date();
  await db
    .insert(users)
    .values([
      { id: 'e2e-owner', name: 'Example Owner', displayName: 'Example Owner', role: 'owner', robloxUsername: 'ExampleOwner', onboardedAt: now },
      { id: 'e2e-agent', name: 'Example Agent', displayName: 'Example Agent', role: 'agent', robloxUsername: 'ExampleAgent', onboardedAt: now },
      { id: 'e2e-client', name: 'Example Client', displayName: 'Example Client', role: 'client', robloxUsername: 'ExampleClient', chirperHandle: 'ExampleClient', onboardedAt: now },
    ])
    .onConflictDoNothing();
  await db
    .insert(agentProfiles)
    .values([{ userId: 'e2e-agent', publicName: 'Example Agent', slug: 'example-agent', title: 'Listing agent', active: true }])
    .onConflictDoNothing();
  console.log('E2E users ready.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

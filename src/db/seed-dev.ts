// `npm run seed:dev` — clearly fake "Example …" records for local development only.
// Refuses to run on Vercel or in production. Photos use the design system's layout sample screenshots.
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { seedBase } from './seed-base';
import {
  agentProfiles,
  areas,
  clientPeople,
  clients,
  listingConfidential,
  listingPhotos,
  listingReviews,
  listings,
  media,
  priceHistory,
  users,
} from './schema';

export function assertNotProduction(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') {
    throw new Error('seed:dev never runs on Vercel or in production.');
  }
}

const SAMPLES = ['/styleguide/in-game-exterior-sample.jpg', '/styleguide/in-game-interior-sample.jpg'];

async function main() {
  assertNotProduction();
  const db = getDb();
  await seedBase(db);
  const now = new Date();
  await db
    .insert(users)
    .values([
      { id: 'example-owner', name: 'Example Owner', displayName: 'Example Owner', role: 'owner', robloxUsername: 'ExampleOwner', onboardedAt: now },
      { id: 'example-admin', name: 'Example Admin', displayName: 'Example Admin', role: 'admin', robloxUsername: 'ExampleAdmin', onboardedAt: now },
      { id: 'example-agent', name: 'Example Agent', displayName: 'Example Agent', role: 'agent', robloxUsername: 'ExampleAgent', chirperHandle: 'ExampleAgent', onboardedAt: now },
      { id: 'example-client', name: 'Example Client', displayName: 'Example Client', role: 'client', robloxUsername: 'ExampleClient', onboardedAt: now },
    ])
    .onConflictDoNothing();
  await db
    .insert(agentProfiles)
    .values([
      { userId: 'example-owner', publicName: 'Example Owner', slug: 'example-owner', title: 'Owner', displayOrder: 0 },
      { userId: 'example-admin', publicName: 'Example Admin', slug: 'example-admin', title: 'Admin', displayOrder: 1 },
      { userId: 'example-agent', publicName: 'Example Agent', slug: 'example-agent', title: 'Listing agent', displayOrder: 2 },
    ])
    .onConflictDoNothing();

  const exists = await db.query.listings.findFirst({ where: eq(listings.refNo, 'JR-2000-00001') });
  if (!exists) {
    const fairview = await db.query.areas.findFirst({ where: eq(areas.slug, 'fairview') });
    const springfield = await db.query.areas.findFirst({ where: eq(areas.slug, 'springfield') });
    const photoIds: string[] = [];
    for (const [i, s] of [...SAMPLES, SAMPLES[0]!].entries()) {
      const [m] = await db.insert(media).values({ storageId: `${s}?example=${i}`, width: 1600, height: 900, uploadedBy: 'example-agent' }).returning();
      photoIds.push(m!.id);
    }
    const [seller] = await db.insert(clients).values({ kind: 'person', displayName: 'Example Seller', roles: ['seller'], agentId: 'example-agent', createdBy: 'example-agent' }).returning();
    await db.insert(clientPeople).values({ clientId: seller!.id, legalName: 'Example Seller', signs: true });

    const [live] = await db
      .insert(listings)
      .values({
        refNo: 'JR-2000-00001',
        slug: 'example-lane-fairview-00001',
        type: 'house',
        purpose: 'sale',
        source: 'agent',
        status: 'active',
        addressLine: 'Example Lane',
        areaId: fairview?.id,
        price: 365000,
        beds: 3,
        baths: 2,
        sqft: 1850,
        lot: '0.22 acres',
        yearBuilt: 1994,
        description: 'Example listing for local development. Three bedrooms, two bathrooms and a garden.',
        listingAgentId: 'example-agent',
        sellerClientId: seller!.id,
        submittedByUserId: 'example-agent',
        round: 1,
        publishedAt: now,
      })
      .returning();
    await db.insert(listingPhotos).values(photoIds.map((mediaId, i) => ({ listingId: live!.id, mediaId, alt: `Example photo ${i + 1}`, sortOrder: i, isCover: i === 0 })));
    await db.insert(listingConfidential).values({ listingId: live!.id, bottomLine: 350000 });
    await db.insert(listingReviews).values({ listingId: live!.id, round: 1, submittedBy: 'example-agent', snapshot: {}, decision: 'approved', reviewerId: 'example-owner', decidedAt: now });
    await db.insert(priceHistory).values({ listingId: live!.id, price: 365000, event: 'listed', on: now });

    const [m2] = await db.insert(media).values({ storageId: `${SAMPLES[1]}?example=9`, width: 1600, height: 900, uploadedBy: 'example-client' }).returning();
    const [owned] = await db.insert(clients).values({ kind: 'person', displayName: 'Example Client', roles: ['landlord'], userId: 'example-client', createdBy: 'example-client' }).returning();
    const [pending] = await db
      .insert(listings)
      .values({
        refNo: 'JR-2000-00002',
        slug: 'jr-2000-00002',
        type: 'rental',
        purpose: 'rent',
        source: 'owner_submitted',
        status: 'pending_review',
        addressLine: 'Example Court',
        areaId: springfield?.id,
        price: 1900,
        beds: 2,
        baths: 1,
        availableFrom: '2030-11-01',
        description: 'Example owner-submitted rental for local development, waiting for review.',
        sellerClientId: owned!.id,
        submittedByUserId: 'example-client',
        ownerContact: { roblox: true, chirper: false, discord: false },
        round: 1,
      })
      .returning();
    await db.insert(listingPhotos).values([0, 1, 2].map((i) => ({ listingId: pending!.id, mediaId: i === 0 ? m2!.id : photoIds[i]!, alt: `Example room ${i + 1}`, sortOrder: i, isCover: i === 0 })));
    await db.insert(listingReviews).values({ listingId: pending!.id, round: 1, submittedBy: 'example-client', snapshot: {} });
  }
  console.log('Dev seed done: Example Owner, Admin, Agent, Client; one live and one pending Example listing.');
  process.exit(0);
}

if (process.argv[1]?.includes('seed-dev')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

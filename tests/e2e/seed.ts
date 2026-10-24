// Seeds the end-to-end database with clearly fake test records. Runs before the test server starts.
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { agentProfiles, areas, clientPeople, clients, dealParties, deals, documents, listingPhotos, listingReviews, listings, media, priceHistory, siteSettings, users } from '@/db/schema';
import { testAuthEnabled } from '@/lib/test-auth';

const PHOTOS = ['/styleguide/in-game-exterior-sample.jpg', '/styleguide/in-game-interior-sample.jpg', '/styleguide/in-game-exterior-sample.jpg'];

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
      { id: 'e2e-buyer', name: 'Example Buyer', displayName: 'Example Buyer', role: 'client', robloxUsername: 'ExampleBuyer', onboardedAt: now },
    ])
    .onConflictDoNothing();
  await db.insert(agentProfiles).values([{ userId: 'e2e-agent', publicName: 'Example Agent', slug: 'example-agent', title: 'Listing agent', active: true }]).onConflictDoNothing();

  const fairview = (await db.query.areas.findFirst({ where: eq(areas.slug, 'fairview') }))!.id;
  const photoRows = await Promise.all(
    PHOTOS.map((p, i) => db.insert(media).values({ storageId: `${p}?e2e=${i}`, width: 1600, height: 900 }).returning().then((r) => r[0]!)),
  );
  // A stand-in map image so the manual map pin can be tested.
  const [mapImage] = await db.insert(media).values({ storageId: '/styleguide/in-game-exterior-sample.jpg?map', width: 1600, height: 900 }).returning();
  await db.update(siteSettings).set({ mapMediaId: mapImage!.id }).where(eq(siteSettings.id, 1));
  const photos = (listingId: string) => photoRows.map((m, i) => ({ listingId, mediaId: m.id, alt: `Example photo ${i + 1}`, sortOrder: i, isCover: i === 0 }));

  const [seller] = await db.insert(clients).values({ displayName: 'Example Seller', roles: ['seller'], agentId: 'e2e-agent' }).returning();
  await db.insert(clientPeople).values({ clientId: seller!.id, legalName: 'Example Seller' });

  // A live listing with a deal for Example Buyer.
  const [live] = await db
    .insert(listings)
    .values({ refNo: 'JR-2000-00901', slug: 'example-seed-home-00901', type: 'house', purpose: 'sale', source: 'agent', status: 'under_offer', addressLine: 'Example Seed Home', areaId: fairview, price: 300000, beds: 3, baths: 2, description: 'Example seeded listing for end-to-end tests.', listingAgentId: 'e2e-agent', submittedByUserId: 'e2e-agent', sellerClientId: seller!.id, round: 1, publishedAt: now })
    .returning();
  await db.insert(listingPhotos).values(photos(live!.id));
  await db.insert(priceHistory).values({ listingId: live!.id, price: 300000, event: 'listed' });
  const [buyer] = await db.insert(clients).values({ displayName: 'Example Buyer', roles: ['buyer'], userId: 'e2e-buyer', agentId: 'e2e-agent' }).returning();
  const [deal] = await db.insert(deals).values({ listingId: live!.id, agentId: 'e2e-agent', stage: 'under_offer', offerDate: '2026-10-20', sharedWithClient: true }).returning();
  await db.insert(dealParties).values([
    { dealId: deal!.id, clientId: buyer!.id, side: 'buyer' },
    { dealId: deal!.id, clientId: seller!.id, side: 'seller' },
  ]);
  await db.insert(documents).values([
    { formType: 'agreement_of_sale', formNo: 'JR-PA-100', docNo: 'AOS-2000-0001', dealId: deal!.id, listingId: live!.id, status: 'sent', sharedWithClient: true },
    { formType: 'earnest_money', formNo: 'JR-PA-210', docNo: 'EM-2000-0001', dealId: deal!.id, listingId: live!.id, status: 'draft', sharedWithClient: false },
  ]);

  // An active listing anyone can book, and one waiting for review (for saved-search alerts).
  const [open] = await db
    .insert(listings)
    .values({ refNo: 'JR-2000-00902', slug: 'example-open-home-00902', type: 'house', purpose: 'sale', source: 'agent', status: 'active', addressLine: 'Example Open Home', areaId: fairview, price: 280000, beds: 2, baths: 1, description: 'Example seeded listing for end-to-end tests.', listingAgentId: 'e2e-agent', submittedByUserId: 'e2e-agent', sellerClientId: seller!.id, round: 1, publishedAt: now })
    .returning();
  await db.insert(listingPhotos).values(photos(open!.id));
  const [pending] = await db
    .insert(listings)
    .values({ refNo: 'JR-2000-00903', slug: 'jr-2000-00903', type: 'house', purpose: 'sale', source: 'agent', status: 'pending_review', addressLine: 'Example Pending Home', areaId: fairview, price: 320000, beds: 4, baths: 2, description: 'Example seeded listing waiting for review in end-to-end tests.', listingAgentId: 'e2e-agent', submittedByUserId: 'e2e-agent', sellerClientId: seller!.id, round: 1 })
    .returning();
  await db.insert(listingPhotos).values(photos(pending!.id));
  await db.insert(listingReviews).values({ listingId: pending!.id, round: 1, submittedBy: 'e2e-agent', snapshot: {} });

  console.log('E2E records ready.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

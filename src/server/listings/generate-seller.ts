import 'server-only';
import { eq } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import {
  agentProfiles,
  clientConfidential,
  clientPeople,
  clients,
  features,
  listingConfidential,
  listingDisclosures,
  listingFeatures,
  listingOwnership,
  listingPropertyDetails,
  listings,
  listingTerms,
  users,
} from '@/db/schema';
import type { SellerValues } from '@/components/listing-editor/types';
import { generateSeller, type GeneratedSeller, type GeneratorListing } from '@/lib/seller-generator';
import { audit } from '@/server/audit';

export const FICTIONAL_LABEL = 'Fictional RP seller';

/** The listing facts the generator works from. */
export async function generatorFacts(ex: Executor, listingId: string): Promise<{ input: GeneratorListing; agentName: string | null } | null> {
  const l = await ex.query.listings.findFirst({ where: eq(listings.id, listingId) });
  if (!l) return null;
  const [feats, details, terms, agent] = await Promise.all([
    ex.select({ name: features.label }).from(listingFeatures).innerJoin(features, eq(features.id, listingFeatures.featureId)).where(eq(listingFeatures.listingId, listingId)),
    ex.query.listingPropertyDetails.findFirst({ where: eq(listingPropertyDetails.listingId, listingId), columns: { basement: true } }),
    ex.query.listingTerms.findFirst({ where: eq(listingTerms.listingId, listingId), columns: { furnishedPrice: true } }),
    l.listingAgentId
      ? ex
          .select({ publicName: agentProfiles.publicName, displayName: users.displayName })
          .from(users)
          .leftJoin(agentProfiles, eq(agentProfiles.userId, users.id))
          .where(eq(users.id, l.listingAgentId))
          .then((r) => r[0])
      : undefined,
  ]);
  return {
    input: {
      type: l.type,
      purpose: l.purpose,
      price: l.price,
      beds: l.beds,
      sqft: l.sqft,
      yearBuilt: l.yearBuilt,
      garage: l.garage,
      basement: details?.basement ?? null,
      features: feats.map((f) => f.name),
      furnishedPrice: terms?.furnishedPrice ?? null,
    },
    agentName: agent?.publicName ?? agent?.displayName ?? null,
  };
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** The Seller step's form values, so the agent can edit the generated seller before saving. */
export function sellerFormValues(g: GeneratedSeller): SellerValues {
  return {
    clientId: '',
    client: {
      ...g.client,
      kind: g.client.kind,
      source: FICTIONAL_LABEL,
      emergencyContact: '',
      businessAddress: '',
      generatedSeed: g.seed,
      people: g.people.map((p) => ({ ...p, maritalStatus: s(p.maritalStatus), roleLabel: s(p.roleLabel), robloxUsername: '', chirper: '' })),
    },
    clientConfidential: g.clientConfidential,
    vesting: g.ownership.vesting,
    whoSigns: g.ownership.whoSigns,
    boughtOn: g.ownership.boughtOn,
    boughtFor: s(g.ownership.boughtFor),
    ownedSince: g.ownership.ownedSince,
    deedReference: g.ownership.deedReference,
    mortgage: g.ownership.mortgage,
    liens: g.ownership.liens,
    disclosures: g.disclosures.map((d) => ({ item: d.item, answer: d.answer, detail: s(d.detail) })),
    bottomLine: s(g.listingConfidential.bottomLine),
    negotiationRules: g.listingConfidential.negotiationRules,
    relayLines: g.listingConfidential.relayLines,
    commissionTerms: g.listingConfidential.commissionTerms,
    yearlySales: '',
    yearlyProfit: '',
    inventoryValue: '',
    disclosureNotes: '',
  };
}

/** Keeps what the agent already entered; fills only the blanks. */
function blanksOnly<T extends Record<string, unknown>>(existing: Record<string, unknown> | undefined, generated: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(generated) as (keyof T & string)[]) {
    const cur = existing?.[k];
    if (cur === null || cur === undefined || cur === '') out[k] = generated[k];
  }
  return out;
}

/**
 * Generates and stores a seller for a listing that has none (the Owner approved it with the Seller step
 * skipped). Saved as ordinary rows; anything the agent already entered is kept.
 */
export async function storeGeneratedSeller(ex: Executor, listingId: string, seed: string, actorId: string | null): Promise<string | null> {
  const facts = await generatorFacts(ex, listingId);
  if (!facts) return null;
  const l = (await ex.query.listings.findFirst({ where: eq(listings.id, listingId) }))!;
  const g = generateSeller(seed, facts.input, { agentName: facts.agentName ?? undefined });

  const [c] = await ex
    .insert(clients)
    .values({ ...g.client, source: FICTIONAL_LABEL, generatedSeed: seed, agentId: l.listingAgentId, createdBy: actorId })
    .returning({ id: clients.id });
  const clientId = c!.id;
  await ex.insert(clientPeople).values(g.people.map((p, i) => ({ ...p, clientId, sortOrder: i })));
  await ex.insert(clientConfidential).values({ clientId, ...g.clientConfidential });

  const own = await ex.query.listingOwnership.findFirst({ where: eq(listingOwnership.listingId, listingId) });
  if (own) await ex.update(listingOwnership).set(blanksOnly(own, g.ownership)).where(eq(listingOwnership.listingId, listingId));
  else await ex.insert(listingOwnership).values({ listingId, ...g.ownership });

  const hasDisclosures = await ex.$count(listingDisclosures, eq(listingDisclosures.listingId, listingId));
  if (!hasDisclosures) await ex.insert(listingDisclosures).values(g.disclosures.map((d) => ({ listingId, ...d })));

  const conf = await ex.query.listingConfidential.findFirst({ where: eq(listingConfidential.listingId, listingId) });
  if (conf) {
    const patch = blanksOnly(conf, g.listingConfidential);
    if (Object.keys(patch).length) await ex.update(listingConfidential).set(patch).where(eq(listingConfidential.listingId, listingId));
  } else await ex.insert(listingConfidential).values({ listingId, ...g.listingConfidential });

  if (g.terms) {
    const t = await ex.query.listingTerms.findFirst({ where: eq(listingTerms.listingId, listingId) });
    if (t) {
      const patch = blanksOnly(t, g.terms);
      if (Object.keys(patch).length) await ex.update(listingTerms).set(patch).where(eq(listingTerms.listingId, listingId));
    } else await ex.insert(listingTerms).values({ listingId, ...g.terms });
  }
  const d = await ex.query.listingPropertyDetails.findFirst({ where: eq(listingPropertyDetails.listingId, listingId) });
  if (d) {
    const patch = blanksOnly(d, g.property);
    if (Object.keys(patch).length) await ex.update(listingPropertyDetails).set(patch).where(eq(listingPropertyDetails.listingId, listingId));
  } else await ex.insert(listingPropertyDetails).values({ listingId, ...g.property });

  await ex.update(listings).set({ sellerClientId: clientId, showingInstructions: l.showingInstructions ?? g.showingInstructions }).where(eq(listings.id, listingId));
  await audit(ex, { actorId, action: 'client.generate', entity: 'client', entityId: clientId, summary: `Generated a fictional RP seller (${g.client.displayName}) for ${l.refNo}` });
  return clientId;
}

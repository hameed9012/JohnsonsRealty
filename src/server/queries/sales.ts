import 'server-only';
import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import type { SaleRow } from '@/components/ui/SalesLedger';
import { db } from '@/db/client';
import { agentProfiles, areas, listingBusiness, listingPhotos, listings, media, saleAgents, sales } from '@/db/schema';
import { date, saleNo } from '@/lib/format';
import { MARKET_STATUSES } from '@/lib/listing-status';

type Status = (typeof listings.status.enumValues)[number];

export interface SaleLedgerRow extends SaleRow {
  id: string;
  no: string;
  saleNo: number;
  date: string;
  soldOn: string;
  address: string;
  area: string | undefined;
  areaSlug: string | null;
  agent: string | undefined;
  status: 'sold' | 'leased';
  price: number;
  href: string;
  purpose: 'sale' | 'rent';
  /** Cover photo storage ID, for the brochure thumbnail. */
  cover: string | null;
}

export interface SalesFilter {
  areaSlug?: string | null;
  agentUserId?: string | null;
  year?: number | null;
  purpose?: 'sale' | 'rent' | null;
}

function where(f: SalesFilter): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  if (f.areaSlug) c.push(sql`${listings.areaId} in (select id from ${areas} a where a.slug = ${f.areaSlug} or a.parent_id = (select id from ${areas} p where p.slug = ${f.areaSlug}))`);
  if (f.agentUserId) c.push(sql`exists (select 1 from ${saleAgents} sa where sa.sale_id = ${sales.id} and sa.agent_id = ${f.agentUserId})`);
  if (f.year) {
    c.push(gte(sales.soldOn, `${f.year}-01-01`));
    c.push(lt(sales.soldOn, `${f.year + 1}-01-01`));
  }
  if (f.purpose) c.push(eq(listings.purpose, f.purpose));
  return c.length ? and(...c) : undefined;
}

/** Public sales ledger rows, newest first. Commission never appears here. */
export async function salesLedger(f: SalesFilter = {}, limit = 200): Promise<SaleLedgerRow[]> {
  const rows = await db
    .select({
      id: sales.id,
      saleNo: sales.saleNo,
      soldOn: sales.soldOn,
      price: sales.price,
      addressLine: listings.addressLine,
      slug: listings.slug,
      purpose: listings.purpose,
      type: listings.type,
      nameWithheld: listingBusiness.nameWithheld,
      teaser: listingBusiness.teaser,
      areaName: areas.name,
      areaSlug: areas.slug,
      agent: sql<string | null>`(select ap.public_name from ${saleAgents} sa join ${agentProfiles} ap on ap.user_id = sa.agent_id where sa.sale_id = ${sales.id} order by sa.side limit 1)`,
      cover: sql<string | null>`(select ${media.storageId} from ${listingPhotos} join ${media} on ${media.id} = ${listingPhotos.mediaId} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.isCover} desc, ${listingPhotos.sortOrder} asc limit 1)`,
    })
    .from(sales)
    .innerJoin(listings, eq(listings.id, sales.listingId))
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .leftJoin(listingBusiness, eq(listingBusiness.listingId, listings.id))
    .where(where(f))
    .orderBy(desc(sales.soldOn), desc(sales.saleNo))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    no: saleNo(r.saleNo),
    saleNo: r.saleNo,
    date: date(r.soldOn),
    soldOn: r.soldOn,
    address: r.type === 'business' && r.nameWithheld ? r.teaser || 'Business' : r.addressLine || 'Address withheld',
    area: r.areaName ?? undefined,
    areaSlug: r.areaSlug,
    agent: r.agent ?? undefined,
    status: r.purpose === 'rent' ? 'leased' : 'sold',
    price: r.price,
    href: `/property/${r.slug}`,
    purpose: r.purpose,
    cover: r.cover,
  }));
}

/** Headline figures, straight from the database. */
export async function ledgerFigures() {
  const [[s], [a]] = await Promise.all([
    db
      .select({ sold: sql<number>`count(*)::int`, volume: sql<number>`coalesce(sum(${sales.price}), 0)::bigint` })
      .from(sales)
      .innerJoin(listings, eq(listings.id, sales.listingId))
      .where(eq(listings.purpose, 'sale')),
    db.select({ active: sql<number>`count(*)::int` }).from(listings).where(and(inArray(listings.status, MARKET_STATUSES as Status[]), eq(listings.photosHold, false))),
  ]);
  return { sold: s?.sold ?? 0, volume: Number(s?.volume ?? 0), active: a?.active ?? 0 };
}

export async function salesYears(): Promise<number[]> {
  const rows = await db.select({ y: sql<number>`distinct extract(year from ${sales.soldOn})::int` }).from(sales);
  return rows.map((r) => r.y).sort((a, b) => b - a);
}

/** Volume per month and sales per area, for the Sold charts. */
export function chartsFrom(rows: SaleLedgerRow[]) {
  const months = new Map<string, number>();
  const byArea = new Map<string, number>();
  for (const r of rows) {
    if (r.purpose !== 'sale') continue;
    const m = r.soldOn.slice(0, 7);
    months.set(m, (months.get(m) ?? 0) + r.price);
    const a = r.area ?? 'Other';
    byArea.set(a, (byArea.get(a) ?? 0) + 1);
  }
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  return {
    volume: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([m, v]) => ({ label: fmt.format(new Date(m + '-01T00:00:00Z')), value: v })),
    areas: [...byArea.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
  };
}

/** Active agent profiles in display order, with listing and sale counts the database has. */
export async function activeAgents() {
  return db
    .select({
      userId: agentProfiles.userId,
      slug: agentProfiles.slug,
      name: agentProfiles.publicName,
      title: agentProfiles.title,
      bio: agentProfiles.bio,
      contactLine: agentProfiles.contactLine,
      photoId: agentProfiles.photoId,
      photo: sql<string | null>`(select storage_id from media m where m.id = ${agentProfiles.photoId})`,
      chirper: sql<string | null>`(select chirper_handle from users u where u.id = ${agentProfiles.userId})`,
      listings: sql<number>`(select count(*)::int from ${listings} l where l.listing_agent_id = ${agentProfiles.userId} and l.status in ('coming_soon','active','for_lease','under_offer','under_contract'))`,
      sold: sql<number>`(select count(*)::int from ${saleAgents} sa where sa.agent_id = ${agentProfiles.userId})`,
    })
    .from(agentProfiles)
    .where(and(eq(agentProfiles.active, true), sql`(select status from users u where u.id = ${agentProfiles.userId}) = 'active'`))
    .orderBy(asc(agentProfiles.displayOrder), asc(agentProfiles.publicName));
}

export type AgentRow = Awaited<ReturnType<typeof activeAgents>>[number];

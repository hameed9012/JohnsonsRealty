import { and, eq, inArray } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ContactForm } from '@/components/public/EnquiryForms';
import { DataSheet } from '@/components/ui/layout';
import { db } from '@/db/client';
import { listings } from '@/db/schema';
import { MARKET_STATUSES } from '@/lib/listing-status';
import { getActor } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Contact', description: 'Get in touch with Johnson’s Realty.', alternates: { canonical: '/contact' } };

type Status = (typeof listings.status.enumValues)[number];

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ listing?: string }> }) {
  const { listing: listingRef } = await searchParams;
  const [actor, s] = await Promise.all([getActor(), getSettings()]);
  const listing =
    listingRef && /^[a-z0-9-]{1,120}$/.test(listingRef)
      ? await db.query.listings.findFirst({ where: and(eq(listings.slug, listingRef), inArray(listings.status, MARKET_STATUSES as Status[])), columns: { id: true, addressLine: true } })
      : undefined;
  const details = [
    { label: 'Office', value: s.officeLocation },
    { label: 'Chirper', value: s.chirperHandle ? `@${s.chirperHandle}` : null, mono: true },
    { label: 'Discord', value: s.discordInvite ? <a href={s.discordInvite} rel="noopener noreferrer" target="_blank">Join our server</a> : null },
    { label: 'Registration', value: s.civopsLine },
  ].filter((d) => d.value);
  return (
    <div className="container section">
      <div className="split">
        <section className="stack-lg">
          <header className="stack">
            <span className="label label--brass">Contact</span>
            <h1 className="display-m">Get in touch</h1>
            <p className="body-l muted">Questions about a listing, selling, renting or working with us. You’ll get a reference number to quote.</p>
          </header>
          <div className="panel">
            <ContactForm signedIn={!!actor} listing={listing ? { id: listing.id, title: listing.addressLine || 'this listing' } : undefined} />
          </div>
        </section>
        <aside className="stack">
          <h2 className="heading-2">The brokerage</h2>
          {details.length ? <DataSheet rows={details} /> : <p className="body muted">Office details are on their way.</p>}
        </aside>
      </div>
    </div>
  );
}

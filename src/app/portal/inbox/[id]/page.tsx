import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InboxControls, ReplyForm } from '@/components/portal/InboxControls';
import { Breadcrumbs, DataSheet } from '@/components/ui/layout';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { enquiries, enquiryReplies, listings, users } from '@/db/schema';
import { ENQUIRY_PILL, ENQUIRY_TYPE, PAYLOAD_LABELS } from '@/lib/enquiries';
import { can } from '@/lib/permissions';
import { staffOptions } from '@/server/queries/review';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Enquiry' };

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/inbox/${id}`);
  if (!can(actor, 'enquiry.manage')) notFound();
  const e = await db.query.enquiries.findFirst({ where: eq(enquiries.id, id) });
  if (!e) notFound();
  const [from, listing, replies, staff] = await Promise.all([
    e.userId ? db.query.users.findFirst({ where: eq(users.id, e.userId), columns: { displayName: true, robloxUsername: true, chirperHandle: true } }) : null,
    e.listingId ? db.query.listings.findFirst({ where: eq(listings.id, e.listingId), columns: { id: true, addressLine: true } }) : null,
    db.select({ r: enquiryReplies, author: users.displayName }).from(enquiryReplies).leftJoin(users, eq(users.id, enquiryReplies.authorId)).where(eq(enquiryReplies.enquiryId, id)).orderBy(asc(enquiryReplies.createdAt)),
    staffOptions(),
  ]);
  const payload = e.payload as Record<string, unknown>;
  const rows = Object.entries(payload)
    .filter(([k, v]) => k !== 'from' && k !== 'careerId' && k !== 'areaId' && k !== 'listingId' && v !== null && v !== '')
    .sort(([a], [b]) => Object.keys(PAYLOAD_LABELS).indexOf(a) - Object.keys(PAYLOAD_LABELS).indexOf(b))
    .map(([k, v]) => ({ label: PAYLOAD_LABELS[k] ?? k, value: String(v) }));
  const pill = ENQUIRY_PILL[e.status]!;
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Support inbox', href: '/portal/inbox' }, { label: e.refNo }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={pill.status} label={pill.label} />
            <span className="id muted">{e.refNo}</span>
          </div>
          <h1 className="heading-1">{ENQUIRY_TYPE[e.type]}</h1>
          <p className="body muted">
            From {from?.displayName ?? 'a visitor'}
            {from?.robloxUsername ? ` · Roblox ${from.robloxUsername}` : ''}
            {from?.chirperHandle ? ` · Chirper @${from.chirperHandle}` : ''} · <LocalTime iso={e.createdAt.toISOString()} />
          </p>
          {listing ? (
            <p className="body">
              About <Link href={`/portal/listings/${listing.id}`}>{listing.addressLine}</Link>
            </p>
          ) : null}
        </div>
        <InboxControls id={id} status={e.status} assigneeId={e.assigneeId} staff={staff.map((s) => ({ value: s.id, label: s.name ?? 'Staff' }))} />
      </div>
      <DataSheet rows={rows} />
      <section className="stack">
        <h2 className="heading-2">Conversation</h2>
        {replies.length ? (
          <ol className="thread-list">
            {replies.map(({ r, author }) => (
              <li key={r.id} className={r.internal ? 'thread-msg thread-msg--note' : 'thread-msg'}>
                <div className="thread-meta">
                  <b className="ui">{author ?? 'Staff'}</b>
                  {r.internal ? <span className="label">Internal note</span> : <span className="label">Sent to {from?.displayName ?? 'them'}</span>}
                  <LocalTime iso={r.createdAt.toISOString()} />
                </div>
                <p className="body">{r.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="body-s muted">No replies yet.</p>
        )}
        <ReplyForm id={id} canReply={!!e.userId} />
      </section>
    </div>
  );
}

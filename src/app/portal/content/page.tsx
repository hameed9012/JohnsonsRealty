import { asc, desc } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { careers, posts } from '@/db/schema';
import { date } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Content' };

export default async function ContentPage() {
  const actor = await requireStaff('/portal/content');
  if (!can(actor, 'content.manage')) notFound();
  const [p, c] = await Promise.all([db.select().from(posts).orderBy(desc(posts.updatedAt)), db.select().from(careers).orderBy(asc(careers.displayOrder))]);
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Content</span>
          <h1 className="heading-1">Guides, news and careers</h1>
        </div>
        <div className="row">
          <Button href="/portal/content/posts/new" icon="document">
            Write an article
          </Button>
          <Button variant="secondary" href="/portal/content/careers/new" icon="users">
            Add a role
          </Button>
        </div>
      </div>
      <section className="stack">
        <h2 className="heading-2">Articles</h2>
        <DataTable
          caption="Articles"
          rows={p}
          rowKey={(r) => r.id}
          empty={<EmptyState icon="document" title="No articles yet" text="Write buyer, seller and renter guides, or brokerage news." />}
          columns={[
            { key: 'title', header: 'Title', cell: (r) => <Link href={`/portal/content/posts/${r.id}`}>{r.title}</Link> },
            { key: 'kind', header: 'Kind', cell: (r) => (r.kind === 'guide' ? 'Guide' : 'News') },
            { key: 'status', header: 'Status', cell: (r) => (r.publishedAt ? <StatusPill status="active" label="Published" /> : <StatusPill status="draft" />) },
            { key: 'date', header: 'Published', num: true, cell: (r) => (r.publishedAt ? date(r.publishedAt) : '—') },
          ]}
        />
      </section>
      <section className="stack">
        <h2 className="heading-2">Careers</h2>
        <DataTable
          caption="Roles"
          rows={c}
          rowKey={(r) => r.id}
          empty={<EmptyState icon="users" title="No roles yet" text="Add open roles for the Careers page." />}
          columns={[
            { key: 'title', header: 'Role', cell: (r) => <Link href={`/portal/content/careers/${r.id}`}>{r.title}</Link> },
            { key: 'status', header: 'Status', cell: (r) => (r.open ? <StatusPill status="active" label="Open" /> : <StatusPill status="off-market" label="Closed" />) },
            { key: 'order', header: 'Order', num: true, cell: (r) => r.displayOrder },
          ]}
        />
      </section>
    </div>
  );
}

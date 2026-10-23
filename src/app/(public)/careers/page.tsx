import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { openCareers } from '@/server/queries/content';

export const metadata: Metadata = { title: 'Careers', description: 'Open roles at Johnson’s Realty.', alternates: { canonical: '/careers' } };

export default async function CareersPage() {
  const roles = await openCareers();
  return (
    <div className="container section stack-lg">
      <header className="stack prose">
        <span className="label label--brass">Careers</span>
        <h1 className="display-m">Work with us</h1>
        <p className="body-l muted">We’re a small team that cares about doing roleplay real estate properly: honest listings, real paperwork, and clients who come back.</p>
      </header>
      {roles.length ? (
        <ul className="role-list">
          {roles.map((r) => (
            <li key={r.id}>
              <div className="stack">
                <h2 className="heading-2">
                  <Link href={`/careers/${r.slug}`}>{r.title}</Link>
                </h2>
                {r.summary ? <p className="body muted">{r.summary}</p> : null}
              </div>
              <Button variant="secondary" href={`/careers/${r.slug}`} iconRight="arrow-right">
                View role
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="users" title="No open roles right now" text="Check back soon, or get in touch if you’d like to work with us." action={<Button variant="secondary" href="/contact">Get in touch</Button>} />
      )}
    </div>
  );
}

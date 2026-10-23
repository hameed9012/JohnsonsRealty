import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CareerForm } from '@/components/public/EnquiryForms';
import { Markdown } from '@/components/public/Markdown';
import { Breadcrumbs } from '@/components/ui/layout';
import { openCareer } from '@/server/queries/content';
import { getActor } from '@/server/session';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await openCareer((await params).slug);
  return r ? { title: r.title, description: r.summary ?? undefined, alternates: { canonical: `/careers/${r.slug}` } } : { title: 'Role not found' };
}

export default async function CareerPage({ params }: Props) {
  const { slug } = await params;
  const [role, actor] = await Promise.all([openCareer(slug), getActor()]);
  if (!role) notFound();
  return (
    <div className="container section stack-lg">
      <Breadcrumbs items={[{ label: 'Careers', href: '/careers' }, { label: role.title }]} />
      <div className="split">
        <article className="stack-lg">
          <header className="stack">
            <span className="label label--brass">Open role</span>
            <h1 className="display-m">{role.title}</h1>
            {role.summary ? <p className="body-l muted">{role.summary}</p> : null}
          </header>
          {role.body ? <Markdown source={role.body} /> : null}
        </article>
        <aside className="panel stack" aria-labelledby="apply-h">
          <h2 id="apply-h" className="heading-2">
            Apply
          </h2>
          <CareerForm signedIn={!!actor} careerId={role.id} path={`/careers/${role.slug}`} />
        </aside>
      </div>
    </div>
  );
}

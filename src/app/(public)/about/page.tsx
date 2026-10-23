import type { Metadata } from 'next';
import { Markdown } from '@/components/public/Markdown';
import { AgentCard } from '@/components/ui/AgentCard';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { activeAgents } from '@/server/queries/sales';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about' } };

export default async function AboutPage() {
  const [s, agents] = await Promise.all([getSettings(), activeAgents()]);
  return (
    <div className="container section stack-lg">
      <header className="stack prose">
        <Logo subline={s.brokerageSubline} />
        <span className="label label--brass">About</span>
        <h1 className="display-m">{s.brokerageName}</h1>
        {s.tagline ? <p className="body-l muted">{s.tagline}</p> : null}
      </header>
      {s.aboutBody ? <Markdown source={s.aboutBody} /> : <p className="body-l muted prose">Our story is being written. In the meantime, meet the team below.</p>}
      {s.civopsLine ? <p className="id muted">{s.civopsLine}</p> : null}
      {agents.length ? (
        <section className="stack-lg">
          <h2 className="heading-1">The team</h2>
          <div className="card-grid">
            {agents.map((a) => (
              <AgentCard key={a.userId} name={a.name} title={a.title ?? undefined} handle={a.chirper ?? undefined} photo={a.photo ?? undefined} href={`/agents/${a.slug}`} actionLabel="View profile" />
            ))}
          </div>
        </section>
      ) : null}
      <div className="row">
        <Button href="/contact">Get in touch</Button>
        <Button variant="secondary" href="/careers">
          Work with us
        </Button>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { AgentCard } from '@/components/ui/AgentCard';
import { EmptyState } from '@/components/ui/blocks';
import { activeAgents } from '@/server/queries/sales';

export const metadata: Metadata = { title: 'Agents', description: 'The agents of Johnson’s Realty.', alternates: { canonical: '/agents' } };

export default async function AgentsIndex() {
  const agents = await activeAgents();
  return (
    <div className="container section stack-lg">
      <header className="stack prose">
        <span className="label label--brass">The team</span>
        <h1 className="display-m">Our agents</h1>
      </header>
      {agents.length ? (
        <div className="card-grid">
          {agents.map((a) => (
            <AgentCard
              key={a.userId}
              name={a.name}
              title={a.title ?? undefined}
              handle={a.chirper ?? undefined}
              photo={a.photo ?? undefined}
              href={`/agents/${a.slug}`}
              actionLabel="View profile"
              stats={[...(a.listings ? [{ value: a.listings, label: 'Listings' }] : []), ...(a.sold ? [{ value: a.sold, label: 'Sales' }] : [])]}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon="users" title="No agent profiles yet" text="Agent profiles appear here once the team is set up." />
      )}
    </div>
  );
}

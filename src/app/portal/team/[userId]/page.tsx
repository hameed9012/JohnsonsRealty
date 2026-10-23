import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AgentProfileForm } from '@/components/portal/AgentProfileForm';
import { ImageField } from '@/components/ui/ImageField';
import { clearImage, getImageTarget, setImage } from '@/server/actions/images';
import { mediaSrc } from '@/server/queries/media';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { agentProfiles, users } from '@/db/schema';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Agent profile' };

export default async function AgentProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const actor = await requireStaff(`/portal/team/${userId}`);
  const manager = can(actor, 'staff.view');
  if (!manager && actor.id !== userId) notFound();
  const [u, p] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.agentProfiles.findFirst({ where: eq(agentProfiles.userId, userId) }),
  ]);
  if (!u || !p) notFound();
  const photo = await mediaSrc(p.photoId);
  const slot = { kind: 'agent' as const, userId };
  return (
    <div className="stack-lg">
      {manager ? <Breadcrumbs items={[{ label: 'Team', href: '/portal/team' }, { label: p.publicName }]} /> : null}
      <div className="stack">
        <span className="label label--brass">Agent profile</span>
        <h1 className="heading-1">{p.publicName}</h1>
        <p className="body muted">
          Signed in as {u.displayName ?? u.name}
          {u.robloxUsername ? <> · Roblox <span className="id">{u.robloxUsername}</span></> : null}
          {u.chirperHandle ? <> · Chirper <span className="id">@{u.chirperHandle}</span></> : null}
        </p>
      </div>
      <div className="panel">
        <ImageField
          label="Agent photo"
          hint="A square in-game portrait. Shown on the Agents page and listings."
          ratio="1 / 1"
          current={photo}
          getTarget={getImageTarget.bind(null, slot)}
          save={setImage.bind(null, slot)}
          clear={clearImage.bind(null, slot)}
        />
      </div>
      <div className="panel">
        <AgentProfileForm
          userId={userId}
          manager={manager}
          owner={actor.role === 'owner' && u.role === 'agent'}
          values={{
            publicName: p.publicName,
            slug: p.slug,
            title: p.title ?? '',
            bio: p.bio ?? '',
            contactLine: p.contactLine ?? '',
            active: p.active,
            displayOrder: String(p.displayOrder),
            wideConfidentialAccess: p.wideConfidentialAccess,
          }}
        />
      </div>
    </div>
  );
}

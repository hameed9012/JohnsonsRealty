import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ProfileForm } from '@/components/account/ProfileForm';
import { ClientPanel } from '@/components/ui/layout';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'Profile', robots: { index: false } };

export default async function ProfilePage() {
  const actor = await requireActor('/account/profile');
  const u = await db.query.users.findFirst({ where: eq(users.id, actor.id) });
  return (
    <div className="stack-lg prose">
      <div className="stack">
        <span className="label label--brass">Account</span>
        <h1 className="heading-1">Profile</h1>
      </div>
      <ClientPanel title="Your details">
        <ProfileForm
          defaults={{ displayName: u?.displayName ?? '', robloxUsername: u?.robloxUsername ?? '', chirperHandle: u?.chirperHandle ?? '' }}
          submitLabel="Save profile"
        />
      </ClientPanel>
    </div>
  );
}

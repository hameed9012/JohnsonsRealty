import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SettingsForm } from '@/components/portal/SettingsForm';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Site settings' };

export default async function SettingsPage() {
  const actor = await requireStaff('/portal/settings');
  if (!can(actor, 'settings.manage')) notFound();
  const s = await getSettings();
  const v = (x: string | null | undefined) => x ?? '';
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Owner</span>
          <h1 className="heading-1">Site settings</h1>
          <p className="body muted">Everything the public site says about the brokerage itself.</p>
        </div>
      </div>
      <SettingsForm
        values={{
          brokerageName: s.brokerageName,
          brokerageSubline: s.brokerageSubline,
          tagline: v(s.tagline),
          heroHeadline: v(s.heroHeadline),
          heroVideoUrl: v(s.heroVideoUrl),
          officeLocation: v(s.officeLocation),
          chirperHandle: v(s.chirperHandle),
          discordInvite: v(s.discordInvite),
          civopsLine: v(s.civopsLine),
          footerText: v(s.footerText),
          aboutBody: v(s.aboutBody),
          adminsCanApprove: s.adminsCanApprove,
          liveEditsNeedReview: s.liveEditsNeedReview,
        }}
      />
    </div>
  );
}

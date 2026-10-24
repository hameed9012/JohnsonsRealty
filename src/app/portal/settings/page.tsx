import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SettingsForm } from '@/components/portal/SettingsForm';
import { Button } from '@/components/ui/Button';
import { ImageField } from '@/components/ui/ImageField';
import { clearImage, getImageTarget, setImage } from '@/server/actions/images';
import { mediaSrc } from '@/server/queries/media';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Site settings' };

export default async function SettingsPage() {
  const actor = await requireStaff('/portal/settings');
  if (!can(actor, 'settings.manage')) notFound();
  const s = await getSettings();
  const v = (x: string | null | undefined) => x ?? '';
  const [hero, map] = await Promise.all([mediaSrc(s.heroMediaId), mediaSrc(s.mapMediaId)]);
  const heroSlot = { kind: 'site-hero' as const };
  const mapSlot = { kind: 'site-map' as const };
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Owner</span>
          <h1 className="heading-1">Site settings</h1>
          <p className="body muted">Everything the public site says about the brokerage itself.</p>
        </div>
        <div className="row">
          <Button variant="secondary" href="/portal/settings/map">
            Property map
          </Button>
          <Button variant="secondary" href="/portal/settings/discord">
            Discord server
          </Button>
          <Button variant="secondary" href="/portal/settings/import">
            Import seller files
          </Button>
        </div>
      </div>
      <section className="panel stack">
        <h2 className="panel-title">Images</h2>
        <div className="grid-12">
          <div className="span-6">
            <ImageField
              label="Home hero photo"
              hint="A wide in-game photo, 21:9. The text sits on a green scrim on the left."
              ratio="21 / 9"
              current={hero}
              getTarget={getImageTarget.bind(null, heroSlot)}
              save={setImage.bind(null, heroSlot)}
              clear={clearImage.bind(null, heroSlot)}
            />
          </div>
          <div className="span-6">
            <ImageField
              label="Map of the playable area (optional)"
              hint="Used for the manual map pins on listings. Without it, map views stay hidden."
              ratio="1 / 1"
              current={map}
              getTarget={getImageTarget.bind(null, mapSlot)}
              save={setImage.bind(null, mapSlot)}
              clear={clearImage.bind(null, mapSlot)}
            />
          </div>
        </div>
      </section>
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

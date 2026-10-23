'use client';

import { useFormAction } from '@/components/forms/useFormAction';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { TextField } from '@/components/ui/fields';
import { saveSettings } from '@/server/actions/admin';

export type SettingsValues = Record<
  'brokerageName' | 'brokerageSubline' | 'tagline' | 'heroHeadline' | 'heroVideoUrl' | 'officeLocation' | 'chirperHandle' | 'discordInvite' | 'civopsLine' | 'footerText' | 'aboutBody',
  string
> & { adminsCanApprove: boolean; liveEditsNeedReview: boolean };

export function SettingsForm({ values }: { values: SettingsValues }) {
  const { formAction, pending, errors } = useFormAction(saveSettings);
  const f = (name: keyof SettingsValues, label: string, extra: Record<string, unknown> = {}) => (
    <TextField label={label} name={name} defaultValue={values[name] as string} error={errors[name]} {...extra} />
  );
  return (
    <form action={formAction} className="stack-lg" noValidate>
      <section className="panel stack">
        <h2 className="panel-title">Brokerage</h2>
        <div className="grid-12">
          <div className="span-6">{f('brokerageName', 'Brokerage name', { required: true })}</div>
          <div className="span-6">{f('brokerageSubline', 'Subline', { hint: 'Under the wordmark, like “Brokerage · Pennsylvania”.' })}</div>
          <div className="span-6">{f('officeLocation', 'Office location', { hint: 'Shown on the contact page and documents.' })}</div>
          <div className="span-6">{f('civopsLine', 'CivOps registration line')}</div>
          <div className="span-6">{f('chirperHandle', 'Chirper handle', { mono: true })}</div>
          <div className="span-6">{f('discordInvite', 'Discord invite link', { mono: true, placeholder: 'https://discord.gg/…' })}</div>
        </div>
        {f('footerText', 'Footer text', { multiline: true, rows: 2 })}
      </section>
      <section className="panel stack">
        <h2 className="panel-title">Home page</h2>
        <div className="grid-12">
          <div className="span-6">{f('heroHeadline', 'Hero headline')}</div>
          <div className="span-6">{f('tagline', 'Tagline')}</div>
        </div>
        {f('heroVideoUrl', 'Hero video URL (optional)', { mono: true, hint: 'A muted looping video. Leave blank to use the hero photo.' })}
        {f('aboutBody', 'About page text', { multiline: true, rows: 8, hint: 'Paragraphs separated by a blank line.' })}
      </section>
      <section className="panel stack">
        <h2 className="panel-title">Review rules</h2>
        <Toggle name="adminsCanApprove" label="Admins can approve listings" hint="When off, only the Owner approves." defaultChecked={values.adminsCanApprove} />
        <Toggle
          name="liveEditsNeedReview"
          label="Agents’ edits to live listings need review"
          hint="The live listing stays public unchanged until the edit is approved."
          defaultChecked={values.liveEditsNeedReview}
        />
      </section>
      <div className="row">
        <Button type="submit" loading={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

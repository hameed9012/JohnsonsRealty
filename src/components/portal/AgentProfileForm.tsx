'use client';

import { useFormAction } from '@/components/forms/useFormAction';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { TextField } from '@/components/ui/fields';
import { saveAgentProfile } from '@/server/actions/admin';

export interface AgentProfileValues {
  publicName: string;
  slug: string;
  title: string;
  bio: string;
  contactLine: string;
  active: boolean;
  displayOrder: string;
  wideConfidentialAccess: boolean;
}

export function AgentProfileForm({ userId, values, manager, owner }: { userId: string; values: AgentProfileValues; manager: boolean; owner: boolean }) {
  const { formAction, pending, errors } = useFormAction(saveAgentProfile.bind(null, userId));
  return (
    <form action={formAction} className="stack-lg" noValidate>
      <div className="grid-12">
        <TextField className="span-6" label="Public name" name="publicName" required defaultValue={values.publicName} error={errors.publicName} />
        <TextField className="span-6" label="Title" name="title" defaultValue={values.title} placeholder="Listing agent" error={errors.title} />
        <TextField className="span-6" label="Profile address" name="slug" mono defaultValue={values.slug} hint="The end of the agent page link." error={errors.slug} />
        <TextField className="span-6" label="Contact line" name="contactLine" defaultValue={values.contactLine} hint="How clients reach this agent in-game." error={errors.contactLine} />
      </div>
      <TextField label="Bio" name="bio" multiline rows={5} defaultValue={values.bio} error={errors.bio} />
      {manager ? (
        <div className="grid-12">
          <div className="span-6">
            <Toggle name="active" label="Show on the Agents page" defaultChecked={values.active} />
          </div>
          <TextField className="span-6" label="Display order" name="displayOrder" mono inputMode="numeric" defaultValue={values.displayOrder} error={errors.displayOrder} />
        </div>
      ) : (
        <>
          <input type="hidden" name="active" value={values.active ? 'on' : ''} />
          <input type="hidden" name="displayOrder" value={values.displayOrder} />
        </>
      )}
      {owner ? (
        <Toggle
          name="wideConfidentialAccess"
          label="Can see confidential fields on every client"
          hint="Off by default: agents see confidential fields only on their own clients."
          defaultChecked={values.wideConfidentialAccess}
        />
      ) : null}
      <div className="row">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

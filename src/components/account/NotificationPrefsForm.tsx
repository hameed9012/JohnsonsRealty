'use client';

import { useFormAction } from '@/components/forms/useFormAction';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import type { NotificationPrefs } from '@/db/schema/auth';
import { saveNotificationPrefs } from '@/server/actions/profile';

export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefs }) {
  const { formAction, pending } = useFormAction(saveNotificationPrefs);
  return (
    <form action={formAction} className="stack">
      <Toggle name="savedSearchAlerts" label="New matches for saved searches" hint="When a listing that matches is approved." defaultChecked={prefs.savedSearchAlerts} />
      <Toggle name="showingUpdates" label="Showing updates" hint="When an agent confirms, moves or cancels a showing." defaultChecked={prefs.showingUpdates} />
      <Toggle name="dealMessages" label="Messages from your agent" hint="New messages on your deal." defaultChecked={prefs.dealMessages} />
      <p className="caption muted">Notifications appear on the bell in your account. Updates about listings you submitted are always sent.</p>
      <div className="row">
        <Button type="submit" variant="secondary" loading={pending}>
          Save notification settings
        </Button>
      </div>
    </form>
  );
}

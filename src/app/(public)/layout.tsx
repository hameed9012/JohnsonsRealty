import { SiteFooter } from '@/components/shell/SiteFooter';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { ToastProvider } from '@/components/ui/Toaster';
import { isStaff } from '@/lib/permissions';
import { getActor } from '@/server/session';
import { getSettings } from '@/server/settings';
import { bellData } from '@/server/notify';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [actor, settings] = await Promise.all([getActor(), getSettings()]);
  const bell = actor ? await bellData(actor.id) : null;
  return (
    <ToastProvider>
      <SiteHeader signedIn={!!actor} staff={isStaff(actor)} bell={bell} />
      <main id="main" className="main">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </ToastProvider>
  );
}

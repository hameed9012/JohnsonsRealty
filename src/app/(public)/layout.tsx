import { SiteFooter } from '@/components/shell/SiteFooter';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { ToastProvider } from '@/components/ui/Toaster';
import { isStaff } from '@/lib/permissions';
import { getActor } from '@/server/session';
import { getSettings } from '@/server/settings';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [actor, settings] = await Promise.all([getActor(), getSettings()]);
  return (
    <ToastProvider>
      <SiteHeader signedIn={!!actor} staff={isStaff(actor)} />
      <main id="main" className="main">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </ToastProvider>
  );
}

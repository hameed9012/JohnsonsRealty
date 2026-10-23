import type { Metadata } from 'next';
import { PortalNav } from '@/components/shell/SideNav';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { ToastProvider } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { can } from '@/lib/permissions';
import { loadBell, markBellRead } from '@/server/actions/notifications';
import { bellData } from '@/server/notify';
import { portalCounts } from '@/server/queries/portal';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: { default: 'Portal', template: '%s · Portal' }, robots: { index: false } };

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', agent: 'Agent', client: 'Client' } as const;

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStaff('/portal');
  const settings = await getSettings();
  const [counts, bell] = await Promise.all([portalCounts(), bellData(actor.id)]);
  const approver = can(actor, 'listing.approve', undefined, settings);
  const manager = can(actor, 'staff.view');

  const groups = [
    {
      items: [
        { icon: 'home' as const, label: 'Dashboard', href: '/portal' },
        ...(approver ? [{ icon: 'stamp' as const, label: 'Review queue', href: '/portal/review', count: counts.pendingReview || undefined }] : []),
      ],
    },
    {
      label: 'Listings',
      items: [
        { icon: 'list' as const, label: 'Listings', href: '/portal/listings' },
        { icon: 'key' as const, label: 'Add listing', href: '/portal/listings/new' },
        { icon: 'image' as const, label: 'Marketing studio', href: '/portal/studio' },
      ],
    },
    {
      label: 'Clients',
      items: [
        { icon: 'users' as const, label: 'Clients', href: '/portal/clients' },
        { icon: 'pipeline' as const, label: 'Deals', href: '/portal/deals' },
        { icon: 'calendar' as const, label: 'Showings', href: '/portal/showings', count: counts.showingsToday || undefined },
        { icon: 'document' as const, label: 'Documents', href: '/portal/documents' },
        { icon: 'inbox' as const, label: 'Support inbox', href: '/portal/inbox', count: counts.openEnquiries || undefined },
      ],
    },
    {
      label: 'Brokerage',
      items: [
        { icon: 'chart' as const, label: 'Sales', href: '/portal/sales' },
        { icon: 'dollar' as const, label: 'Commission', href: '/portal/commission' },
        ...(manager
          ? [
              { icon: 'user' as const, label: 'Team', href: '/portal/team' },
              { icon: 'area' as const, label: 'Areas', href: '/portal/areas' },
              { icon: 'document' as const, label: 'Content', href: '/portal/content' },
              { icon: 'activity' as const, label: 'Activity log', href: '/portal/activity' },
            ]
          : []),
        ...(can(actor, 'settings.manage') ? [{ icon: 'settings' as const, label: 'Site settings', href: '/portal/settings' }] : []),
      ],
    },
  ];

  return (
    <div className="portal" data-theme="dark">
      <a className="skip-link" href="#portal-main">
        Skip to content
      </a>
      <PortalNav groups={groups} user={{ name: actor.displayName, role: ROLE_LABEL[actor.role] }} />
      <ToastProvider>
        <div className="portal-main">
          <header className="portal-header">
            <span className="portal-crumb label">{settings.brokerageName}</span>
            <Button variant="ghost" size="sm" href="/">
              View site
            </Button>
            <NotificationBell initial={bell} load={loadBell} markAllRead={markBellRead} />
          </header>
          <main id="portal-main" className="portal-content">
            {children}
          </main>
        </div>
      </ToastProvider>
    </div>
  );
}

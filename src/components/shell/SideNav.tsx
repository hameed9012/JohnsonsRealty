'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PortalSidebar, type PortalSidebarProps } from '@/components/ui/NavBar';

/** The one item whose href is the longest prefix of the current path is active. */
function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(h + '/'))
    .sort((a, b) => b.length - a.length)[0];
}

export function AccountNav({ items }: { items: { label: string; href: string; icon: IconName }[] }) {
  const pathname = usePathname();
  const active = activeHref(pathname, items.map((i) => i.href));
  return (
    <nav className="account-nav" aria-label="Account">
      <ul>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} aria-current={it.href === active ? 'page' : undefined}>
              <Icon name={it.icon} size={18} />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** PortalSidebar with the active item worked out from the current path. */
export function PortalNav({ groups, user }: PortalSidebarProps) {
  const pathname = usePathname();
  const active = activeHref(pathname, groups.flatMap((g) => g.items.map((i) => i.href)));
  const withActive = groups.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, active: it.href === active })) }));
  return <PortalSidebar groups={withActive} user={user} />;
}

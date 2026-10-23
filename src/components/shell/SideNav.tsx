'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PortalSidebar, type PortalSidebarProps } from '@/components/ui/NavBar';

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
}

export function AccountNav({ items }: { items: { label: string; href: string; icon: IconName; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav className="account-nav" aria-label="Account">
      <ul>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} aria-current={isActive(pathname, it.href, it.exact) ? 'page' : undefined}>
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
  const withActive = groups.map((g) => ({
    ...g,
    items: g.items.map((it) => ({ ...it, active: isActive(pathname, it.href, it.href === '/portal') })),
  }));
  return <PortalSidebar groups={withActive} user={user} />;
}

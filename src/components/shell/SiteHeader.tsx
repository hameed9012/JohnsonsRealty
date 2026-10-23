'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { NavBar } from '@/components/ui/NavBar';
import { NotificationBell, type BellData } from '@/components/ui/NotificationBell';
import { loadBell, markBellRead } from '@/server/actions/notifications';
import { PUBLIC_LINKS } from './links';


export interface SiteHeaderProps {
  signedIn: boolean;
  staff: boolean;
  bell: BellData | null;
}

export function SiteHeader({ signedIn, staff, bell }: SiteHeaderProps) {
  const pathname = usePathname();
  // The menu remembers the path it was opened on, so navigating closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (fn: (o: boolean) => boolean) => setOpenedOn(fn(open) ? pathname : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenedOn(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const links = PUBLIC_LINKS.map((l) => ({ ...l, active: pathname === l.href || pathname.startsWith(l.href + '/') }));
  const account = signedIn ? (
    <>
      {bell ? <NotificationBell initial={bell} load={loadBell} markAllRead={markBellRead} /> : null}
      <Button variant="ghost" size="sm" href="/account" icon="user" className="jr-nav-account">
        Account
      </Button>
    </>
  ) : (
    <Button variant="ghost" size="sm" href={`/signin?callbackUrl=${encodeURIComponent(pathname)}`} className="jr-nav-account">
      Sign in
    </Button>
  );

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <NavBar
        links={links}
        portalHref={staff ? '/portal' : undefined}
        cta={{ label: 'List your property', href: '/account/listings/new' }}
        actions={account}
        onMenu={() => setOpen((o) => !o)}
        menuOpen={open}
      />
      {open ? (
        <nav className="mobile-menu" aria-label="Menu">
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={l.active ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="row">
            <Button href="/account/listings/new" withKey>
              List your property
            </Button>
            {signedIn ? (
              <Button variant="secondary" href="/account" icon="user">
                Account
              </Button>
            ) : (
              <Button variant="secondary" href={`/signin?callbackUrl=${encodeURIComponent(pathname)}`}>
                Sign in
              </Button>
            )}
            {staff ? (
              <Button variant="ghost" href="/portal">
                Portal
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}

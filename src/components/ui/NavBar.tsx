import Link from 'next/link';
import type * as React from 'react';
import { initials } from '@/lib/cx';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';

export interface NavBarProps {
  links: { label: string; href: string; active?: boolean }[];
  homeHref?: string;
  portalHref?: string;
  cta?: { label: string; href: string };
  onMenu?: React.MouseEventHandler;
  /** Addition: extra actions (account link, sign in) before the CTA. */
  actions?: React.ReactNode;
  /** Addition: state for the menu button. */
  menuOpen?: boolean;
}

export function NavBar({ links, homeHref, portalHref, cta, onMenu, actions, menuOpen }: NavBarProps) {
  return (
    <header className="jr-nav">
      <Logo href={homeHref || '/'} small subline={false} />
      <nav aria-label="Main">
        <ul>
          {links.map((l, i) => (
            <li key={i}>
              <Link href={l.href} aria-current={l.active ? 'page' : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="jr-nav-actions">
        {actions}
        {portalHref ? (
          <Button variant="ghost" size="sm" href={portalHref} icon="user">
            Portal
          </Button>
        ) : null}
        {cta ? (
          <Button size="sm" href={cta.href} withKey className="jr-nav-cta">
            {cta.label}
          </Button>
        ) : null}
        <button
          type="button"
          className="jr-btn jr-btn--ghost jr-btn--sm jr-nav-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={onMenu}
        >
          <Icon name="menu" size={20} />
        </button>
      </div>
    </header>
  );
}

export interface PortalSidebarProps {
  groups: { label?: string; items: { icon: IconName; label: string; href: string; active?: boolean; count?: number }[] }[];
  user?: { name: string; role: string };
}

export function PortalSidebar({ groups, user }: PortalSidebarProps) {
  return (
    <aside className="jr-side" aria-label="Portal">
      <Logo tone="dark" small subline="Agent portal" href="/portal" />
      <nav>
        {groups.map((g, gi) => (
          <div key={gi} className="jr-side-section">
            {g.label ? <div className="jr-side-group">{g.label}</div> : null}
            {g.items.map((it, ii) => (
              <Link key={ii} href={it.href} aria-current={it.active ? 'page' : undefined} title={it.label}>
                <Icon name={it.icon} size={18} />
                <span className="jr-side-label">{it.label}</span>
                {it.count !== undefined ? (
                  <span className="jr-side-count" aria-label={`${it.count} waiting`}>
                    {it.count}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      {user ? (
        <div className="jr-side-user">
          <span className="jr-mono-avatar">{initials(user.name)}</span>
          <div>
            <b>{user.name}</b>
            <span>{user.role}</span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

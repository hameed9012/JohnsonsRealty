import { asc, desc, ilike, inArray, or } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActiveToggle, RoleSelect } from '@/components/portal/TeamControls';
import { EmptyState } from '@/components/ui/blocks';
import { DataTable } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { date } from '@/lib/format';
import { can, type Role } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Team' };

type Row = typeof users.$inferSelect;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireStaff('/portal/team');
  if (!can(actor, 'staff.view')) notFound();
  const { q } = await searchParams;
  const staff = await db.select().from(users).where(inArray(users.role, ['owner', 'admin', 'agent'])).orderBy(asc(users.role), asc(users.displayName));
  const term = q?.trim();
  const found = term
    ? await db
        .select()
        .from(users)
        .where(or(ilike(users.displayName, `%${term}%`), ilike(users.name, `%${term}%`), ilike(users.robloxUsername, `%${term}%`)))
        .orderBy(desc(users.createdAt))
        .limit(25)
    : [];

  // Roles this actor may pick for a user, including the current one; empty means show it as text.
  const optionsFor = (u: Row): ('admin' | 'agent' | 'client')[] => {
    if (u.role === 'owner' || u.id === actor.id) return [];
    const opts = (['admin', 'agent', 'client'] as const).filter(
      (r) => r === u.role || can(actor, 'role.assign', { targetId: u.id, targetRole: u.role as Role, newRole: r }),
    );
    return opts.length > 1 ? [...opts] : [];
  };

  const columns = [
    { key: 'name', header: 'Name', cell: (u: Row) => (u.role === 'client' ? u.displayName ?? u.name : <Link href={`/portal/team/${u.id}`}>{u.displayName ?? u.name}</Link>) },
    { key: 'roblox', header: 'Roblox', num: true, cell: (u: Row) => u.robloxUsername ?? '—' },
    { key: 'role', header: 'Role', cell: (u: Row) => <RoleSelect userId={u.id} name={u.displayName ?? u.name ?? 'this user'} role={u.role} options={optionsFor(u)} /> },
    { key: 'status', header: 'Status', cell: (u: Row) => <StatusPill status={u.status === 'active' ? 'active' : 'off-market'} label={u.status === 'active' ? 'Active' : 'Deactivated'} /> },
    { key: 'joined', header: 'Joined', num: true, cell: (u: Row) => date(u.createdAt) },
    {
      key: 'actions',
      header: 'Access',
      cell: (u: Row) =>
        can(actor, 'staff.deactivate', { targetId: u.id, targetRole: u.role as Role }) ? <ActiveToggle userId={u.id} name={u.displayName ?? u.name ?? 'this user'} active={u.status === 'active'} /> : null,
    },
  ];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Brokerage</span>
          <h1 className="heading-1">Team</h1>
          <p className="body muted">Promote people who have signed in. Only the Owner can make someone an Admin.</p>
        </div>
      </div>
      <section className="stack">
        <h2 className="heading-2">Staff</h2>
        <DataTable caption="Staff" rows={staff} rowKey={(u) => u.id} columns={columns} />
      </section>
      <section className="stack">
        <h2 className="heading-2">Find someone</h2>
        <form className="row" role="search" method="get">
          <label className="sr-only" htmlFor="team-q">
            Name or Roblox username
          </label>
          <input id="team-q" className="jr-field-input" name="q" defaultValue={term} placeholder="Name or Roblox username" style={{ maxWidth: 'var(--text-max)' }} />
          <button className="jr-btn jr-btn--secondary jr-btn--sm" type="submit">
            Search
          </button>
        </form>
        {term ? (
          found.length ? (
            <DataTable caption="Search results" rows={found} rowKey={(u) => u.id} columns={columns} />
          ) : (
            <EmptyState title="Nobody by that name" text="They need to sign in with Discord once before you can add them to the team." />
          )
        ) : null}
      </section>
    </div>
  );
}

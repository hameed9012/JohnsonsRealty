// Every authorization decision goes through `can`. Pure and synchronous so it is easy to test;
// callers load the subject (listing, client, deal) and settings, then ask.

export type Role = 'owner' | 'admin' | 'agent' | 'client';

export interface Actor {
  id: string;
  role: Role;
  status: 'active' | 'deactivated';
  /** Agent-level grant: see confidential fields on every client, not just their own. */
  wideConfidentialAccess?: boolean;
}

export interface PermissionSettings {
  adminsCanApprove: boolean;
}

export interface ListingSubject {
  source: 'agent' | 'owner_submitted';
  status: string;
  listingAgentId?: string | null;
  submittedByUserId?: string | null;
}

export interface ClientSubject {
  agentId?: string | null;
  userId?: string | null;
}

export interface DealSubject {
  agentId?: string | null;
  /** User IDs of clients party to the deal. */
  partyUserIds?: string[];
}

export interface RoleChangeSubject {
  targetId: string;
  targetRole: Role;
  newRole: Role;
}

type Subjects = {
  'portal.access': undefined;
  'account.use': undefined;
  'listing.create': undefined;
  'listing.submitOwn': undefined;
  'listing.view': ListingSubject;
  'listing.edit': ListingSubject;
  'listing.withdraw': ListingSubject;
  'listing.changeStatus': ListingSubject;
  'listing.approve': undefined;
  'listing.viewConfidential': ListingSubject;
  'listing.placePin': undefined;
  'client.list': undefined;
  'client.view': ClientSubject;
  'client.edit': ClientSubject;
  'client.viewConfidential': ClientSubject;
  'deal.view': DealSubject;
  'deal.manage': DealSubject;
  'deal.viewConfidential': DealSubject;
  'sale.record': DealSubject;
  'commission.viewAll': undefined;
  'showing.manage': undefined;
  'document.manage': undefined;
  'studio.use': undefined;
  'enquiry.manage': undefined;
  'staff.view': undefined;
  'staff.invite': { role: Role };
  'staff.deactivate': { targetRole: Role; targetId: string };
  'role.assign': RoleChangeSubject;
  'areas.manage': undefined;
  'content.manage': undefined;
  'settings.manage': undefined;
  'activity.view': undefined;
};

export type Action = keyof Subjects;

const STAFF: Role[] = ['owner', 'admin', 'agent'];
const EDITABLE_BY_SUBMITTER = ['draft', 'changes_requested'];

export function isStaff(a: Actor | null | undefined): a is Actor {
  return !!a && a.status === 'active' && STAFF.includes(a.role);
}

function isManager(a: Actor) {
  return a.role === 'owner' || a.role === 'admin';
}

function ownsListing(a: Actor, l: ListingSubject) {
  return l.listingAgentId === a.id || l.submittedByUserId === a.id;
}

export function can<A extends Action>(
  actor: Actor | null | undefined,
  action: A,
  ...rest: Subjects[A] extends undefined ? [subject?: undefined, settings?: PermissionSettings] : [subject: Subjects[A], settings?: PermissionSettings]
): boolean {
  if (!actor || actor.status !== 'active') return false;
  const [subject, settings] = rest as [unknown, PermissionSettings | undefined];
  const a = actor;
  const manager = isManager(a);
  const staff: boolean = STAFF.includes(a.role);

  switch (action) {
    case 'account.use':
    case 'listing.submitOwn':
      return true;

    case 'portal.access':
    case 'listing.create':
    case 'showing.manage':
    case 'document.manage':
    case 'studio.use':
    case 'enquiry.manage':
    case 'client.list':
    case 'listing.placePin':
      return staff;

    case 'listing.view': {
      const l = subject as ListingSubject;
      if (staff) return true;
      return l.submittedByUserId === a.id;
    }

    case 'listing.edit': {
      const l = subject as ListingSubject;
      if (manager) return true;
      if (a.role === 'agent') return ownsListing(a, l);
      // A property owner edits their own submission only while it is a draft or sent back.
      return l.source === 'owner_submitted' && l.submittedByUserId === a.id && EDITABLE_BY_SUBMITTER.includes(l.status);
    }

    case 'listing.withdraw': {
      const l = subject as ListingSubject;
      if (manager) return true;
      if (a.role === 'agent') return ownsListing(a, l);
      return l.source === 'owner_submitted' && l.submittedByUserId === a.id && !['sold', 'leased', 'archived', 'withdrawn', 'rejected'].includes(l.status);
    }

    case 'listing.changeStatus': {
      const l = subject as ListingSubject;
      if (manager) return true;
      return a.role === 'agent' && ownsListing(a, l);
    }

    case 'listing.approve':
      if (a.role === 'owner') return true;
      return a.role === 'admin' && !!settings?.adminsCanApprove;

    case 'listing.viewConfidential': {
      const l = subject as ListingSubject;
      if (manager) return true;
      if (a.role === 'agent') return !!a.wideConfidentialAccess || ownsListing(a, l);
      return false;
    }

    case 'client.view':
    case 'client.edit': {
      const c = subject as ClientSubject;
      if (manager) return true;
      if (a.role === 'agent') return c.agentId === a.id || (action === 'client.view' && !!a.wideConfidentialAccess);
      return false;
    }

    case 'client.viewConfidential': {
      const c = subject as ClientSubject;
      if (manager) return true;
      return a.role === 'agent' && (c.agentId === a.id || !!a.wideConfidentialAccess);
    }

    case 'deal.view': {
      const d = subject as DealSubject;
      if (manager) return true;
      if (a.role === 'agent') return d.agentId === a.id || !!a.wideConfidentialAccess;
      return !!d.partyUserIds?.includes(a.id);
    }

    case 'deal.manage':
    case 'sale.record': {
      const d = subject as DealSubject;
      if (manager) return true;
      return a.role === 'agent' && d.agentId === a.id;
    }

    case 'deal.viewConfidential': {
      const d = subject as DealSubject;
      if (manager) return true;
      return a.role === 'agent' && (d.agentId === a.id || !!a.wideConfidentialAccess);
    }

    case 'commission.viewAll':
    case 'staff.view':
    case 'areas.manage':
    case 'content.manage':
    case 'activity.view':
      return manager;

    case 'staff.invite': {
      const { role } = subject as { role: Role };
      if (role === 'owner') return false;
      if (a.role === 'owner') return true;
      return a.role === 'admin' && role === 'agent';
    }

    case 'staff.deactivate': {
      const t = subject as { targetRole: Role; targetId: string };
      if (t.targetId === a.id || t.targetRole === 'owner') return false;
      if (a.role === 'owner') return true;
      return a.role === 'admin' && (t.targetRole === 'agent' || t.targetRole === 'client');
    }

    case 'role.assign': {
      const r = subject as RoleChangeSubject;
      // There is exactly one Owner, set from OWNER_DISCORD_ID; nobody grants or removes it here.
      if (r.newRole === 'owner' || r.targetRole === 'owner' || r.targetId === a.id) return false;
      if (a.role === 'owner') return true;
      if (a.role === 'admin') return r.targetRole !== 'admin' && r.newRole !== 'admin';
      return false;
    }

    case 'settings.manage':
      return a.role === 'owner';

    default: {
      const never: never = action as never;
      return never;
    }
  }
}

import { describe, expect, it } from 'vitest';
import { can, type Actor, type ListingSubject } from '@/lib/permissions';

const owner: Actor = { id: 'o', role: 'owner', status: 'active' };
const admin: Actor = { id: 'ad', role: 'admin', status: 'active' };
const agent: Actor = { id: 'ag', role: 'agent', status: 'active' };
const otherAgent: Actor = { id: 'ag2', role: 'agent', status: 'active' };
const wideAgent: Actor = { id: 'ag3', role: 'agent', status: 'active', wideConfidentialAccess: true };
const client: Actor = { id: 'c', role: 'client', status: 'active' };
const otherClient: Actor = { id: 'c2', role: 'client', status: 'active' };
const deactivated: Actor = { id: 'x', role: 'owner', status: 'deactivated' };

const approveOn = { adminsCanApprove: true };
const approveOff = { adminsCanApprove: false };

const agentListing: ListingSubject = { source: 'agent', status: 'active', listingAgentId: 'ag', submittedByUserId: 'ag' };
const ownerDraft: ListingSubject = { source: 'owner_submitted', status: 'draft', submittedByUserId: 'c' };
const ownerPending: ListingSubject = { source: 'owner_submitted', status: 'pending_review', submittedByUserId: 'c' };
const ownerChanges: ListingSubject = { source: 'owner_submitted', status: 'changes_requested', submittedByUserId: 'c' };
const ownerLive: ListingSubject = { source: 'owner_submitted', status: 'active', submittedByUserId: 'c' };

describe('visitors and deactivated users', () => {
  it('cannot do anything', () => {
    expect(can(null, 'account.use')).toBe(false);
    expect(can(undefined, 'portal.access')).toBe(false);
    expect(can(deactivated, 'portal.access')).toBe(false);
    expect(can(deactivated, 'settings.manage')).toBe(false);
  });
});

describe('portal access', () => {
  it('is staff only', () => {
    expect(can(owner, 'portal.access')).toBe(true);
    expect(can(admin, 'portal.access')).toBe(true);
    expect(can(agent, 'portal.access')).toBe(true);
    expect(can(client, 'portal.access')).toBe(false);
  });
  it('lets every signed-in user submit their own property', () => {
    for (const a of [owner, admin, agent, client]) expect(can(a, 'listing.submitOwn')).toBe(true);
    expect(can(client, 'listing.create')).toBe(false);
  });
});

describe('listing approval', () => {
  it('Owner always approves', () => {
    expect(can(owner, 'listing.approve', undefined, approveOff)).toBe(true);
  });
  it('Admin approves only when the setting is on', () => {
    expect(can(admin, 'listing.approve', undefined, approveOn)).toBe(true);
    expect(can(admin, 'listing.approve', undefined, approveOff)).toBe(false);
    expect(can(admin, 'listing.approve')).toBe(false);
  });
  it('agents and clients never approve', () => {
    expect(can(agent, 'listing.approve', undefined, approveOn)).toBe(false);
    expect(can(client, 'listing.approve', undefined, approveOn)).toBe(false);
  });
});

describe('listing editing', () => {
  it('managers edit anything', () => {
    expect(can(owner, 'listing.edit', ownerLive)).toBe(true);
    expect(can(admin, 'listing.edit', agentListing)).toBe(true);
  });
  it('agents edit only their own', () => {
    expect(can(agent, 'listing.edit', agentListing)).toBe(true);
    expect(can(otherAgent, 'listing.edit', agentListing)).toBe(false);
  });
  it('property owners edit their submission only while draft or changes requested', () => {
    expect(can(client, 'listing.edit', ownerDraft)).toBe(true);
    expect(can(client, 'listing.edit', ownerChanges)).toBe(true);
    expect(can(client, 'listing.edit', ownerPending)).toBe(false);
    expect(can(client, 'listing.edit', ownerLive)).toBe(false);
    expect(can(otherClient, 'listing.edit', ownerDraft)).toBe(false);
  });
  it('property owners can withdraw their own live or pending listing', () => {
    expect(can(client, 'listing.withdraw', ownerPending)).toBe(true);
    expect(can(client, 'listing.withdraw', ownerLive)).toBe(true);
    expect(can(otherClient, 'listing.withdraw', ownerLive)).toBe(false);
    expect(can(client, 'listing.withdraw', { ...ownerLive, status: 'sold' })).toBe(false);
  });
  it('clients cannot change status directly', () => {
    expect(can(client, 'listing.changeStatus', ownerLive)).toBe(false);
  });
});

describe('confidential fields', () => {
  const mine = { agentId: 'ag' };
  const theirs = { agentId: 'ag2' };
  it('managers see all', () => {
    expect(can(owner, 'client.viewConfidential', theirs)).toBe(true);
    expect(can(admin, 'listing.viewConfidential', agentListing)).toBe(true);
  });
  it('agents see only their own unless granted wider access', () => {
    expect(can(agent, 'client.viewConfidential', mine)).toBe(true);
    expect(can(agent, 'client.viewConfidential', theirs)).toBe(false);
    expect(can(wideAgent, 'client.viewConfidential', theirs)).toBe(true);
    expect(can(otherAgent, 'listing.viewConfidential', agentListing)).toBe(false);
    expect(can(wideAgent, 'listing.viewConfidential', agentListing)).toBe(true);
  });
  it('clients never see confidential fields, even on their own listing', () => {
    expect(can(client, 'listing.viewConfidential', ownerLive)).toBe(false);
    expect(can(client, 'client.viewConfidential', { userId: 'c' })).toBe(false);
    expect(can(client, 'deal.viewConfidential', { partyUserIds: ['c'] })).toBe(false);
  });
  it('wide access lets an agent view but not edit other clients', () => {
    expect(can(wideAgent, 'client.view', theirs)).toBe(true);
    expect(can(wideAgent, 'client.edit', theirs)).toBe(false);
  });
});

describe('deals', () => {
  const deal = { agentId: 'ag', partyUserIds: ['c'] };
  it('parties can view their deal', () => {
    expect(can(client, 'deal.view', deal)).toBe(true);
    expect(can(otherClient, 'deal.view', deal)).toBe(false);
  });
  it('only the deal agent or managers manage it and record sales', () => {
    expect(can(agent, 'deal.manage', deal)).toBe(true);
    expect(can(otherAgent, 'deal.manage', deal)).toBe(false);
    expect(can(owner, 'sale.record', deal)).toBe(true);
    expect(can(client, 'sale.record', deal)).toBe(false);
  });
});

describe('staff and roles', () => {
  it('only the Owner manages site settings', () => {
    expect(can(owner, 'settings.manage')).toBe(true);
    expect(can(admin, 'settings.manage')).toBe(false);
  });
  it('managers handle content and areas; agents do not', () => {
    expect(can(admin, 'areas.manage')).toBe(true);
    expect(can(admin, 'content.manage')).toBe(true);
    expect(can(agent, 'areas.manage')).toBe(false);
  });
  it('nobody grants or removes the Owner role', () => {
    expect(can(owner, 'role.assign', { targetId: 'c', targetRole: 'client', newRole: 'owner' })).toBe(false);
    expect(can(admin, 'role.assign', { targetId: 'o', targetRole: 'owner', newRole: 'client' })).toBe(false);
  });
  it('the Owner grants Admin; Admins cannot', () => {
    expect(can(owner, 'role.assign', { targetId: 'c', targetRole: 'client', newRole: 'admin' })).toBe(true);
    expect(can(admin, 'role.assign', { targetId: 'c', targetRole: 'client', newRole: 'admin' })).toBe(false);
    expect(can(admin, 'role.assign', { targetId: 'ad2', targetRole: 'admin', newRole: 'client' })).toBe(false);
    expect(can(admin, 'role.assign', { targetId: 'c', targetRole: 'client', newRole: 'agent' })).toBe(true);
  });
  it('nobody changes their own role', () => {
    expect(can(admin, 'role.assign', { targetId: 'ad', targetRole: 'admin', newRole: 'agent' })).toBe(false);
  });
  it('invites: Owner any staff role, Admin agents only, never Owner', () => {
    expect(can(owner, 'staff.invite', { role: 'admin' })).toBe(true);
    expect(can(owner, 'staff.invite', { role: 'owner' })).toBe(false);
    expect(can(admin, 'staff.invite', { role: 'agent' })).toBe(true);
    expect(can(admin, 'staff.invite', { role: 'admin' })).toBe(false);
    expect(can(agent, 'staff.invite', { role: 'agent' })).toBe(false);
  });
  it('deactivation protects the Owner and self', () => {
    expect(can(admin, 'staff.deactivate', { targetId: 'o', targetRole: 'owner' })).toBe(false);
    expect(can(owner, 'staff.deactivate', { targetId: 'o', targetRole: 'owner' })).toBe(false);
    expect(can(owner, 'staff.deactivate', { targetId: 'ad', targetRole: 'admin' })).toBe(true);
    expect(can(admin, 'staff.deactivate', { targetId: 'ad2', targetRole: 'admin' })).toBe(false);
    expect(can(admin, 'staff.deactivate', { targetId: 'ag', targetRole: 'agent' })).toBe(true);
  });
  it('activity log and full commission ledger are for managers', () => {
    expect(can(admin, 'activity.view')).toBe(true);
    expect(can(agent, 'activity.view')).toBe(false);
    expect(can(agent, 'commission.viewAll')).toBe(false);
  });
});

import { z } from 'zod';
import { bool, int, text, uuid } from './fields';

const required = (label: string, max = 160) =>
  text(max, label).refine((v) => v !== null, `Add the ${label.toLowerCase()}.`);

export const areaSchema = z.object({
  name: required('Name', 80),
  slug: text(80, 'The slug').refine((v) => v === null || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), 'Use lowercase letters, numbers and hyphens, like north-residential.'),
  parentId: uuid('Choose the parent area from the list.'),
  city: text(80, 'The town'),
  postalCodes: text(200, 'The postal codes').transform((v) =>
    v ? v.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean) : [],
  ),
  description: text(4000, 'The description'),
  police: text(120),
  fire: text(120),
  schoolDistrict: text(120),
  displayOrder: int('Enter a whole number for the order, like 10.', 0, 10000),
  selectable: bool,
});

const url = (label: string) =>
  text(300, label).refine((v) => v === null || /^https:\/\/\S+$/.test(v), `Enter the full ${label.toLowerCase()} starting with https://.`);

export const settingsSchema = z.object({
  brokerageName: required('Brokerage name', 80),
  brokerageSubline: required('Subline', 80),
  tagline: text(200, 'The tagline'),
  heroHeadline: text(120, 'The headline'),
  heroVideoUrl: url('Video URL'),
  officeLocation: text(300, 'The office location'),
  chirperHandle: text(40, 'The Chirper handle').transform((v) => (v ? v.replace(/^@/, '') : v)),
  discordInvite: url('Discord invite link'),
  civopsLine: text(200, 'The CivOps line'),
  footerText: text(500, 'The footer text'),
  aboutBody: text(10000, 'The About text'),
  adminsCanApprove: bool,
  liveEditsNeedReview: bool,
});

export const ROLES = ['owner', 'admin', 'agent', 'client'] as const;

export const roleChangeSchema = z.object({
  userId: z.string().min(1).max(100),
  role: z.enum(['admin', 'agent', 'client']),
});

export const agentProfileSchema = z.object({
  publicName: required('Public name', 80),
  slug: text(80, 'The slug').refine((v) => v === null || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), 'Use lowercase letters, numbers and hyphens, like hameed-johnson.'),
  title: text(80, 'The title'),
  bio: text(3000, 'The bio'),
  contactLine: text(200, 'The contact line'),
  active: bool,
  displayOrder: int('Enter a whole number for the order, like 10.', 0, 10000),
  wideConfidentialAccess: bool,
});

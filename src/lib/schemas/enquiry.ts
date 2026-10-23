import { z } from 'zod';
import { int, oneOf, text, uuid } from './fields';

const required = (label: string, max: number, message: string) => text(max, label).refine((v) => v !== null, message);

export const valuationSchema = z.object({
  addressLine: required('The address', 160, 'Add the property’s address.'),
  areaId: uuid('Choose the area from the list.'),
  propertyType: oneOf(['house', 'apartment', 'business', 'land'] as const, 'Choose the kind of property.'),
  beds: int('Enter the number of bedrooms, like 3.', 0, 50),
  baths: int('Enter the number of bathrooms, like 2.', 0, 50),
  timeline: text(200, 'The timeline'),
  bestContact: required('How to reach you', 300, 'Tell us the best way to reach you.'),
  notes: text(2000, 'Your notes'),
});

export const CONTACT_TOPICS = ['Buying', 'Selling', 'Renting', 'A listing', 'Working with us', 'Something else'] as const;

export const contactSchema = z.object({
  topic: oneOf(CONTACT_TOPICS, 'Choose what it’s about.'),
  message: required('Your message', 4000, 'Write your message.'),
  bestContact: text(300, 'How to reach you'),
  listingId: uuid(),
});

export const careerApplicationSchema = z.object({
  careerId: uuid('Choose the role you’re applying for.').refine((v) => v !== null, 'Choose the role you’re applying for.'),
  experience: required('Your experience', 3000, 'Tell us about your experience.'),
  why: required('Why you', 3000, 'Tell us why you’d like the role.'),
  availability: text(300, 'Your availability'),
  bestContact: text(300, 'How to reach you'),
});

export const postSchema = z.object({
  kind: oneOf(['guide', 'news'] as const, 'Choose guide or news.'),
  title: required('The title', 160, 'Add a title.'),
  slug: text(100, 'The slug').refine((v) => v === null || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), 'Use lowercase letters, numbers and hyphens.'),
  excerpt: text(300, 'The summary'),
  body: text(40000, 'The article'),
  published: z.union([z.string(), z.boolean(), z.null(), z.undefined()]).transform((v) => v === true || v === 'on'),
});

export const careerSchema = z.object({
  title: required('The title', 120, 'Add the role’s title.'),
  slug: text(100, 'The slug').refine((v) => v === null || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), 'Use lowercase letters, numbers and hyphens.'),
  summary: text(300, 'The summary'),
  body: text(20000, 'The description'),
  open: z.union([z.string(), z.boolean(), z.null(), z.undefined()]).transform((v) => v === true || v === 'on'),
  displayOrder: int('Enter a whole number for the order, like 10.', 0, 10000),
});

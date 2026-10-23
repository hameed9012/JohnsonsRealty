import type { StatusKey } from '@/components/ui/status';

export const ENQUIRY_TYPE: Record<string, string> = {
  showing_request: 'Showing request',
  valuation_request: 'Valuation request',
  general_contact: 'Message',
  career_application: 'Career application',
  listing_question: 'Listing question',
};

export const ENQUIRY_PILL: Record<string, { status: StatusKey; label: string }> = {
  new: { status: 'just-listed', label: 'New' },
  open: { status: 'active', label: 'Open' },
  waiting: { status: 'pending-review', label: 'Waiting on them' },
  closed: { status: 'archived', label: 'Closed' },
};

/** Labels for the payload keys we store, in reading order. Unknown keys are shown as-is. */
export const PAYLOAD_LABELS: Record<string, string> = {
  role: 'Role',
  topic: 'About',
  message: 'Message',
  addressLine: 'Property address',
  areaName: 'Area',
  propertyType: 'Kind of property',
  beds: 'Bedrooms',
  baths: 'Bathrooms',
  timeline: 'Timeline',
  experience: 'Experience',
  why: 'Why this role',
  availability: 'Availability',
  bestContact: 'Best way to reach them',
  notes: 'Notes',
};

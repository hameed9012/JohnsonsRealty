import type { StatusKey } from '@/components/ui/status';

export type DocStatus = 'draft' | 'sent' | 'signed';

/** Pill and words for a document's status. Never colour alone: the label always shows. */
export const DOC_STATUS: Record<DocStatus, { s: StatusKey; l: string }> = {
  draft: { s: 'draft', l: 'Draft' },
  sent: { s: 'pending-review', l: 'Waiting for signatures' },
  signed: { s: 'settled', l: 'Signed' },
};

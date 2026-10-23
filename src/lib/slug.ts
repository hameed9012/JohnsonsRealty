export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** "7063 Franklin Court", "Fairview", "JR-2026-00041" → "7063-franklin-court-fairview-00041". */
export function listingSlug(address: string | null, area: string | null, refNo: string): string {
  const tail = refNo.split('-').pop() ?? refNo;
  const head = slugify([address, area].filter(Boolean).join(' '));
  return head ? `${head}-${tail}` : slugify(refNo);
}

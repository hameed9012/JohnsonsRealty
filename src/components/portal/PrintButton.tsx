'use client';

import { Button } from '@/components/ui/Button';

export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <Button icon="document" onClick={() => window.print()}>
      {label}
    </Button>
  );
}

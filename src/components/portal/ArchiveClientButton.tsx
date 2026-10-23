'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { archiveClientAction } from '@/server/actions/ops';

export function ArchiveClientButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await archiveClientAction(id, !archived);
          toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
          router.refresh();
        })
      }
    >
      {archived ? 'Restore' : 'Archive'}
    </Button>
  );
}

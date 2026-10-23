'use client';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/blocks';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container section">
      <EmptyState
        icon="activity"
        title="Something went wrong on our side"
        text={error.digest ? `Try again. If it keeps happening, quote reference ${error.digest}.` : 'Try again in a moment.'}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}

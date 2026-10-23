import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/blocks';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <main id="main" className="container section stack-lg">
      <Logo href="/" />
      <EmptyState
        icon="pin"
        title="We couldn’t find that page"
        text="The listing may have sold or been taken down, or the link may be wrong."
        action={
          <div className="row">
            <Button href="/buy">Browse homes</Button>
            <Button variant="secondary" href="/">
              Go to the home page
            </Button>
          </div>
        }
      />
    </main>
  );
}

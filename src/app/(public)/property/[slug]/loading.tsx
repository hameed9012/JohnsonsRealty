import { Skeleton } from '@/components/ui/layout';

export default function Loading() {
  return (
    <div className="container section stack-lg" role="status" aria-label="Loading listing">
      <Skeleton kind="block" className="gallery-ph" />
      <Skeleton width="30%" />
      <Skeleton width="60%" />
      <Skeleton width="20%" />
    </div>
  );
}

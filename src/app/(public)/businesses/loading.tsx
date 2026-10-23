import { CardSkeletonGrid, Skeleton } from '@/components/ui/layout';

export default function Loading() {
  return (
    <div className="container section stack-lg">
      <Skeleton width="40%" />
      <CardSkeletonGrid count={6} />
    </div>
  );
}

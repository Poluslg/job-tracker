import { CardSkeleton, PageHeaderSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@job-ai/ui';

export default function AnalyzerLoading() {
  return (
    <>
      <PageHeaderSkeleton hasDescription />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-4 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <CardSkeleton rows={6} />
      </div>
    </>
  );
}

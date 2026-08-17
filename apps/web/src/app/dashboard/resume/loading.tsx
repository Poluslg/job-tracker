import { CardSkeleton, PageHeaderSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@job-ai/ui';

export default function ResumeLoading() {
  return (
    <>
      <PageHeaderSkeleton hasDescription />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={2} />
        </div>
        <div className="lg:col-span-2 rounded-card border border-border bg-surface p-4 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

import { Skeleton } from "@job-ai/ui";

export function PageHeaderSkeleton({
  hasDescription = false,
}: {
  hasDescription?: boolean;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-6 w-40" />
        {hasDescription && <Skeleton className="h-4 w-64" />}
      </div>
      <Skeleton className="h-9 w-28" />
    </header>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-12" />
    </div>
  );
}

export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-3">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-7 w-7 rounded-md" />
    </div>
  );
}

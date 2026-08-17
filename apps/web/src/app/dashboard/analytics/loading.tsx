import { CardSkeleton, PageHeaderSkeleton, StatTileSkeleton } from '@/components/Skeletons';

export default function AnalyticsLoading() {
  return (
    <>
      <PageHeaderSkeleton hasDescription />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CardSkeleton rows={6} />
        <CardSkeleton rows={6} />
      </div>
      <div className="mt-4">
        <CardSkeleton rows={8} />
      </div>
    </>
  );
}

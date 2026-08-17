import { JobCardSkeleton, PageHeaderSkeleton } from '@/components/Skeletons';

export default function SavedJobsLoading() {
  return (
    <>
      <PageHeaderSkeleton hasDescription />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

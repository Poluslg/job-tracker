import { CardSkeleton, PageHeaderSkeleton } from '@/components/Skeletons';

export default function CoverLettersLoading() {
  return (
    <>
      <PageHeaderSkeleton hasDescription />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} rows={4} />
        ))}
      </div>
    </>
  );
}

import {
  CardSkeleton,
  PageHeaderSkeleton,
  StatTileSkeleton,
} from "@/components/Skeletons";

export default function DashboardLoading() {
  return (
    <>
      <PageHeaderSkeleton hasDescription />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardSkeleton rows={5} />
        </div>
        <CardSkeleton rows={3} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CardSkeleton rows={5} />
        <CardSkeleton rows={5} />
      </div>
    </>
  );
}

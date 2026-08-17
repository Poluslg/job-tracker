import { PageHeaderSkeleton, TableRowSkeleton } from "@/components/Skeletons";

export default function ApplicationsLoading() {
  return (
    <>
      <PageHeaderSkeleton hasDescription />
      <div className="rounded-card border border-border bg-surface">
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

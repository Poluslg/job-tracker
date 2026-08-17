import { CardSkeleton, PageHeaderSkeleton } from "@/components/Skeletons";

export default function SettingsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={2} />
      </div>
    </>
  );
}

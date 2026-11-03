import { Skeleton } from "@/components/ui/skeleton";

/** Same grid as the dashboard so nothing jumps when the data streams in. */
export function DashboardSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading your dashboard">
      <Skeleton className="mb-6 h-10 w-72" />
      <Skeleton className="h-44 rounded-xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </section>
  );
}

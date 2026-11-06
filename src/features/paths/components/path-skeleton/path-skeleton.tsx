import { Skeleton } from "@/components/ui/skeleton";

/** The path page's shape (header, rule, progress, five course rows) so nothing jumps on stream-in. */
export function PathSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading the path">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="mt-2 mb-6 h-10 w-72" />
      <Skeleton className="mb-6 h-10 w-full max-w-prose" />
      <Skeleton className="mb-6 h-32 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </section>
  );
}

/** The Paths list's shape: one row per path. */
export function PathListSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading paths">
      <Skeleton className="h-20 w-full rounded-xl" />
    </section>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/** The course map's shape (header, banner, two domains) so nothing jumps on stream-in. */
export function CourseMapSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading the course map">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-2 mb-6 h-10 w-56" />
      <Skeleton className="mb-6 h-40 w-full rounded-xl" />
      <Skeleton className="mb-6 h-72 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </section>
  );
}

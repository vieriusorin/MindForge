import type { PathProgress } from "@/engine/path";

export interface PathListItem {
  slug: string;
  name: string;
  isEnrolled: boolean;
  progress: PathProgress;
}

export interface PathListProps {
  paths: readonly PathListItem[];
}

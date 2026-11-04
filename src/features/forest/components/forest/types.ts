import type { ForestView } from "@/engine/forest";

export interface ForestProps {
  forest: ForestView;
  /** MF-0010: skill code → plant page, for seed tiles with something to plant. Absent: no links. */
  plantHrefs?: Readonly<Record<string, string>>;
}

import type {
  CourseMap,
  CourseMapCheckpoint,
  CourseMapDomain,
  CourseMapNode,
} from "@/engine/path";

export interface CourseMapProps {
  packSlug: string;
  map: CourseMap;
}

/** The marker on the one node the next step points at. */
export type StepMarker = "Next" | "Water first";

export interface NextStepBannerProps {
  packSlug: string;
  map: CourseMap;
}

export interface MapDomainProps {
  packSlug: string;
  domain: CourseMapDomain;
  next: CourseMap["next"];
}

export interface MapNodeProps {
  packSlug: string;
  node: CourseMapNode;
  /** "Next" / "Water first" when the next step points here, else null. */
  marker: StepMarker | null;
}

export interface MapCheckpointProps {
  packSlug: string;
  domain: Pick<
    CourseMapDomain,
    "domainCode" | "name" | "doneCount" | "skillCount"
  >;
  checkpoint: CourseMapCheckpoint;
}

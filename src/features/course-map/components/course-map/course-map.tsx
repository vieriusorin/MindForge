import { MapDomain } from "./components/map-domain";
import { NextStepBanner } from "./components/next-step-banner";
import type { CourseMapProps } from "./types";

/**
 * MF-0062: a pack's skills as a vertical map of nodes by domain, each with its real stage and health,
 * one next step, and (exam packs) a Boss Storm checkpoint per domain. Every figure is the engine's.
 */
export function CourseMap({ packSlug, map }: CourseMapProps) {
  return (
    <div className="flex flex-col gap-6">
      <NextStepBanner packSlug={packSlug} map={map} />
      {map.domains.map((domain) => (
        <MapDomain
          key={domain.domainCode}
          packSlug={packSlug}
          domain={domain}
          next={map.next}
        />
      ))}
    </div>
  );
}

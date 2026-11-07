import type { PathContent } from "@/engine/path";
import { type DemoPackInput, planDemoWorlds } from "./plan-demo-world";
import { planPathScenarios } from "./plan-path-scenarios";
import type { DemoWorld, PathScenarioPlan } from "./types";

export interface SeedPlan {
  worlds: DemoWorld[];
  /** Null when no path has every course among this run's packs. */
  pathScenario: PathScenarioPlan | null;
  /** Paths left out: a course was not seeded this run (a `--pack` run), or another path already took the personas. */
  skippedPaths: string[];
}

/**
 * MF-0068: the CLI's one planning call. The pack worlds exactly as `planDemoWorlds` plans them (SC-5), then
 * the path scenarios for the first path by slug whose courses are all among `packs`. One path per run: the
 * personas' emails are per persona, not per path.
 */
export function planSeed({
  now,
  seed,
  youEmail,
  demoDomain,
  packs,
  paths,
  excludeItemIds = [],
}: {
  now: Date;
  seed: number;
  youEmail: string;
  demoDomain: string;
  packs: readonly DemoPackInput[];
  paths: readonly PathContent[];
  excludeItemIds?: readonly string[];
}): SeedPlan {
  const worlds = planDemoWorlds({
    now,
    seed,
    youEmail,
    demoDomain,
    packs,
    excludeItemIds,
  });
  const bySlug = new Map(packs.map((p) => [p.pack.slug, p]));
  let pathScenario: PathScenarioPlan | null = null;
  const skippedPaths: string[] = [];
  const sorted = [...paths].sort((a, b) =>
    a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
  );
  for (const path of sorted) {
    const isSeeded = path.courses.every((slug) => bySlug.has(slug));
    if (!isSeeded || pathScenario) {
      skippedPaths.push(path.slug);
      continue;
    }
    pathScenario = planPathScenarios({
      now,
      seed,
      youEmail,
      demoDomain,
      path,
      courses: path.courses.flatMap((slug) => {
        const input = bySlug.get(slug);
        return input ? [{ pack: input.pack, questions: input.questions }] : [];
      }),
      excludeItemIds,
    });
  }
  return { worlds, pathScenario, skippedPaths };
}

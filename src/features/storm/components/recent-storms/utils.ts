import type { Pack } from "@/engine/pack";
import { scoreStorm, stormSurvived } from "@/engine/storm";
import type {
  FinishedStormInput,
  RecentStormRow,
  RecentStormsInput,
} from "./types";

/** MF-0052 SC-11: how many finished storms the Storm start page lists. */
const RECENT_STORMS_LIMIT = 5;

/** Newest first; a tie on `finishedAt` falls back to `id` descending so the order is stable. */
function byNewest(a: FinishedStormInput, b: FinishedStormInput): number {
  if (a.finishedAt !== b.finishedAt) {
    return a.finishedAt < b.finishedAt ? 1 : -1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

function kindLabelOf(pack: Pack, storm: FinishedStormInput): string {
  if (storm.kind === "full") return "Full Storm";
  const code = storm.domainCode ?? "";
  const domain = pack.domains.find((d) => d.code === code);
  return `Boss Storm: ${domain?.name ?? code}`;
}

/** MF-0052 SC-11: your finished storms of a pack as list rows, newest first, at most 5. */
export function toRecentStormRows({
  pack,
  storms,
}: RecentStormsInput): RecentStormRow[] {
  return [...storms]
    .sort(byNewest)
    .slice(0, RECENT_STORMS_LIMIT)
    .map((storm) => ({
      id: storm.id,
      href: `/storms/${storm.id}`,
      finishedAt: storm.finishedAt,
      kindLabel: kindLabelOf(pack, storm),
      survived: stormSurvived(
        scoreStorm(pack, {
          kind: storm.kind,
          finishedAt: new Date(storm.finishedAt),
          questions: storm.questions,
        }),
      ),
    }));
}

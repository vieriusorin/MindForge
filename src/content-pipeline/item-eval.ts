import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { graphProblem } from "./diagrams";
import {
  type BatchRequest,
  CARD_FLAWS,
  type CorpusEntry,
  DIAGRAM_FLAWS,
  type ItemEvalScore,
  type ItemFlaw,
  type ItemGoldenCase,
  type ItemKind,
  type ItemVerdict,
  type Prompt,
} from "./types";
import { buildVerifierRequests } from "./verifier";

const FLAWS_OF = {
  card: CARD_FLAWS,
  diagram: DIAGRAM_FLAWS,
} as const satisfies Record<ItemKind, readonly ItemFlaw[]>;

/** The flaws the verifier model may name: `empty-break` is code's job (SC-5), so the model never sees it. */
const MODEL_FLAWS = {
  card: ["generic-break", "factual-error", "wrong-citation"],
  diagram: DIAGRAM_FLAWS,
} as const satisfies Record<ItemKind, readonly ItemFlaw[]>;

/** GOAL SC-5: every empty "where it breaks", 80% of each other planted flaw. */
export const ITEM_PASS_RATE = {
  "empty-break": 1,
  "generic-break": 0.8,
  "factual-error": 0.8,
  "wrong-citation": 0.8,
  "wrong-edge": 0.8,
} as const satisfies Record<ItemFlaw, number>;

/** SC-5: one Opus request per card or diagram, its verdict limited to the kind's model flaws. */
export function buildItemVerifierBatch({
  kind,
  items,
  corpus,
  prompt,
}: {
  kind: ItemKind;
  items: { id: string; yaml: string }[];
  corpus: CorpusEntry[];
  prompt: Prompt;
}): BatchRequest[] {
  return buildVerifierRequests({
    items,
    corpus,
    prompt,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["flaws", "notes"],
      properties: {
        flaws: {
          type: "array",
          items: { type: "string", enum: [...MODEL_FLAWS[kind]] },
        },
        notes: { type: "string" },
      },
    },
  });
}

/** A verifier reply for `kind`, checked at the boundary. */
export function itemVerdictSchema(
  kind: ItemKind,
): z.ZodType<{ flaws: ItemFlaw[]; notes: string }> {
  return z.object({
    flaws: z.array(z.enum(MODEL_FLAWS[kind])),
    notes: z.string(),
  });
}

const Breaks = z.array(z.string());
const Graph = z.object({
  nodes: z.array(z.object({ id: z.string() })),
  edges: z.array(z.object({ from: z.string(), to: z.string() })),
});

/**
 * SC-5: the flaws code finds in a raw card or diagram, before any model: a missing, empty or blank
 * "where it breaks" (`empty-break`); a graph the pack schema could not draw (`wrong-edge`).
 */
export function codeCaughtFlaws(
  kind: ItemKind,
  item: Record<string, unknown>,
): ItemFlaw[] {
  if (kind === "card") {
    const breaks = Breaks.safeParse(item.whereItBreaks);
    const empty =
      !breaks.success ||
      breaks.data.length === 0 ||
      breaks.data.some((entry) => entry.trim().length === 0);
    return empty ? ["empty-break"] : [];
  }
  const graph = Graph.safeParse(item);
  return !graph.success || graphProblem(graph.data) ? ["wrong-edge"] : [];
}

/**
 * SC-5: catch rate per flaw of `kind`; a planted case counts as caught when code or the verifier
 * named its flaw (a missing verdict is a miss for the model). A flaw with no planted case rates 1.
 */
export function scoreItemEval({
  kind,
  cases,
  verdicts,
}: {
  kind: ItemKind;
  cases: ItemGoldenCase[];
  verdicts: ItemVerdict[];
}): ItemEvalScore {
  const byId = new Map(verdicts.map((v) => [v.id, v.flaws]));
  const found = (c: ItemGoldenCase): ItemFlaw[] => [
    ...codeCaughtFlaws(kind, c.item),
    ...(byId.get(c.id) ?? []),
  ];
  const flaws = FLAWS_OF[kind];
  const catchRate: Record<string, number> = {};
  for (const flaw of flaws) {
    const planted = cases.filter((c) => c.flaw === flaw);
    const caught = planted.filter((c) => found(c).includes(flaw));
    catchRate[flaw] = planted.length === 0 ? 1 : caught.length / planted.length;
  }
  const falseAlarms = cases.filter(
    (c) => c.flaw === null && found(c).length > 0,
  ).length;
  const passed = flaws.every(
    (flaw) => (catchRate[flaw] ?? 0) >= ITEM_PASS_RATE[flaw],
  );
  return { catchRate, falseAlarms, passed };
}

const Item = z.record(z.string(), z.unknown());
const Meta = { id: z.string().min(1), note: z.string().optional() };
const GOLDEN_FILE = {
  card: z.strictObject({
    cases: z.array(
      z.strictObject({
        ...Meta,
        flaw: z.enum(CARD_FLAWS).nullable(),
        card: Item,
      }),
    ),
  }),
  diagram: z.strictObject({
    cases: z.array(
      z.strictObject({
        ...Meta,
        flaw: z.enum(DIAGRAM_FLAWS).nullable(),
        diagram: Item,
      }),
    ),
  }),
} as const;

/** SC-5: every `*.yaml` golden file of `kind` under `dir`; throws on a malformed file or a duplicate id. */
export function loadItemGoldenCases(
  dir: string,
  kind: ItemKind,
): ItemGoldenCase[] {
  const cases: ItemGoldenCase[] = [];
  const seen = new Set<string>();
  const names = readdirSync(dir)
    .filter((n) => n.endsWith(".yaml"))
    .sort();
  for (const name of names) {
    const raw: unknown = YAML.parse(readFileSync(join(dir, name), "utf8"));
    const read =
      kind === "card"
        ? GOLDEN_FILE.card
            .parse(raw)
            .cases.map((c) => ({ id: c.id, flaw: c.flaw, item: c.card }))
        : GOLDEN_FILE.diagram
            .parse(raw)
            .cases.map((c) => ({ id: c.id, flaw: c.flaw, item: c.diagram }));
    for (const c of read) {
      if (seen.has(c.id))
        throw new Error(`loadItemGoldenCases: duplicate id ${c.id} in ${name}`);
      seen.add(c.id);
      cases.push({ ...c, kind });
    }
  }
  return cases;
}

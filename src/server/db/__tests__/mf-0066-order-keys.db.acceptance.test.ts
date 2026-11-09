/**
 * MF-0066 acceptance (frozen): SC-2, order keys and registry rows are synced from the files and graded by
 * `record_attempt` by SEQUENCE (question keys keep set equality). SC-1's last clause too: the sync refuses
 * a pack with a bad order file and writes nothing. Runs against the LOCAL stack (`pnpm test:db`) over a
 * temp copy of the real packs plus one fixture pack (MF-0012 precedent). `it` blocks share state in order.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import YAML from "yaml";
import { contentHash } from "@/engine/content/hash";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const ROOT = resolve(import.meta.dirname, "../../../..");
const PACK = "mf0066-order";
const ORDER_ID = `${PACK}.D.S1.order-turn`;
const QUESTION_ID = `${PACK}.D.S1.q-two`;
const DIAGRAM_ID = `${PACK}.D.S1.diagram-loop`;
const SOURCE = "https://example.com/mf0066";
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const PACK_YAML = {
  slug: PACK,
  name: "MF-0066 order fixture",
  kind: "course",
  version: 1,
  domains: [
    {
      code: "D",
      name: "Domain",
      weight: 100,
      skills: [{ code: "D.S1", name: "One", weight: 100, sources: [SOURCE] }],
    },
  ],
};

const DIAGRAM = {
  id: DIAGRAM_ID,
  title: "The loop",
  origin: "official",
  direction: "TB",
  nodes: [
    { id: "REQ", label: "Send the request" },
    { id: "RUN", label: "Run the tool" },
    { id: "RES", label: "Send the result" },
  ],
  edges: [
    { from: "REQ", to: "RUN" },
    { from: "RUN", to: "RES" },
    { from: "RES", to: "REQ" },
  ],
  sources: [SOURCE],
};

const ORDER = {
  id: ORDER_ID,
  title: "Put one turn in order",
  origin: "official",
  diagram: DIAGRAM_ID,
  steps: [
    { node: "REQ", label: "Send the request" },
    { node: "RUN", label: "Run the tool" },
    { node: "RES", label: "Send the result" },
  ],
  orderedBy: ["Send the request, run the tool, send the result."],
  explanation: "Request, then tool, then result.",
  source: { title: "Fixture page", url: SOURCE },
};

const QUESTION = {
  id: QUESTION_ID,
  origin: "official",
  stem: "Pick both.",
  select: 2,
  options: [
    { id: "A", text: "One", correct: true, rationale: "Yes." },
    { id: "B", text: "Two", correct: true, rationale: "Yes." },
    { id: "C", text: "Three", correct: false, rationale: "No." },
  ],
  source: { title: "Fixture page", url: SOURCE },
};

let packsDir = "";
let learner: TestUser;

function sync(): { status: number | null; stderr: string } {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MINDFORGE_PACKS_DIR: packsDir,
  };
  delete env.SUPABASE_DB_URL;
  const run = spawnSync(
    process.execPath,
    [join(ROOT, "scripts", "sync-question-keys.mjs")],
    { cwd: ROOT, env, encoding: "utf8" },
  );
  return { status: run.status, stderr: run.stderr };
}

function syncOk(): void {
  const run = sync();
  if (run.status !== 0) throw new Error(`sync failed:\n${run.stderr}`);
}

const writeOrders = (orders: unknown[]): void =>
  writeFileSync(
    join(packsDir, PACK, "orders", "D.S1.yaml"),
    YAML.stringify({ skill: "D.S1", orders }),
  );

async function removeFixtureRows(): Promise<void> {
  const db = sql();
  try {
    await db`delete from private.items where pack_slug = ${PACK}`;
    await db`delete from private.question_keys where pack_slug = ${PACK}`;
    await db`delete from private.pack_skills where pack_slug = ${PACK}`;
    await db`delete from private.packs where slug = ${PACK}`;
  } finally {
    await db.end();
  }
}

async function rec(chosen: string[], id?: string, question = ORDER_ID) {
  const res = await learner.client.rpc("record_attempt", {
    p_question_id: question,
    p_chosen: chosen,
    p_content_hash: null,
    p_client_attempt_id: id ?? randomUUID(),
  });
  return { data: res.data, code: res.error?.code ?? null };
}

beforeAll(async () => {
  packsDir = mkdtempSync(join(tmpdir(), "mf0066-packs-"));
  cpSync(join(ROOT, "packs"), packsDir, { recursive: true });
  const dir = join(packsDir, PACK);
  for (const kind of ["orders", "diagrams", "questions"])
    mkdirSync(join(dir, kind), { recursive: true });
  writeFileSync(join(dir, "pack.yaml"), YAML.stringify(PACK_YAML));
  writeFileSync(
    join(dir, "diagrams", "D.S1.yaml"),
    YAML.stringify({ skill: "D.S1", diagrams: [DIAGRAM] }),
  );
  writeFileSync(
    join(dir, "questions", "D.S1.yaml"),
    YAML.stringify({ skill: "D.S1", questions: [QUESTION] }),
  );
  writeOrders([ORDER]);
  learner = await createTestUser(`mf0066-${RUN}@test.local`);
});

afterAll(async () => {
  if (learner) await deleteTestUser(learner.id); // attempts cascade with the user
  await removeFixtureRows();
  rmSync(packsDir, { recursive: true, force: true });
});

describe("MF-0066 SC-2: order keys and sequence grading", () => {
  it("SC-2: sync writes the key (step nodes in file order, ordered) and an 'order' registry row with its hash", async () => {
    syncOk();
    const db = sql();
    try {
      const keys = await db`
        select question_id, pack_slug, skill_code, correct_options, ordered
        from private.question_keys where pack_slug = ${PACK} order by question_id`;
      expect(keys).toEqual([
        {
          question_id: ORDER_ID,
          pack_slug: PACK,
          skill_code: "D.S1",
          correct_options: ["REQ", "RUN", "RES"],
          ordered: true,
        },
        {
          question_id: QUESTION_ID,
          pack_slug: PACK,
          skill_code: "D.S1",
          correct_options: ["A", "B"],
          ordered: false,
        },
      ]);
      const items = await db`
        select item_id, skill_code, item_type, content_hash
        from private.items where item_id = ${ORDER_ID}`;
      expect(items).toEqual([
        {
          item_id: ORDER_ID,
          skill_code: "D.S1",
          item_type: "order",
          content_hash: contentHash(ORDER),
        },
      ]);
    } finally {
      await db.end();
    }
  });

  it("SC-2: the exact order is right; the same steps in another order and a subset are wrong", async () => {
    expect(await rec(["REQ", "RUN", "RES"])).toEqual({
      data: true,
      code: null,
    });
    expect(await rec(["RUN", "REQ", "RES"])).toEqual({
      data: false,
      code: null,
    });
    expect(await rec(["RES", "RUN", "REQ"])).toEqual({
      data: false,
      code: null,
    });
    expect(await rec(["REQ", "RUN"])).toEqual({ data: false, code: null });

    const rows = await learner.client
      .from("attempts")
      .select("question_id, pack_slug, skill_code, chosen, correct")
      .eq("question_id", ORDER_ID)
      .order("answered_at");
    expect(rows.data).toEqual([
      {
        question_id: ORDER_ID,
        pack_slug: PACK,
        skill_code: "D.S1",
        chosen: ["REQ", "RUN", "RES"],
        correct: true,
      },
      {
        question_id: ORDER_ID,
        pack_slug: PACK,
        skill_code: "D.S1",
        chosen: ["RUN", "REQ", "RES"],
        correct: false,
      },
      {
        question_id: ORDER_ID,
        pack_slug: PACK,
        skill_code: "D.S1",
        chosen: ["RES", "RUN", "REQ"],
        correct: false,
      },
      {
        question_id: ORDER_ID,
        pack_slug: PACK,
        skill_code: "D.S1",
        chosen: ["REQ", "RUN"],
        correct: false,
      },
    ]);
  });

  it("SC-2: a retry with the same client attempt id returns the first grade and writes one row", async () => {
    const id = randomUUID();
    expect(await rec(["RUN", "REQ", "RES"], id)).toEqual({
      data: false,
      code: null,
    });
    expect(await rec(["RUN", "REQ", "RES"], id)).toEqual({
      data: false,
      code: null,
    });
    const db = sql();
    try {
      const [{ n }] = await db`
        select count(*)::int as n from public.attempts
        where user_id = ${learner.id} and client_attempt_id = ${id}`;
      expect(n).toBe(1);
    } finally {
      await db.end();
    }
  });

  it("SC-2: a question key still grades a permutation of its options as right (set equality)", async () => {
    expect(await rec(["B", "A"], undefined, QUESTION_ID)).toEqual({
      data: true,
      code: null,
    });
    expect(await rec(["A", "B"], undefined, QUESTION_ID)).toEqual({
      data: true,
      code: null,
    });
    expect(await rec(["A"], undefined, QUESTION_ID)).toEqual({
      data: false,
      code: null,
    });
  });

  it("SC-2: private.items refuses an unknown item_type (23514) and accepts 'order'", async () => {
    const db = sql();
    try {
      const state = async (type: string): Promise<string> => {
        try {
          await db.begin(async (tx) => {
            await tx`
              insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin)
              values (${`${PACK}.D.S1.probe`}, ${PACK}, 'D.S1', ${type}, 'h', 'official')`;
            throw new Error("rollback");
          });
          return "ok";
        } catch (error) {
          const code = (error as { code?: string }).code;
          return (
            code ??
            (error instanceof Error && error.message === "rollback"
              ? "ok"
              : "error")
          );
        }
      };
      expect(await state("order")).toBe("ok");
      expect(await state("sequence")).toBe("23514");
    } finally {
      await db.end();
    }
  });

  it("SC-1/SC-2: the sync refuses a pack with a bad order file and changes nothing", async () => {
    writeOrders([
      { ...ORDER, steps: [ORDER.steps[0], ORDER.steps[2], ORDER.steps[1]] },
    ]);
    const run = sync();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("orders/D.S1.yaml");
    const db = sql();
    try {
      const [{ correct_options }] = await db`
        select correct_options from private.question_keys where question_id = ${ORDER_ID}`;
      expect(correct_options).toEqual(["REQ", "RUN", "RES"]);
    } finally {
      await db.end();
    }
    writeOrders([ORDER]);
  });

  it("SC-2: an order removed from the files loses its key and registry row", async () => {
    writeOrders([{ ...ORDER, id: `${PACK}.D.S1.order-two` }]);
    syncOk();
    const db = sql();
    try {
      const [{ keys }] =
        await db`select count(*)::int as keys from private.question_keys where question_id = ${ORDER_ID}`;
      const [{ items }] =
        await db`select count(*)::int as items from private.items where item_id = ${ORDER_ID}`;
      const [{ replaced }] =
        await db`select count(*)::int as replaced from private.items where item_id = ${`${PACK}.D.S1.order-two`} and item_type = 'order'`;
      expect({ keys, items, replaced }).toEqual({
        keys: 0,
        items: 0,
        replaced: 1,
      });
    } finally {
      await db.end();
    }
  });
});

/**
 * MF-0007 acceptance (Pollination): review state lives in the database, bound to (item id,
 * content hash), and every rule is enforced there. Runs against the LOCAL stack (pnpm test:db).
 * `it` blocks share state in order. Fixture items live in a throwaway pack so the real content's
 * authors don't matter; SC-1 checks the real packs through the sync script.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import YAML from "yaml";
import { contentHash } from "@/engine/content/hash";
import {
  isPlayable,
  reviewContextFromRows,
  reviewStateOf,
} from "@/engine/content/review";
import type { Origin, ReviewRow } from "@/engine/content/types";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const ROOT = process.cwd();
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = `mf0007-${RUN}`;
const id = (name: string): string => `${PACK}.S1.${name}`;

let A: TestUser; // author of the fixture items
let R1: TestUser; // reviewer
let R2: TestUser; // reviewer
let M: TestUser; // content maintainer (not the analogy owner)
let O: TestUser; // content maintainer + analogy owner
let X: TestUser; // signed in, but in no group for the pack
let GROUP_ID = "";

const ITEMS: {
  name: string;
  type: string;
  origin: Origin;
  author: boolean;
  ageHours: number;
}[] = [
  { name: "q1", type: "question", origin: "ai", author: true, ageHours: 0 },
  { name: "q2", type: "question", origin: "ai", author: true, ageHours: 0 },
  {
    name: "q3",
    type: "question",
    origin: "official",
    author: false,
    ageHours: 0,
  },
  { name: "q4", type: "question", origin: "ai", author: true, ageHours: 0 },
  { name: "q5", type: "question", origin: "ai", author: true, ageHours: 0 },
  { name: "c1", type: "card", origin: "human", author: true, ageHours: 0 },
  { name: "c2", type: "card", origin: "human", author: true, ageHours: 49 },
];

const sync = (): string =>
  execFileSync("node", [join(ROOT, "scripts/sync-question-keys.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SUPABASE_DB_URL: "" },
  });

/** Postgres error code of a failed RPC, or "ok". */
async function rpc(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { error } = await client.rpc(fn, args);
  return error ? (error.code ?? error.message) : "ok";
}

async function states(user: TestUser): Promise<ReviewRow[]> {
  const { data, error } = await user.client.rpc("review_states", {
    p_pack_slug: PACK,
  });
  if (error) throw error;
  return (
    data as {
      item_id: string;
      state: ReviewRow["state"];
      reviewed_at: string | null;
    }[]
  ).map((r) => ({
    itemId: r.item_id,
    state: r.state,
    reviewedAt: r.reviewed_at,
  }));
}

async function stateOf(
  user: TestUser,
  name: string,
): Promise<string | undefined> {
  return (await states(user)).find((r) => r.itemId === id(name))?.state;
}

const approve = (u: TestUser, name: string) =>
  rpc(u.client, "review_item", {
    p_item_id: id(name),
    p_verdict: "approve",
    p_comment: null,
  });
const flag = (u: TestUser, name: string, comment: string | null) =>
  rpc(u.client, "review_item", {
    p_item_id: id(name),
    p_verdict: "flag",
    p_comment: comment,
  });
const resolve = (u: TestUser, name: string, action: string, comment: string) =>
  rpc(u.client, "resolve_flags", {
    p_item_id: id(name),
    p_action: action,
    p_comment: comment,
  });

/** Run a statement that may fail because this ticket's tables don't exist yet (RED phase). */
async function tolerate(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch {
    // table not migrated yet: the SC's own red shows up in the `it` blocks
  }
}

beforeAll(async () => {
  A = await createTestUser(`mf0007-a-${RUN}@test.local`);
  R1 = await createTestUser(`mf0007-r1-${RUN}@test.local`);
  R2 = await createTestUser(`mf0007-r2-${RUN}@test.local`);
  M = await createTestUser(`mf0007-m-${RUN}@test.local`);
  O = await createTestUser(`mf0007-o-${RUN}@test.local`);
  X = await createTestUser(`mf0007-x-${RUN}@test.local`);
  const db = sql();
  try {
    const [g] = await db`
      insert into public.groups (name, pack_slug, invite_code, created_by)
      values ('MF-0007 fixture', ${PACK}, ${`mf7${RUN}`}, ${A.id})
      returning id`;
    GROUP_ID = g?.id as string;
    for (const u of [A, R1, R2, M, O])
      await db`insert into public.group_members (group_id, user_id, role)
               values (${GROUP_ID}, ${u.id}, ${u === A ? "admin" : "member"})`;
    await tolerate(
      () => db`insert into private.content_maintainers (pack_slug, email, is_analogy_owner)
               values (${PACK}, ${M.email}, false), (${PACK}, ${O.email}, true)`,
    );
    for (const it of ITEMS)
      await tolerate(
        () => db`insert into private.items
                   (item_id, pack_slug, skill_code, item_type, content_hash, origin, author_email, hash_synced_at)
                 values (${id(it.name)}, ${PACK}, 'S1', ${it.type}, ${`h-${it.name}-v1`}, ${it.origin},
                         ${it.author ? A.email : null}, now() - make_interval(hours => ${it.ageHours}))`,
      );
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  const db = sql();
  try {
    // child-first; each tolerates a table this ticket hasn't migrated yet
    await tolerate(
      () =>
        db`delete from private.flag_resolutions where item_id like ${`${PACK}.%`}`,
    );
    await tolerate(
      () =>
        db`delete from private.item_reviews where item_id like ${`${PACK}.%`}`,
    );
    await tolerate(
      () => db`delete from private.items where pack_slug = ${PACK}`,
    );
    await tolerate(
      () =>
        db`delete from private.content_maintainers where pack_slug = ${PACK}`,
    );
    if (GROUP_ID) await db`delete from public.groups where id = ${GROUP_ID}`;
  } finally {
    await db.end();
  }
  for (const u of [A, R1, R2, M, O, X]) if (u) await deleteTestUser(u.id);
});

describe("MF-0007 review (Pollination)", () => {
  it("SC-1: sync registers every item of every pack with its content hash; a second run changes nothing", async () => {
    const expected = new Map<string, string>();
    for (const slug of readdirSync(join(ROOT, "packs"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)) {
      for (const [kind, key] of [
        ["questions", "questions"],
        ["cards", "cards"],
        ["diagrams", "diagrams"],
      ] as const) {
        let names: string[] = [];
        try {
          names = readdirSync(join(ROOT, "packs", slug, kind)).filter((n) =>
            n.endsWith(".yaml"),
          );
        } catch {
          continue;
        }
        for (const n of names) {
          const file = YAML.parse(
            readFileSync(join(ROOT, "packs", slug, kind, n), "utf8"),
          );
          for (const raw of file[key] as { id: string }[])
            expected.set(raw.id, contentHash(raw));
        }
      }
    }
    expect(expected.size).toBeGreaterThanOrEqual(56); // 53 questions + 1 card + 2 diagrams in ccdv-f

    sync();
    const db = sql();
    try {
      const read = async () =>
        (
          await db`select item_id, content_hash, hash_synced_at from private.items
                   where pack_slug not like 'mf0007-%' order by item_id`
        ).map(
          (r) =>
            `${r.item_id} ${r.content_hash} ${(r.hash_synced_at as Date).toISOString()}`,
        );
      const first = await read();
      expect(
        new Map(first.map((l) => [l.split(" ")[0], l.split(" ")[1]])),
      ).toEqual(expected);
      sync();
      expect(await read()).toEqual(first);
      const [fixture] =
        await db`select count(*)::int as n from private.items where pack_slug = ${PACK}`;
      expect(fixture?.n).toBe(ITEMS.length); // sync never touches a pack it doesn't own
    } finally {
      await db.end();
    }
  });

  it("SC-2: a user with no group for the pack cannot review; a member can", async () => {
    expect(await approve(X, "q1")).toBe("42501");
    expect(await approve(R1, "q1")).toBe("ok");
  });

  it("SC-3: the author can't approve; one reviewer counts once; two distinct non-authors approve", async () => {
    expect(await approve(A, "q1")).toBe("42501");
    expect(await approve(R1, "q1")).toBe("ok"); // second approval by R1
    expect(await stateOf(R1, "q1")).toBe("unreviewed");
    expect(await approve(R2, "q1")).toBe("ok");
    expect(await stateOf(R1, "q1")).toBe("approved");
  });

  it("SC-4: flags need a comment; an open flag hides; maintainers alone dismiss or reject", async () => {
    expect(await approve(R2, "q2")).toBe("ok");
    expect(await approve(M, "q2")).toBe("ok");
    expect(await stateOf(R1, "q2")).toBe("approved");

    expect(await flag(R1, "q2", null)).toBe("22023");
    expect(await flag(R1, "q2", "   ")).toBe("22023");
    expect(await flag(R1, "q2", "Option C is also correct per the docs.")).toBe(
      "ok",
    );
    expect(await stateOf(R2, "q2")).toBe("flagged");

    expect(await resolve(R2, "q2", "dismiss", "looks fine")).toBe("42501");
    expect(await resolve(R2, "q2", "reject", "wrong")).toBe("42501");
    expect(
      await resolve(M, "q2", "dismiss", "C is a distractor; the key is right."),
    ).toBe("ok");
    expect(await stateOf(R1, "q2")).toBe("approved");

    expect(await flag(R1, "q4", "Cites the wrong page.")).toBe("ok");
    expect(await resolve(M, "q4", "reject", "Unfixable as written.")).toBe(
      "ok",
    );
    expect(await stateOf(R2, "q4")).toBe("rejected");
  });

  it("SC-5: a new content hash makes the item unreviewed again; old reviews stop counting", async () => {
    const db = sql();
    try {
      await db`update private.items set content_hash = 'h-q1-v2', hash_synced_at = now()
               where item_id = ${id("q1")}`;
    } finally {
      await db.end();
    }
    expect(await stateOf(R1, "q1")).toBe("unreviewed");
    expect(await approve(R1, "q1")).toBe("ok"); // a review of the new version
    expect(await stateOf(R1, "q1")).toBe("unreviewed"); // one approval of v2 is not enough
  });

  it("SC-6: official = approved with zero reviews; cards need the analogy owner or the 48 h fallback", async () => {
    expect(await stateOf(R1, "q3")).toBe("approved");

    for (const u of [R1, R2]) expect(await approve(u, "c1")).toBe("ok");
    expect(await stateOf(R1, "c1")).not.toBe("approved");
    expect(
      await rpc(M.client, "approve_analogy", { p_item_id: id("c1") }),
    ).toBe("42501"); // < 48 h
    expect(
      await rpc(R1.client, "approve_analogy", { p_item_id: id("c1") }),
    ).toBe("42501"); // not a maintainer
    expect(
      await rpc(O.client, "approve_analogy", { p_item_id: id("c1") }),
    ).toBe("ok");
    expect(await stateOf(R1, "c1")).toBe("approved");

    for (const u of [R1, R2]) expect(await approve(u, "c2")).toBe("ok");
    expect(await stateOf(R1, "c2")).not.toBe("approved");
    expect(
      await rpc(M.client, "approve_analogy", { p_item_id: id("c2") }),
    ).toBe("ok"); // synced 49 h ago
    expect(await stateOf(R1, "c2")).toBe("approved");
  });

  it("SC-7: the shared reader serves only approved + unreviewed; flagged and rejected never appear", async () => {
    expect(await flag(R2, "q5", "Two options are correct.")).toBe("ok");
    const ctx = reviewContextFromRows(await states(R1));
    const served = ITEMS.filter((it) =>
      isPlayable(
        reviewStateOf(ctx, { id: id(it.name), origin: it.origin }),
        "practice",
      ),
    ).map((it) => it.name);
    expect(served.sort()).toEqual(["c1", "c2", "q1", "q2", "q3"]);
    // R1 reviewed these, so they are spoiled for R1 (and only R1)
    expect([...ctx.spoiledBy].sort()).toEqual(
      ["c1", "c2", "q1", "q2", "q4"].map(id).sort(),
    );
  });
});

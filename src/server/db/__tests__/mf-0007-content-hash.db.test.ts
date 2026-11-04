/**
 * MF-0007 review finding (blocking): a verdict must bind to the version the actor READ, not to
 * whatever hash the registry holds at write time. Between a sync and the deploy the registry can be
 * ahead of the files a reviewer sees; a stale hash is refused (55000) instead of being stored
 * against content nobody read. Runs against the LOCAL stack (pnpm test:db).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = `mf0007h-${RUN}`;
const Q = `${PACK}.S1.q1`;
const CARD = `${PACK}.S1.c1`;

let R: TestUser; // reviewer, member
let M: TestUser; // maintainer + analogy owner, member
let GROUP_ID = "";

async function code(
  user: TestUser,
  fn: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { error } = await user.client.rpc(fn, args);
  return error ? (error.code ?? error.message) : "ok";
}

beforeAll(async () => {
  R = await createTestUser(`mf0007h-r-${RUN}@test.local`);
  M = await createTestUser(`mf0007h-m-${RUN}@test.local`);
  const db = sql();
  try {
    const [g] = await db`
      insert into public.groups (name, pack_slug, invite_code, created_by)
      values ('MF-0007 hash fixture', ${PACK}, ${`mf7h${RUN}`}, ${R.id})
      returning id`;
    GROUP_ID = g?.id as string;
    for (const u of [R, M])
      await db`insert into public.group_members (group_id, user_id, role)
               values (${GROUP_ID}, ${u.id}, ${u === R ? "admin" : "member"})`;
    await db`insert into private.content_maintainers (pack_slug, email, is_analogy_owner)
             values (${PACK}, ${M.email}, true)`;
    await db`insert into private.items
               (item_id, pack_slug, skill_code, item_type, content_hash, origin, author_email)
             values (${Q}, ${PACK}, 'S1', 'question', 'h-new', 'ai', null),
                    (${CARD}, ${PACK}, 'S1', 'card', 'h-new', 'human', null)`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  const db = sql();
  try {
    await db`delete from private.items where pack_slug = ${PACK}`;
    await db`delete from private.content_maintainers where pack_slug = ${PACK}`;
    if (GROUP_ID) await db`delete from public.groups where id = ${GROUP_ID}`;
  } finally {
    await db.end();
  }
  for (const u of [R, M]) if (u) await deleteTestUser(u.id);
});

describe("MF-0007 verdicts bind to the version read", () => {
  it("refuses an approval or a flag of a version the registry no longer holds", async () => {
    const review = (verdict: string, hash: string) =>
      code(R, "review_item", {
        p_item_id: Q,
        p_verdict: verdict,
        p_comment: verdict === "flag" ? "Wrong key." : null,
        p_content_hash: hash,
      });
    expect(await review("approve", "h-old")).toBe("55000");
    expect(await review("flag", "h-old")).toBe("55000");
    expect(await review("approve", "h-new")).toBe("ok");
  });

  it("refuses a maintainer decision or an analogy approval on a version they didn't see", async () => {
    expect(
      await code(R, "review_item", {
        p_item_id: Q,
        p_verdict: "flag",
        p_comment: "Wrong key.",
        p_content_hash: "h-new",
      }),
    ).toBe("ok");
    const resolve = (hash: string) =>
      code(M, "resolve_flags", {
        p_item_id: Q,
        p_action: "reject",
        p_comment: "Unfixable.",
        p_content_hash: hash,
      });
    expect(await resolve("h-old")).toBe("55000");
    expect(await resolve("h-new")).toBe("ok");

    const analogy = (hash: string) =>
      code(M, "approve_analogy", { p_item_id: CARD, p_content_hash: hash });
    expect(await analogy("h-old")).toBe("55000");
    expect(await analogy("h-new")).toBe("ok");
  });

  it("tells the queue which version each candidate is", async () => {
    const { data, error } = await R.client.rpc("list_reviewable", {
      p_pack_slug: PACK,
    });
    expect(error).toBeNull();
    expect(data).toContainEqual(
      expect.objectContaining({ item_id: CARD, content_hash: "h-new" }),
    );
  });
});

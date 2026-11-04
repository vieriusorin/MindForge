/**
 * MF-0011 acceptance (DB half): the cross-user read behind the group heatmap is executable by the
 * server's privileged role only, refuses a viewer who is not a member, returns only the group's
 * members' attempts on the group's pack, and leaves attempts RLS untouched.
 * Runs against the LOCAL stack (pnpm test:db). `it` blocks share the fixture in order.
 * Re-frozen 2026-11-04 (C-3, user approved): the read tells the viewer apart from the others.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchGroupAttempts } from "@/server/groups/fetch-group-attempts";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const FN = "public.group_attempts(uuid,uuid)";
const PRIVATE_FN = "private.group_attempts(uuid,uuid)";

const T0 = "2026-11-01T09:00:00Z"; // M3 reviews Q (spoils it for M3 only)
const T1 = "2026-11-02T09:00:00Z";
const T2 = "2026-11-02T10:00:00Z";
const TX = "2026-11-02T11:11:11Z"; // the non-member's attempt; must never be returned
const TO = "2026-11-02T12:12:12Z"; // a member's attempt on ANOTHER pack; must never be returned
const OTHER_PACK = `mf0011-other-${RUN}`;

let A: TestUser; // creates the group (admin)
let M2: TestUser; // member
let M3: TestUser; // member who reviewed Q before answering it
let X: TestUser; // signed in, not a member
let GROUP_ID = "";
let PACK = "";
let Q = "";
let SKILL = "";

async function rpcError(
  client: SupabaseClient,
  viewerId: string,
): Promise<string> {
  const { error } = await client.rpc("group_attempts", {
    p_group_id: GROUP_ID,
    p_viewer_id: viewerId,
  });
  return error ? (error.code ?? error.message) : "ok";
}

beforeAll(async () => {
  const db = sql();
  try {
    const [row] = await db<
      { question_id: string; skill_code: string; pack_slug: string }[]
    >`
      select k.question_id, k.skill_code, k.pack_slug
      from private.question_keys k
      join private.items i on i.item_id = k.question_id
      join private.packs p on p.slug = k.pack_slug
      order by k.question_id
      limit 1`;
    if (!row) throw new Error("no synced question: run pnpm dev:setup");
    Q = row.question_id;
    SKILL = row.skill_code;
    PACK = row.pack_slug;

    [A, M2, M3, X] = await Promise.all(
      ["a", "m2", "m3", "x"].map((n) =>
        createTestUser(`mf0011-${n}-${RUN}@example.test`),
      ),
    );

    const created = await A.client.rpc("create_group", {
      p_name: `MF-0011 ${RUN}`,
      p_pack_slug: PACK,
    });
    if (created.error) throw created.error;
    GROUP_ID = created.data as string;
    const group = await A.client
      .from("groups")
      .select("invite_code")
      .eq("id", GROUP_ID)
      .single();
    if (group.error) throw group.error;
    for (const member of [M2, M3]) {
      const joined = await member.client.rpc("join_group", {
        p_code: group.data.invite_code,
      });
      if (joined.error) throw joined.error;
    }

    const insert = (user: TestUser, correct: boolean, at: string) => db`
      insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
      values (${user.id}, ${PACK}, ${SKILL}, ${Q}, ${["a"]}, ${correct}, ${at})`;
    await insert(A, true, T1);
    await insert(A, false, T2);
    await insert(M2, true, T1);
    await insert(M3, true, T1);
    await insert(X, true, TX);
    await db`
      insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
      values (${A.id}, ${OTHER_PACK}, ${SKILL}, ${Q}, ${["a"]}, ${true}, ${TO})`;
    await db`
      insert into private.item_reviews (item_id, content_hash, reviewer_id, verdict, created_at)
      select i.item_id, i.content_hash, ${M3.id}, 'approve', ${T0}
      from private.items i where i.item_id = ${Q}`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  // users cascade to attempts, reviews, memberships and the group they created
  await Promise.all(
    [A, M2, M3, X].filter(Boolean).map((u) => deleteTestUser(u.id)),
  );
});

describe("MF-0011 group heatmap read (DB)", () => {
  it("SC-1: a signed-in non-member calling group_attempts directly is refused", async () => {
    const db = sql();
    try {
      const [exists] = await db<{ ok: boolean }[]>`
        select to_regprocedure(${FN}) is not null as ok`;
      expect(exists?.ok).toBe(true);
    } finally {
      await db.end();
    }
    expect(await rpcError(X.client, X.id)).not.toBe("ok");
    expect(await rpcError(X.client, A.id)).not.toBe("ok");
  });

  it("SC-1: the privileged read refuses a viewer who is not a member (42501)", async () => {
    expect(await rpcError(adminClient(), X.id)).toBe("42501");
  });

  it("SC-2: for a member viewer it returns the viewer apart from the others, each with their attempts on the pack and nobody else's, with no identity", async () => {
    const result = await fetchGroupAttempts(adminClient(), GROUP_ID, M2.id);
    expect(Object.keys(result).sort()).toEqual(["others", "viewer"]);
    const members = [result.viewer, ...result.others].filter((m) => m !== null);
    expect(members).toHaveLength(3);
    for (const m of members) {
      expect(Object.keys(m).sort()).toEqual(["attempts", "review"]);
      for (const a of m.attempts) {
        expect(a.questionId).toBe(Q);
        expect(a.skillCode).toBe(SKILL);
        expect(a.answeredAt.toISOString()).not.toBe(new Date(TX).toISOString());
        expect(a.answeredAt.toISOString()).not.toBe(new Date(TO).toISOString());
      }
    }
    // the viewer (M2) answered once; the others are A (twice on this pack) and M3 (once)
    expect(result.viewer?.attempts).toHaveLength(1);
    expect(result.others.map((m) => m.attempts.length).sort()).toEqual([1, 2]);
    // M3's own review spoils Q for M3 only
    expect(result.viewer?.review.spoiledAt.has(Q)).toBe(false);
    const spoiled = result.others.filter((m) => m.review.spoiledAt.has(Q));
    expect(spoiled).toHaveLength(1);
    expect(spoiled[0]?.review.spoiledAt.get(Q)?.toISOString()).toBe(
      new Date(T0).toISOString(),
    );
  });

  it("SC-3: only the server role may execute the read; members can't; attempts RLS still returns own rows only", async () => {
    const db = sql();
    try {
      const [p] = await db<
        {
          auth_pub: boolean;
          anon_pub: boolean;
          auth_priv: boolean;
          anon_priv: boolean;
          service_pub: boolean;
        }[]
      >`
        select has_function_privilege('authenticated', ${FN}, 'EXECUTE') as auth_pub,
               has_function_privilege('anon', ${FN}, 'EXECUTE') as anon_pub,
               has_function_privilege('authenticated', ${PRIVATE_FN}, 'EXECUTE') as auth_priv,
               has_function_privilege('anon', ${PRIVATE_FN}, 'EXECUTE') as anon_priv,
               has_function_privilege('service_role', ${FN}, 'EXECUTE') as service_pub`;
      expect(p).toEqual({
        auth_pub: false,
        anon_pub: false,
        auth_priv: false,
        anon_priv: false,
        service_pub: true,
      });
    } finally {
      await db.end();
    }
    // a member calling it with their own id still gets nothing
    expect(await rpcError(A.client, A.id)).not.toBe("ok");

    const own = await A.client
      .from("attempts")
      .select("user_id")
      .eq("question_id", Q)
      .eq("pack_slug", PACK);
    expect(own.error).toBeNull();
    expect(own.data?.map((r) => r.user_id)).toEqual([A.id, A.id]);
  });
});

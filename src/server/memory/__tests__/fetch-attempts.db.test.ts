/**
 * MF-0003 review (blocking): the Data API caps responses (max_rows = 1000). A learner with more
 * attempts must still get ALL of them, or their newest answers silently stop counting.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/database.types";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";
import { fetchAttempts } from "../fetch-attempts";

const N = 1205;
let A: TestUser;

beforeAll(async () => {
  A = await createTestUser(`mf0003-many-${Date.now()}@test.local`);
  const db = sql();
  try {
    // fixture written as postgres (bypasses RLS); timestamps strictly increasing
    await db`
      insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
      select ${A.id}::uuid, 'ccdv-f', 'D2.S3', 'ccdv-f.D2.S3.q1', array['A'], (g % 2 = 0),
             timestamptz '2026-01-01' + g * interval '1 minute'
      from generate_series(1, ${N}) g`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  if (A) await deleteTestUser(A.id);
});

describe("fetchAttempts", () => {
  it("returns every attempt past the 1000-row API cap, oldest first, newest included", async () => {
    const attempts = await fetchAttempts(
      A.client as SupabaseClient<Database>,
      A.id,
      "ccdv-f",
    );
    expect(attempts).toHaveLength(N);
    expect(attempts.at(-1)?.answeredAt.toISOString()).toBe(
      new Date(Date.UTC(2026, 0, 1) + N * 60_000).toISOString(),
    );
    expect(
      attempts.every(
        (a, i) =>
          i === 0 ||
          a.answeredAt >= (attempts[i - 1]?.answeredAt ?? a.answeredAt),
      ),
    ).toBe(true);
  });
});

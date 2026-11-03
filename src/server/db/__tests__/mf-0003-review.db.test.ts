/** MF-0003 review: record_attempt bounds each chosen option id, even when called directly (no action). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "@/test/local-stack";

let A: TestUser;
beforeAll(async () => {
  A = await createTestUser(`mf0003-review-${Date.now()}@test.local`);
});
afterAll(async () => {
  if (A) await deleteTestUser(A.id);
});

describe("record_attempt input bounds", () => {
  it("refuses an oversized option id and stores nothing", async () => {
    const huge = "A".repeat(10_000);
    const res = await A.client.rpc("record_attempt", {
      p_question_id: "ccdv-f.D2.S3.official-1",
      p_chosen: [huge],
    });
    expect(res.error).not.toBeNull();
    expect((await A.client.from("attempts").select("id")).data).toEqual([]);
  });
});

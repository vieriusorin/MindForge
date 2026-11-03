/**
 * MF-0004 acceptance (SC-6): create_group refuses a well-formed but unregistered pack slug and
 * the 11th group created by one user. Runs against the LOCAL stack with a real user token.
 * Registered packs live in private.packs (slug), written by `pnpm db:sync-keys`; the fixture
 * registers `ccdv-f` itself and tolerates the table not existing yet.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const KNOWN = "ccdv-f";
const UNKNOWN = "mf0004-no-such-pack";
const CAP = 10;
let A: TestUser;

beforeAll(async () => {
  const db = sql();
  try {
    await db`insert into private.packs (slug) values (${KNOWN}) on conflict do nothing`;
  } catch (error) {
    // 42P01: private.packs does not exist before this ticket's migration.
    if ((error as { code?: string }).code !== "42P01") throw error;
  } finally {
    await db.end();
  }
  A = await createTestUser(`mf0004-a-${RUN}@test.local`);
});

afterAll(async () => {
  // child-first: groups (members cascade), then the user.
  if (A) {
    await adminClient().from("groups").delete().eq("created_by", A.id);
    await deleteTestUser(A.id);
  }
});

async function myGroups(): Promise<{ id: string; pack_slug: string }[]> {
  const { data, error } = await A.client
    .from("groups")
    .select("id, pack_slug")
    .eq("created_by", A.id);
  expect(error).toBeNull();
  return data ?? [];
}

describe("MF-0004 create_group hardening", () => {
  it("SC-6: refuses a well-formed but unregistered pack slug", async () => {
    const result = await A.client.rpc("create_group", {
      p_name: "Ghost pack",
      p_pack_slug: UNKNOWN,
    });
    expect(result.error).not.toBeNull();
    expect((await myGroups()).filter((g) => g.pack_slug === UNKNOWN)).toEqual(
      [],
    );
  });

  it("SC-6: allows 10 groups per creator and refuses the 11th", async () => {
    for (let i = 1; i <= CAP; i++) {
      const created = await A.client.rpc("create_group", {
        p_name: `Group ${i}`,
        p_pack_slug: KNOWN,
      });
      expect(created.error, `group ${i}`).toBeNull();
    }
    const eleventh = await A.client.rpc("create_group", {
      p_name: "One too many",
      p_pack_slug: KNOWN,
    });
    expect(eleventh.error).not.toBeNull();
    expect(await myGroups()).toHaveLength(CAP);
  });
});

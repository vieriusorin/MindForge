/**
 * MF-0063 review finding 4: being admin of one group gives no right over another group's
 * discussion link. `set_group_discussion_url` checks the admin role on the TARGET group, so a
 * refactor to a role-only check turns this red. LOCAL stack only (pnpm test:db).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const LINK = "https://chat.example.com/b";

const db = sql();
const users: TestUser[] = [];
const groups: string[] = [];
let adminA: TestUser;
let adminB: TestUser;
let groupB: string;

async function newGroup(owner: TestUser, label: string): Promise<string> {
  const { data, error } = await owner.client.rpc("create_group", {
    p_name: `MF-0063 ${label} ${RUN}`,
    p_pack_slug: "ccdv-f",
  });
  if (error) throw error;
  groups.push(data);
  return data;
}

beforeAll(async () => {
  adminA = await createTestUser(`mf0063-xa-${RUN}@test.local`);
  users.push(adminA);
  adminB = await createTestUser(`mf0063-xb-${RUN}@test.local`);
  users.push(adminB);
  await newGroup(adminA, "A");
  groupB = await newGroup(adminB, "B");
  await db`update public.groups set discussion_url = ${LINK} where id = ${groupB}`;
});

afterAll(async () => {
  try {
    for (const id of groups)
      await db`delete from public.groups where id = ${id}`;
  } finally {
    for (const u of users) await deleteTestUser(u.id);
    await db.end();
  }
});

describe("MF-0063: an admin of another group", () => {
  it("is refused with 42501 and group B's link is unchanged", async () => {
    for (const url of ["https://evil.example/x", null]) {
      const { error } = await adminA.client.rpc("set_group_discussion_url", {
        p_group_id: groupB,
        p_url: url,
      });
      expect(error?.code).toBe("42501");
    }
    const rows = await db<{ discussion_url: string | null }[]>`
      select discussion_url from public.groups where id = ${groupB}`;
    expect(rows[0]?.discussion_url).toBe(LINK);
  });
});

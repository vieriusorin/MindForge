/**
 * MF-0063 acceptance (DB): the group's discussion link. LOCAL stack only (pnpm test:db).
 * - SC-3: the admin sets `groups.discussion_url` through `set_group_discussion_url(p_group_id, p_url)`;
 *   members read it from `public.groups`; non-members read no row; a member or a non-member calling
 *   the function → 42501 and nothing changes; anon can't execute it; no direct UPDATE of the column;
 *   null and '' clear it.
 * - SC-4: the CHECK refuses non-https, user-info, whitespace and > 500 characters even as the table
 *   owner (direct SQL, 23514), and accepts the SC-1 valid values.
 * Literals from .planning/tasks/MF-0063/GOAL.md. The function and column don't exist before this
 * ticket's migration, so the red is a runtime error; the teardown tolerates that.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "ccdv-f";
const LINK = "https://chat.example.com/c/1";
const OTHER_LINK = "https://example.com:8443/x?y=1#z";

const db = sql();
const users: TestUser[] = [];
let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let groupId: string;

async function newUser(tag: string): Promise<TestUser> {
  const u = await createTestUser(`mf0063-${tag}-${RUN}@test.local`);
  users.push(u);
  return u;
}

/** "ok" on success, else the Postgres / PostgREST error code. */
async function code(
  promise: PromiseLike<{ error: { code?: string; message: string } | null }>,
): Promise<string> {
  const { error } = await promise;
  return error ? (error.code ?? error.message) : "ok";
}

async function storedLink(): Promise<string | null> {
  const rows = await db<{ discussion_url: string | null }[]>`
    select discussion_url from public.groups where id = ${groupId}`;
  return rows[0]?.discussion_url ?? null;
}

function setLink(user: TestUser, url: string | null) {
  return user.client.rpc("set_group_discussion_url", {
    p_group_id: groupId,
    p_url: url,
  });
}

beforeAll(async () => {
  admin = await newUser("admin");
  member = await newUser("member");
  outsider = await newUser("outsider");
  const created = await admin.client.rpc("create_group", {
    p_name: `MF-0063 ${RUN}`,
    p_pack_slug: PACK,
  });
  if (created.error) throw created.error;
  groupId = created.data;
  const codeRow = await db<{ invite_code: string }[]>`
    select invite_code from public.groups where id = ${groupId}`;
  const joined = await member.client.rpc("join_group", {
    p_code: codeRow[0]?.invite_code,
  });
  if (joined.error) throw joined.error;
});

afterAll(async () => {
  try {
    if (groupId) await db`delete from public.groups where id = ${groupId}`;
  } finally {
    for (const u of users) await deleteTestUser(u.id);
    await db.end();
  }
});

describe("MF-0063 SC-3: who sets and who reads the link", () => {
  it("the admin sets it and a member reads it from public.groups", async () => {
    expect(await code(setLink(admin, LINK))).toBe("ok");
    const read = await member.client
      .from("groups")
      .select("discussion_url")
      .eq("id", groupId)
      .maybeSingle();
    expect(read.error).toBeNull();
    expect(read.data).toEqual({ discussion_url: LINK });
  });

  it("a non-member reads no row of the group", async () => {
    const read = await outsider.client
      .from("groups")
      .select("discussion_url")
      .eq("id", groupId);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
  });

  it("a member (not admin) is refused with 42501 and nothing changes", async () => {
    await db`update public.groups set discussion_url = ${LINK} where id = ${groupId}`;
    expect(await code(setLink(member, OTHER_LINK))).toBe("42501");
    expect(await code(setLink(member, null))).toBe("42501");
    expect(await storedLink()).toBe(LINK);
  });

  it("a signed-in non-member is refused with 42501 and nothing changes", async () => {
    expect(await code(setLink(outsider, OTHER_LINK))).toBe("42501");
    expect(await storedLink()).toBe(LINK);
  });

  it("anon cannot execute the function", async () => {
    const result = await code(
      anonClient().rpc("set_group_discussion_url", {
        p_group_id: groupId,
        p_url: OTHER_LINK,
      }),
    );
    expect(result).not.toBe("ok");
    expect(await storedLink()).toBe(LINK);
    const grants = await db<{ anon: boolean; pub: boolean }[]>`
      select has_function_privilege('anon', 'public.set_group_discussion_url(uuid, text)', 'execute') as anon,
             exists (
               select 1 from pg_proc p
               cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where p.oid = 'public.set_group_discussion_url(uuid, text)'::regprocedure
                 and a.grantee = 0
             ) as pub`;
    expect(grants[0]).toEqual({ anon: false, pub: false });
  });

  it("the admin cannot write the column by a direct update", async () => {
    const result = await admin.client
      .from("groups")
      .update({ discussion_url: OTHER_LINK })
      .eq("id", groupId);
    expect(result.error?.code).toBe("42501");
    expect(await storedLink()).toBe(LINK);
  });

  it("the admin changes it, and null and '' clear it", async () => {
    expect(await code(setLink(admin, OTHER_LINK))).toBe("ok");
    expect(await storedLink()).toBe(OTHER_LINK);
    expect(await code(setLink(admin, null))).toBe("ok");
    expect(await storedLink()).toBeNull();
    expect(await code(setLink(admin, LINK))).toBe("ok");
    expect(await code(setLink(admin, ""))).toBe("ok");
    expect(await storedLink()).toBeNull();
  });

  it("the function refuses a bad link with 23514", async () => {
    expect(await code(setLink(admin, "javascript:alert(1)"))).toBe("23514");
    expect(await storedLink()).toBeNull();
  });
});

describe("MF-0063 SC-4: the CHECK holds even for the table owner", () => {
  const REFUSED = [
    "http://example.com",
    "javascript:alert(1)",
    "HTTPS://example.com",
    "https://user@evil.example",
    "https://exa mple.com",
    "https://example.com/a b",
    "ftp://example.com",
    "example.com",
    `https://example.com/${"a".repeat(481)}`, // 501 characters
  ];
  const ACCEPTED = [
    "https://chat.example.com/c/1",
    "https://example.com",
    "https://example.com:8443/x?y=1#z",
    `https://example.com/${"a".repeat(480)}`, // 500 characters
  ];

  async function directWrite(url: string): Promise<string> {
    try {
      await db`update public.groups set discussion_url = ${url} where id = ${groupId}`;
      return "ok";
    } catch (error) {
      return (error as { code?: string }).code ?? String(error);
    }
  }

  it("refuses every bad shape with 23514", async () => {
    for (const url of REFUSED)
      expect(await directWrite(url), url).toBe("23514");
  });

  it("accepts the valid shapes", async () => {
    for (const url of ACCEPTED) expect(await directWrite(url), url).toBe("ok");
  });
});

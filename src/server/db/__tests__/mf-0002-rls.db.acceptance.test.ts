/**
 * MF-0002 acceptance: groups, membership and profiles are isolated by RLS at the database.
 * Runs against the LOCAL Supabase stack with real user tokens (pnpm test:db).
 * The `it` blocks run in order and share state: G1 is created in SC-5 and used afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let A: TestUser;
let B: TestUser;
let C: TestUser;
let G1 = "";
let G1Code = "";

beforeAll(async () => {
  A = await createTestUser(`mf0002-a-${RUN}@test.local`);
  B = await createTestUser(`mf0002-b-${RUN}@test.local`);
  C = await createTestUser(`mf0002-c-${RUN}@test.local`);
});

afterAll(async () => {
  // child-first; tolerate tables that do not exist yet (before the migration)
  const admin = adminClient();
  if (G1) await admin.from("groups").delete().eq("id", G1);
  for (const u of [A, B, C]) if (u) await deleteTestUser(u.id);
});

describe("MF-0002 groups and RLS", () => {
  it("SC-6: anon gets nothing; grants are explicit; private functions are not callable by anon", async () => {
    const db = sql();
    try {
      for (const table of ["profiles", "groups", "group_members"]) {
        const [row] = await db`
          select has_table_privilege('anon', ${`public.${table}`}, 'select') as anon_select,
                 has_table_privilege('authenticated', ${`public.${table}`}, 'select') as auth_select`;
        expect({ table, ...row }).toEqual({
          table,
          anon_select: false,
          auth_select: true,
        });
      }
      const privateFns = await db`
        select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_exec
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private'`;
      expect(privateFns.length).toBeGreaterThanOrEqual(2);
      expect(privateFns.filter((f) => f.anon_exec)).toEqual([]);
    } finally {
      await db.end();
    }
    const anon = anonClient();
    for (const table of ["profiles", "groups", "group_members"]) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? []).toEqual([]);
    }
    expect(
      (await anon.rpc("join_group", { p_code: "anything" })).error,
    ).not.toBeNull();
    expect(
      (await anon.rpc("create_group", { p_name: "x", p_pack_slug: "ccdv-f" }))
        .error,
    ).not.toBeNull();
  });

  it("SC-5: create_group is atomic, makes the caller admin, and direct inserts cannot act for others", async () => {
    const created = await A.client.rpc("create_group", {
      p_name: "Cohort",
      p_pack_slug: "ccdv-f",
    });
    expect(created.error).toBeNull();
    G1 = created.data as string;
    expect(G1).toMatch(/^[0-9a-f-]{36}$/);

    const members = await A.client
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", G1);
    expect(members.data).toEqual([{ user_id: A.id, role: "admin" }]);

    const group = await A.client
      .from("groups")
      .select("name, pack_slug, created_by, invite_code")
      .eq("id", G1);
    expect(group.data?.[0]).toMatchObject({
      name: "Cohort",
      pack_slug: "ccdv-f",
      created_by: A.id,
    });
    G1Code = group.data?.[0]?.invite_code as string;
    expect(G1Code.length).toBeGreaterThanOrEqual(16);

    const forged = await B.client
      .from("groups")
      .insert({ name: "Forged", pack_slug: "ccdv-f", created_by: A.id });
    expect(forged.error).not.toBeNull();
    const forgedMember = await B.client
      .from("group_members")
      .insert({ group_id: G1, user_id: C.id, role: "member" });
    expect(forgedMember.error).not.toBeNull();
  });

  it("SC-2: a non-member sees nothing of G1 and cannot add themself; the admin sees G1", async () => {
    expect(
      (await B.client.from("groups").select("id").eq("id", G1)).data,
    ).toEqual([]);
    expect(
      (
        await B.client
          .from("group_members")
          .select("user_id")
          .eq("group_id", G1)
      ).data,
    ).toEqual([]);
    const selfAdd = await B.client
      .from("group_members")
      .insert({ group_id: G1, user_id: B.id, role: "member" });
    expect(selfAdd.error).not.toBeNull();
    expect(
      (await A.client.from("groups").select("id").eq("id", G1)).data,
    ).toEqual([{ id: G1 }]);
    expect(
      (
        await A.client
          .from("group_members")
          .select("user_id, role")
          .eq("group_id", G1)
      ).data,
    ).toEqual([{ user_id: A.id, role: "admin" }]);
  });

  it("SC-7a: profiles: own profile readable and editable, a stranger's is not", async () => {
    const own = await A.client
      .from("profiles")
      .select("id, display_name")
      .eq("id", A.id);
    expect(own.data).toEqual([{ id: A.id, display_name: `mf0002-a-${RUN}` }]);
    const renamed = await A.client
      .from("profiles")
      .update({ display_name: "Ana" })
      .eq("id", A.id)
      .select("display_name");
    expect(renamed.data).toEqual([{ display_name: "Ana" }]);
    const hijack = await A.client
      .from("profiles")
      .update({ display_name: "pwned" })
      .eq("id", B.id)
      .select("id");
    expect(hijack.data ?? []).toEqual([]);
    expect(
      (await B.client.from("profiles").select("id").eq("id", A.id)).data,
    ).toEqual([]);
  });

  it("SC-3: join_group by code adds B as member, is idempotent, and rejects unknown codes", async () => {
    const joined = await B.client.rpc("join_group", { p_code: G1Code });
    expect(joined.error).toBeNull();
    expect(joined.data).toBe(G1);
    const again = await B.client.rpc("join_group", { p_code: G1Code });
    expect(again.error).toBeNull();

    const members = await B.client
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", G1)
      .order("role");
    expect(members.data).toEqual([
      { user_id: A.id, role: "admin" },
      { user_id: B.id, role: "member" },
    ]);
    expect(
      (await B.client.from("groups").select("id").eq("id", G1)).data,
    ).toEqual([{ id: G1 }]);

    const bad = await C.client.rpc("join_group", {
      p_code: "no-such-code-000000",
    });
    expect(bad.error).not.toBeNull();
    expect(
      (
        await C.client
          .from("group_members")
          .select("group_id")
          .eq("user_id", C.id)
      ).data,
    ).toEqual([]);
  });

  it("SC-7b: after joining, B can read A's profile", async () => {
    expect(
      (
        await B.client
          .from("profiles")
          .select("id, display_name")
          .eq("id", A.id)
      ).data,
    ).toEqual([{ id: A.id, display_name: "Ana" }]);
  });

  it("SC-4: only the admin renames or rotates; a rotated code stops working", async () => {
    await B.client.from("groups").update({ name: "Hijacked" }).eq("id", G1);
    await B.client.rpc("rotate_invite_code", { p_group_id: G1 });
    const afterMember = await A.client
      .from("groups")
      .select("name, invite_code")
      .eq("id", G1);
    expect(afterMember.data).toEqual([{ name: "Cohort", invite_code: G1Code }]);

    const rotated = await A.client.rpc("rotate_invite_code", {
      p_group_id: G1,
    });
    expect(rotated.error).toBeNull();
    expect(typeof rotated.data).toBe("string");
    expect(rotated.data).not.toBe(G1Code);

    const stale = await C.client.rpc("join_group", { p_code: G1Code });
    expect(stale.error).not.toBeNull();
    const fresh = await C.client.rpc("join_group", {
      p_code: rotated.data as string,
    });
    expect(fresh.data).toBe(G1);
  });
});

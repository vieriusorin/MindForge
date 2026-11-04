/**
 * MF-0005 acceptance (SC-3): the grants gate. A `public` table created without
 * `revoke all … from anon, authenticated` silently picks up Supabase's default privileges
 * (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN), and TRUNCATE bypasses RLS (MF-0002 retro).
 *
 * Every privilege that `anon`, `authenticated` or `PUBLIC` holds in `public` and `private`
 * (relation-level and column-level), plus EXECUTE on `public` functions for `anon` / `PUBLIC`,
 * must EQUAL the allow-list below. Adding a grant in a migration means adding its line here.
 *
 * Read-only against the LOCAL stack. A regression lock, frozen green (FROZEN.json).
 */
import { describe, expect, it } from "vitest";
import { sql } from "@/test/local-stack";

/** `schema.relation[.column] grantee PRIVILEGE`, sorted. From the MF-0002 / MF-0003 migrations. */
const RELATION_ALLOW_LIST = [
  "public.attempts authenticated SELECT",
  "public.group_members authenticated SELECT",
  "public.groups authenticated SELECT",
  "public.profiles authenticated SELECT",
  "public.storm_questions authenticated SELECT", // MF-0013 C-5, approved 2026-11-04
  "public.storms authenticated SELECT", // MF-0013 C-5, approved 2026-11-04
];

const COLUMN_ALLOW_LIST = [
  "public.groups.name authenticated UPDATE",
  "public.profiles.display_name authenticated UPDATE",
];

/** No `public` function is callable without signing in. */
const ANON_FUNCTION_ALLOW_LIST: string[] = [];

const GATED_SCHEMAS = ["public", "private"];

describe("MF-0005 grants gate", () => {
  it("SC-3: relation privileges of anon/authenticated/PUBLIC equal the allow-list", async () => {
    const db = sql();
    try {
      const rows = await db<{ line: string }[]>`
        select n.nspname || '.' || c.relname || ' '
               || case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end
               || ' ' || a.privilege_type as line
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
        where n.nspname = any(${GATED_SCHEMAS})
          and c.relkind in ('r', 'p', 'v', 'm', 'f')
          and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole))
        order by 1`;
      expect(rows.map((r) => r.line)).toEqual(RELATION_ALLOW_LIST);
    } finally {
      await db.end();
    }
  });

  it("SC-3: column privileges of anon/authenticated/PUBLIC equal the allow-list", async () => {
    const db = sql();
    try {
      const rows = await db<{ line: string }[]>`
        select n.nspname || '.' || c.relname || '.' || att.attname || ' '
               || case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end
               || ' ' || a.privilege_type as line
        from pg_attribute att
        join pg_class c on c.oid = att.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        cross join lateral aclexplode(att.attacl) a
        where n.nspname = any(${GATED_SCHEMAS})
          and att.attacl is not null
          and not att.attisdropped
          and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole))
        order by 1`;
      expect(rows.map((r) => r.line)).toEqual(COLUMN_ALLOW_LIST);
    } finally {
      await db.end();
    }
  });

  it("SC-3: no public function is executable by anon or PUBLIC outside the allow-list", async () => {
    const db = sql();
    try {
      const rows = await db<{ line: string }[]>`
        select p.oid::regprocedure::text || ' '
               || case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end
               || ' ' || a.privilege_type as line
        from pg_proc p
        cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.pronamespace = 'public'::regnamespace
          and (a.grantee = 0 or a.grantee = 'anon'::regrole)
        order by 1`;
      expect(rows.map((r) => r.line)).toEqual(ANON_FUNCTION_ALLOW_LIST);
    } finally {
      await db.end();
    }
  });
});

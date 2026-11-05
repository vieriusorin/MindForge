import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sql, TransactionSql } from "postgres";
import type { DemoWorld, SeedManifest } from "./types";

/** MF-0034: every pack world plans the same six learners; anything else is a planner bug. */
function sharedLearners(worlds: readonly DemoWorld[]): DemoWorld["learners"] {
  const [head, ...tail] = worlds;
  if (!head) throw new Error("seedDemoWorlds: no world to seed");
  const key = (w: DemoWorld) =>
    w.learners.map((l) => `${l.persona}:${l.email.toLowerCase()}`).join(",");
  for (const w of tail)
    if (key(w) !== key(head))
      throw new Error(
        `seedDemoWorlds: ${w.group.packSlug} plans other learners than ${head.group.packSlug}`,
      );
  return head.learners;
}

/**
 * MF-0029 / MF-0034: the rules `review_item` would apply, checked for one world: its pack is registered,
 * and every planned review targets the registry's current hash of an item that is not rejected and not
 * the reviewer's own. Run before any delete (so a bad pack keeps the previous world) and again inside
 * the write transaction.
 */
async function assertWorldSeedable(
  db: Sql | TransactionSql,
  world: DemoWorld,
): Promise<void> {
  const { packSlug } = world.group;
  const [pack] = await db<{ slug: string }[]>`
    select slug from private.packs where slug = ${packSlug}`;
  if (!pack)
    throw new Error(
      `seedDemoWorld: pack "${packSlug}" is not registered: run pnpm db:sync-keys`,
    );
  for (const review of world.reviews) {
    const [item] = await db<
      { content_hash: string; author_email: string | null }[]
    >`
      select content_hash, lower(author_email) as author_email
      from private.items where item_id = ${review.itemId}`;
    if (!item || item.content_hash !== review.contentHash)
      throw new Error(
        `seedDemoWorld: the review registry is stale for ${review.itemId}: run pnpm db:sync-keys`,
      );
    const [state] = await db<{ state: string }[]>`
      select private.item_state(${review.itemId}) as state`;
    if (state?.state === "rejected")
      throw new Error(
        `seedDemoWorld: ${review.itemId} was rejected by a maintainer; review_item refuses it (re-run plans around resolved items)`,
      );
    if (item.author_email === review.reviewerEmail.toLowerCase())
      throw new Error(
        `seedDemoWorld: ${review.reviewerEmail} would review their own item`,
      );
  }
}

/** A demo domain must look like a domain, so the delete below can never match every address. */
export function assertDemoDomain(domain: string): string {
  const clean = domain.trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(clean))
    throw new Error(`seedDemoWorld: "${domain}" is not a demo email domain`);
  return clean;
}

async function createConfirmedUser(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  // No password: the app signs in by magic link only; locally the link arrives in Mailpit.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw new Error(
      `seedDemoWorld: could not create ${email}: ${created.error?.message ?? "no user"}`,
    );
  return created.data.user.id;
}

/** MF-0029 SC-4..SC-6: one pack's demo world; `seedDemoWorlds` with a single world. */
export async function seedDemoWorld({
  world,
  ...rest
}: {
  sql: Sql;
  admin: SupabaseClient;
  world: DemoWorld;
  demoDomain: string;
  youEmail: string;
  previous: SeedManifest | null;
}): Promise<SeedManifest> {
  return seedDemoWorlds({ ...rest, worlds: [world] });
}

/**
 * MF-0034: one demo world for several packs. The learners are shared (every world must plan the same
 * ones); each world adds one group with its answers and reviews, and all of them are written in one
 * transaction, so one pack's failure writes no group at all.
 *
 * MF-0029 SC-4..SC-6: written to the LOCAL stack (the caller has passed `assertLocalSeedTarget`).
 * Deletes only (a) users whose email ends with `@demoDomain` — the admin API cascades their profiles,
 * attempts, reviews, memberships and their group — and (b) the attempt ids the previous run recorded
 * for you, and only if they are yours. Users go through the admin API; everything else is one
 * transaction as the local superuser, re-checking the rules the RPCs would apply. Returns your
 * seeded attempt ids for the next run.
 */
export async function seedDemoWorlds({
  sql,
  admin,
  worlds,
  demoDomain,
  youEmail,
  previous,
}: {
  sql: Sql;
  admin: SupabaseClient;
  worlds: readonly DemoWorld[];
  demoDomain: string;
  youEmail: string;
  previous: SeedManifest | null;
}): Promise<SeedManifest> {
  const learners = sharedLearners(worlds);
  const domain = assertDemoDomain(demoDomain);
  const suffix = `@${domain}`;
  const you = youEmail.trim().toLowerCase();
  if (you.endsWith(suffix))
    throw new Error("seedDemoWorld: your email must not be a demo address");

  // MF-0034 review: refuse a world that cannot be seeded before anything is deleted.
  for (const learner of learners)
    if (
      learner.persona !== "you" &&
      !learner.email.toLowerCase().endsWith(suffix)
    )
      throw new Error(
        `seedDemoWorld: ${learner.email.toLowerCase()} is not on the demo domain`,
      );
  for (const world of worlds) await assertWorldSeedable(sql, world);

  // (a) the previous demo world
  const old = await sql<{ id: string }[]>`
    select id from auth.users
    where right(lower(email), ${suffix.length}) = ${suffix}`;
  for (const { id } of old) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error)
      throw new Error(`seedDemoWorld: delete demo user: ${error.message}`);
  }

  // (c) you: reuse your account, or recreate it after a `pnpm db:reset`
  const [existing] = await sql<{ id: string }[]>`
    select id from auth.users where lower(email) = ${you}`;
  const youId = existing?.id ?? (await createConfirmedUser(admin, you));

  // (b) your rows from the previous run, and only yours: same account (ids restart after a reset)
  if (previous && previous.youId === youId && previous.youAttemptIds.length > 0)
    await sql`
      delete from public.attempts
      where id = any(${previous.youAttemptIds}::bigint[]) and user_id = ${youId}`;

  // (d) the demo learners
  const idOf = new Map<string, string>([[you, youId]]);
  for (const learner of learners) {
    if (learner.persona === "you") continue;
    const email = learner.email.toLowerCase();
    const id = await createConfirmedUser(admin, email);
    idOf.set(email, id);
    await sql`update public.profiles set display_name = ${learner.displayName} where id = ${id}`;
  }
  const userId = (email: string): string => {
    const id = idOf.get(email.toLowerCase());
    if (!id) throw new Error(`seedDemoWorld: no user for ${email}`);
    return id;
  };

  // (e) group, members, attempts, reviews, your maintainer row: all or nothing
  const youAttemptIds = await sql.begin(async (tx) => {
    const mine: number[] = [];
    for (const world of worlds) {
      const { packSlug } = world.group;
      await assertWorldSeedable(tx, world);

      const creatorId = userId(world.group.createdByEmail);
      const [group] = await tx<{ id: string }[]>`
        insert into public.groups (name, pack_slug, invite_code, created_by)
        values (${world.group.name}, ${packSlug}, replace(gen_random_uuid()::text, '-', ''), ${creatorId})
        returning id`;
      if (!group)
        throw new Error("seedDemoWorld: group insert returned nothing");
      for (const learner of learners) {
        const id = userId(learner.email);
        const role = id === creatorId || id === youId ? "admin" : "member";
        await tx`
          insert into public.group_members (group_id, user_id, role)
          values (${group.id}, ${id}, ${role})`;
      }

      const rows = world.attempts.map((t) => ({
        user_id: userId(t.email),
        pack_slug: t.packSlug,
        skill_code: t.skillCode,
        question_id: t.questionId,
        chosen: t.chosen,
        correct: t.correct,
        answered_at: t.answeredAt.toISOString(),
      }));
      const inserted =
        rows.length === 0
          ? []
          : await tx<{ id: string; user_id: string }[]>`
              insert into public.attempts
                (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
              select user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at
              from jsonb_to_recordset(${tx.json(rows)}) as r(
                user_id uuid, pack_slug text, skill_code text, question_id text,
                chosen text[], correct boolean, answered_at timestamptz)
              returning id::text, user_id::text`;

      for (const review of world.reviews) {
        await tx`
          insert into private.item_reviews (item_id, content_hash, reviewer_id, verdict, comment, created_at)
          values (${review.itemId}, ${review.contentHash}, ${userId(review.reviewerEmail)},
                  ${review.verdict}, ${review.comment}, ${review.createdAt.toISOString()})`;
      }

      await tx`
        insert into private.content_maintainers (pack_slug, email, is_analogy_owner)
        values (${packSlug}, ${you}, true)
        on conflict (pack_slug, email) do update set is_analogy_owner = true`;

      mine.push(
        ...inserted.filter((r) => r.user_id === youId).map((r) => Number(r.id)),
      );
    }
    return mine;
  });

  return { youId, youAttemptIds };
}

/**
 * MF-0029 review: items a maintainer has already resolved (dismissed or rejected flags). Resolutions
 * belong to you and survive a re-run, so the planner keeps its reviews off these items.
 */
export async function listResolvedItems(sql: Sql): Promise<string[]> {
  const rows = await sql<{ item_id: string }[]>`
    select distinct item_id from private.flag_resolutions order by item_id`;
  return rows.map((r) => r.item_id);
}

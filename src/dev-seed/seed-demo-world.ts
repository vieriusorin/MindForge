import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sql, TransactionSql } from "postgres";
import type { DemoWorld, PathScenarioPlan, SeedManifest } from "./types";

interface StormGuardContext {
  /** Null before your account exists (then nothing can be spoiled for you). */
  youId: string | null;
  youEmail: string;
  demoSuffix: string;
  now: Date;
}

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

/**
 * MF-0052 SC-3: the rules `start_storm` applies to a question (synced question of this pack with a key,
 * skill in `pack_skills` under the planned domain, current hash, not rejected, no open flag by a real
 * reviewer, not reviewed by its owner), plus what only a plan can get wrong (a storm that has not ended,
 * a question its owner reviews or anyone flags in the plan) and the expedition's domain. Runs for ALL
 * worlds before any delete, and again inside the write transaction.
 */
async function assertStormsSeedable(
  db: Sql | TransactionSql,
  world: DemoWorld,
  { youId, youEmail, demoSuffix, now }: StormGuardContext,
): Promise<void> {
  const { packSlug } = world.group;
  const flaggedInPlan = new Set(
    world.reviews.filter((r) => r.verdict === "flag").map((r) => r.itemId),
  );
  for (const storm of world.storms) {
    if (storm.endsAt.getTime() >= now.getTime())
      throw new Error(
        `seedDemoWorld: a planned storm of ${storm.email} has not ended yet; finalize_storm would finish it now`,
      );
    const ownReviews = new Set(
      world.reviews
        .filter(
          (r) => r.reviewerEmail.toLowerCase() === storm.email.toLowerCase(),
        )
        .map((r) => r.itemId),
    );
    const isYours = storm.email.toLowerCase() === youEmail;
    for (const q of storm.questions) {
      if (ownReviews.has(q.questionId))
        throw new Error(
          `seedDemoWorld: ${q.questionId} is spoiled for ${storm.email}: they review it in the plan`,
        );
      if (flaggedInPlan.has(q.questionId))
        throw new Error(
          `seedDemoWorld: ${q.questionId} is flagged in the plan, so it is not a playable storm question`,
        );
      const [row] = await db<
        {
          item_type: string;
          content_hash: string;
          has_key: boolean;
          domain_code: string | null;
          state: string;
          real_flag: boolean;
          you_reviewed: boolean;
        }[]
      >`
        select i.item_type, i.content_hash,
          exists (select 1 from private.question_keys k where k.question_id = i.item_id) as has_key,
          (select s.domain_code from private.question_keys k
             join private.pack_skills s on s.pack_slug = ${packSlug} and s.skill_code = k.skill_code
             where k.question_id = i.item_id) as domain_code,
          private.item_state(i.item_id) as state,
          exists (
            select 1 from private.item_reviews v join auth.users u on u.id = v.reviewer_id
            where v.item_id = i.item_id and v.content_hash = i.content_hash and v.verdict = 'flag'
              and right(lower(u.email), ${demoSuffix.length}) <> ${demoSuffix}
              and v.created_at > coalesce(
                (select max(r.created_at) from private.flag_resolutions r
                 where r.item_id = i.item_id and r.content_hash = i.content_hash and r.action = 'dismiss'),
                '-infinity'::timestamptz)
          ) as real_flag,
          exists (
            select 1 from private.item_reviews v
            where v.item_id = i.item_id and v.reviewer_id = ${youId ?? "00000000-0000-0000-0000-000000000000"}::uuid
          ) as you_reviewed
        from private.items i
        where i.item_id = ${q.questionId} and i.pack_slug = ${packSlug}`;
      if (!row || row.item_type !== "question" || !row.has_key)
        throw new Error(
          `seedDemoWorld: storm question ${q.questionId} is not a synced question of ${packSlug}: run pnpm db:sync-keys`,
        );
      if (row.content_hash !== q.contentHash)
        throw new Error(
          `seedDemoWorld: the storm registry is stale for ${q.questionId}: run pnpm db:sync-keys`,
        );
      if (row.domain_code !== q.domainCode)
        throw new Error(
          `seedDemoWorld: ${q.questionId} is not in domain ${q.domainCode} of ${packSlug}`,
        );
      if (storm.kind === "boss" && storm.domainCode !== q.domainCode)
        throw new Error(
          `seedDemoWorld: ${q.questionId} is outside the Boss Storm's domain ${storm.domainCode}`,
        );
      if (row.state === "rejected" || row.real_flag)
        throw new Error(
          `seedDemoWorld: ${q.questionId} is ${row.state === "rejected" ? "rejected" : "flagged"}, so it is not a playable storm question (re-run plans around it)`,
        );
      if (isYours && row.you_reviewed)
        throw new Error(
          `seedDemoWorld: ${q.questionId} is spoiled for you (you reviewed it): re-run plans around it`,
        );
    }
  }
  if (world.expedition) {
    const [domain] = await db<{ n: number }[]>`
      select count(*)::int as n from private.pack_skills
      where pack_slug = ${packSlug} and domain_code = ${world.expedition.domainCode}`;
    if (!domain || domain.n === 0)
      throw new Error(
        `seedDemoWorld: expedition domain ${world.expedition.domainCode} is not a domain of ${packSlug}`,
      );
  }
}

/** MF-0052 SC-8: a storm of yours still running (or expired, never finished) blocks a seeded one: refuse. */
async function assertNoUnfinishedStorm(db: Sql, you: string): Promise<void> {
  const [running] = await db<{ id: string }[]>`
    select s.id from public.storms s join auth.users u on u.id = s.user_id
    where lower(u.email) = ${you} and s.finished_at is null limit 1`;
  if (running)
    throw new Error(
      `seedDemoWorld: you have an unfinished storm ${running.id}: finish it on /storms/${running.id}, then re-run`,
    );
}

/**
 * MF-0068: what only the plan can get wrong about the path scenarios, checked before anything is read or
 * deleted: every row belongs to a planned path persona on the demo domain, none is yours, and no path
 * persona is also a pack-world learner.
 */
function assertPathPlanShape(
  paths: PathScenarioPlan,
  {
    suffix,
    you,
    worldEmails,
  }: { suffix: string; you: string; worldEmails: ReadonlySet<string> },
): void {
  const planned = new Set(paths.learners.map((l) => l.email.toLowerCase()));
  const rows = [
    ...paths.learners.map((l) => l.email),
    ...paths.enrollments.map((e) => e.email),
    ...paths.attempts.map((t) => t.email),
    ...paths.completions.map((c) => c.email),
    ...paths.groups.flatMap((g) => [
      g.createdByEmail,
      ...g.members.map((m) => m.email),
    ]),
  ].map((e) => e.toLowerCase());
  for (const email of rows) {
    if (email === you)
      throw new Error(
        "seedDemoWorld: the path scenarios must not write to your account",
      );
    if (!email.endsWith(suffix) || !planned.has(email))
      throw new Error(
        `seedDemoWorld: ${email} is not a planned path persona on the demo domain`,
      );
    if (worldEmails.has(email))
      throw new Error(
        `seedDemoWorld: ${email} is both a path persona and a pack-world learner`,
      );
  }
  for (const g of paths.groups)
    if (!g.members.some((m) => m.email === g.createdByEmail))
      throw new Error(`seedDemoWorld: ${g.name}'s creator is not a member`);
}

/**
 * MF-0068: the DB facts the path scenarios rely on, as the registry holds them now: the path's courses in
 * the plan's order (`private.path_courses`, written by db:sync-keys), every course pack registered, each
 * group on a course of the path, and every planned answer a synced question of its pack and skill that is
 * not rejected. Runs before any delete, and again inside the write transaction.
 */
async function assertPathsSeedable(
  db: Sql | TransactionSql,
  paths: PathScenarioPlan,
): Promise<void> {
  const { slug, courses } = paths.path;
  const registry = await db<{ pack_slug: string }[]>`
    select pack_slug from private.path_courses where path_slug = ${slug} order by position`;
  if (registry.map((r) => r.pack_slug).join(",") !== courses.join(","))
    throw new Error(
      `seedDemoWorld: path "${slug}" in the registry differs from paths/${slug}.yaml: run pnpm db:sync-keys`,
    );
  const registered = await db<{ slug: string }[]>`
    select slug from private.packs where slug = any(${[...courses]}::text[])`;
  if (registered.length !== new Set(courses).size)
    throw new Error(
      `seedDemoWorld: a course of path "${slug}" is not registered: run pnpm db:sync-keys`,
    );
  for (const g of paths.groups)
    if (g.pathSlug !== slug || !courses.includes(g.packSlug))
      throw new Error(
        `seedDemoWorld: ${g.name} is not on a course of path "${slug}"`,
      );
  const ids = [...new Set(paths.attempts.map((t) => t.questionId))];
  const keys = await db<
    {
      question_id: string;
      pack_slug: string;
      skill_code: string;
      state: string;
    }[]
  >`
    select k.question_id, k.pack_slug, k.skill_code, private.item_state(k.question_id) as state
    from private.question_keys k where k.question_id = any(${ids}::text[])`;
  const byId = new Map(keys.map((k) => [k.question_id, k]));
  for (const t of paths.attempts) {
    const key = byId.get(t.questionId);
    if (!key || key.pack_slug !== t.packSlug || key.skill_code !== t.skillCode)
      throw new Error(
        `seedDemoWorld: ${t.questionId} is not a synced question of ${t.packSlug}: run pnpm db:sync-keys`,
      );
    if (key.state === "rejected")
      throw new Error(
        `seedDemoWorld: ${t.questionId} was rejected; re-run plans around it`,
      );
  }
}

/** MF-0068: the path personas' rows, inside the seed's transaction (the users exist already). */
async function writePathScenarios(
  tx: TransactionSql,
  paths: PathScenarioPlan,
  userId: (email: string) => string,
): Promise<void> {
  for (const e of paths.enrollments)
    await tx`
      insert into public.path_enrollments (user_id, path_slug, started_at)
      values (${userId(e.email)}, ${e.pathSlug}, ${e.startedAt.toISOString()})`;
  const rows = paths.attempts.map((t) => ({
    user_id: userId(t.email),
    pack_slug: t.packSlug,
    skill_code: t.skillCode,
    question_id: t.questionId,
    chosen: t.chosen,
    correct: t.correct,
    answered_at: t.answeredAt.toISOString(),
  }));
  if (rows.length > 0)
    await tx`
      insert into public.attempts
        (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
      select user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at
      from jsonb_to_recordset(${tx.json(rows)}) as r(
        user_id uuid, pack_slug text, skill_code text, question_id text,
        chosen text[], correct boolean, answered_at timestamptz)`;
  for (const c of paths.completions)
    await tx`
      insert into public.course_completions (user_id, pack_slug, completed_at, pack_version)
      values (${userId(c.email)}, ${c.packSlug}, ${c.completedAt.toISOString()}, ${c.packVersion})`;
  for (const g of paths.groups) {
    const creatorId = userId(g.createdByEmail);
    const [group] = await tx<{ id: string }[]>`
      insert into public.groups (name, pack_slug, path_slug, invite_code, created_by)
      values (${g.name}, ${g.packSlug}, ${g.pathSlug}, replace(gen_random_uuid()::text, '-', ''), ${creatorId})
      returning id`;
    if (!group)
      throw new Error("seedDemoWorld: path group insert returned nothing");
    for (const m of g.members) {
      const id = userId(m.email);
      await tx`
        insert into public.group_members (group_id, user_id, role, joined_at)
        values (${group.id}, ${id}, ${id === creatorId ? "admin" : "member"}, ${m.joinedAt.toISOString()})`;
    }
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
 * attempts, reviews, memberships, storms and their group with its expedition — and (b) the attempt and
 * storm ids the previous run recorded for you, only if they are yours (same account: ids restart after
 * a reset). MF-0052: every input check runs for all worlds before (a), and again inside the transaction
 * that also holds (b), so a late failure restores your rows. Storms are inserted unfinished and graded
 * by `private.finalize_storm`; you having an unfinished storm of your own is refused up front.
 * Returns your seeded attempt and storm ids for the next run.
 *
 * MF-0068: `paths` adds the path personas (demo domain, so (a) removes them and every path row they hold),
 * their enrollments, answers, completions and path groups, in the same transaction. Its checks join the
 * others before (a) and inside the transaction; no path row is ever written for you.
 */
export async function seedDemoWorlds({
  sql,
  admin,
  worlds,
  demoDomain,
  youEmail,
  previous,
  paths = null,
}: {
  sql: Sql;
  admin: SupabaseClient;
  worlds: readonly DemoWorld[];
  demoDomain: string;
  youEmail: string;
  previous: SeedManifest | null;
  /** MF-0068: the path personas and path groups; absent = none (the MF-0029..MF-0054 callers). */
  paths?: PathScenarioPlan | null;
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
  // MF-0068: the path plan's shape, before anything is read or deleted.
  if (paths)
    assertPathPlanShape(paths, {
      suffix,
      you,
      worldEmails: new Set(learners.map((l) => l.email.toLowerCase())),
    });
  // MF-0052 (c) failure order: every check, for ALL worlds, before the first delete.
  const now = new Date();
  const [youRow] = await sql<{ id: string }[]>`
    select id from auth.users where lower(email) = ${you}`;
  const guard = (youId: string | null): StormGuardContext => ({
    youId,
    youEmail: you,
    demoSuffix: suffix,
    now,
  });
  for (const world of worlds) {
    await assertWorldSeedable(sql, world);
    await assertStormsSeedable(sql, world, guard(youRow?.id ?? null));
  }
  if (paths) await assertPathsSeedable(sql, paths);
  await assertNoUnfinishedStorm(sql, you);

  // (a) the previous demo world (the admin API cascades their storms, groups and expeditions)
  const old = await sql<{ id: string }[]>`
    select id from auth.users
    where right(lower(email), ${suffix.length}) = ${suffix}`;
  for (const { id } of old) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error)
      throw new Error(`seedDemoWorld: delete demo user: ${error.message}`);
  }

  // (b) you: reuse your account, or recreate it after a `pnpm db:reset`
  const youId = youRow?.id ?? (await createConfirmedUser(admin, you));

  // (c) the demo learners
  const idOf = new Map<string, string>([[you, youId]]);
  for (const learner of learners) {
    if (learner.persona === "you") continue;
    const email = learner.email.toLowerCase();
    const id = await createConfirmedUser(admin, email);
    idOf.set(email, id);
    await sql`update public.profiles set display_name = ${learner.displayName} where id = ${id}`;
  }
  // MF-0068: the path personas (demo domain, so the next run's delete removes them with their rows)
  for (const learner of paths?.learners ?? []) {
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

  // (d) everything else, all or nothing: an in-transaction failure also restores your previous rows
  const written = await sql.begin(async (tx) => {
    // your rows from the previous run, and only yours: same account (ids restart after a reset)
    if (previous && previous.youId === youId) {
      if (previous.youAttemptIds.length > 0)
        await tx`
          delete from public.attempts
          where id = any(${previous.youAttemptIds}::bigint[]) and user_id = ${youId}`;
      const stormIds = previous.youStormIds ?? [];
      if (stormIds.length > 0) {
        // attempts.storm_id is `on delete set null`: delete a storm's answers first, or they stay as practice
        await tx`
          delete from public.attempts
          where storm_id = any(${stormIds}::uuid[]) and user_id = ${youId}`;
        await tx`
          delete from public.storms
          where id = any(${stormIds}::uuid[]) and user_id = ${youId}`;
      }
    }

    const mine: number[] = [];
    const myStorms: string[] = [];
    const myJoins: { groupId: string; joinedAt: Date }[] = [];
    for (const world of worlds) {
      const { packSlug } = world.group;
      await assertWorldSeedable(tx, world);
      await assertStormsSeedable(tx, world, guard(youId));

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
        // MF-0052 SC-1: backdated joins, so the expedition counts the seeded answers and your
        // primary pack does not depend on a joined_at tie
        const join = world.joins.find(
          (j) => j.email.toLowerCase() === learner.email.toLowerCase(),
        );
        if (!join)
          throw new Error(
            `seedDemoWorld: no planned join for ${learner.email} in ${packSlug}`,
          );
        await tx`
          insert into public.group_members (group_id, user_id, role, joined_at)
          values (${group.id}, ${id}, ${role}, ${join.joinedAt.toISOString()})`;
        if (id === youId)
          myJoins.push({ groupId: group.id, joinedAt: join.joinedAt });
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

      // MF-0052 SC-3: one storm at a time (storms_one_running_idx), graded by the DB's own finalize_storm
      const storms = [...world.storms].sort(
        (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
      );
      for (const storm of storms) {
        const ownerId = userId(storm.email);
        const [row] = await tx<{ id: string }[]>`
          insert into public.storms (user_id, pack_slug, kind, domain_code, started_at, ends_at)
          values (${ownerId}, ${packSlug}, ${storm.kind}, ${storm.domainCode},
                  ${storm.startedAt.toISOString()}, ${storm.endsAt.toISOString()})
          returning id`;
        if (!row)
          throw new Error("seedDemoWorld: storm insert returned nothing");
        const questions = storm.questions.map((q, i) => ({
          position: i + 1,
          question_id: q.questionId,
          skill_code: q.skillCode,
          domain_code: q.domainCode,
          content_hash: q.contentHash,
          chosen: q.chosen,
          chosen_at: q.chosenAt?.toISOString() ?? null,
        }));
        await tx`
          insert into public.storm_questions
            (storm_id, user_id, position, question_id, skill_code, domain_code, content_hash,
             unreviewed, chosen, chosen_at)
          select ${row.id}, ${ownerId}, r.position, r.question_id, r.skill_code, r.domain_code,
                 r.content_hash, private.item_state(r.question_id) = 'unreviewed', r.chosen, r.chosen_at
          from jsonb_to_recordset(${tx.json(questions)}) as r(
            position smallint, question_id text, skill_code text, domain_code text,
            content_hash text, chosen text[], chosen_at timestamptz)`;
        // start_storm's playable predicate, now that this run's reviews exist
        const [unplayable] = await tx<{ question_id: string }[]>`
          select sq.question_id from public.storm_questions sq
          left join private.items i on i.item_id = sq.question_id
          left join private.question_keys k on k.question_id = i.item_id
          left join private.pack_skills s on s.pack_slug = ${packSlug} and s.skill_code = k.skill_code
          where sq.storm_id = ${row.id}
            and (i.item_id is null or i.item_type <> 'question' or i.pack_slug <> ${packSlug}
              or k.question_id is null or s.skill_code is null
              or (${storm.kind} = 'boss' and s.domain_code <> ${storm.domainCode})
              or i.content_hash <> sq.content_hash
              or private.item_state(i.item_id) in ('flagged', 'rejected')
              or exists (select 1 from private.item_reviews r
                         where r.item_id = i.item_id and r.reviewer_id = ${ownerId}))
          limit 1`;
        if (unplayable)
          throw new Error(
            `seedDemoWorld: ${unplayable.question_id} is not playable in ${storm.email}'s storm`,
          );
        await tx`select private.finalize_storm(${row.id}::uuid)`;
        const [graded] = await tx<{ finished: boolean; voided: number }[]>`
          select s.finished_at is not null as finished,
            (select count(*)::int from public.storm_questions q
             where q.storm_id = s.id and q.voided) as voided
          from public.storms s where s.id = ${row.id}`;
        if (!graded?.finished || graded.voided > 0)
          throw new Error(
            `seedDemoWorld: storm ${row.id} did not finish cleanly (voided ${graded?.voided ?? "?"})`,
          );
        if (ownerId === youId) myStorms.push(row.id);
      }

      if (world.expedition) {
        const e = world.expedition;
        await tx`
          insert into public.expeditions (group_id, domain_code, target, starts_at, ends_at, created_by)
          values (${group.id}, ${e.domainCode}, ${e.target}, ${e.startsAt.toISOString()}::timestamptz,
                  null,
                  ${userId(e.createdByEmail)})`;
      }

      mine.push(
        ...inserted.filter((r) => r.user_id === youId).map((r) => Number(r.id)),
      );
    }

    if (paths) {
      await assertPathsSeedable(tx, paths);
      await writePathScenarios(tx, paths, userId);
    }

    // MF-0054 SC-8: pin your demo groups oldest join first, so your newest join (ccdv-f, MF-0052 SC-1)
    // is your newest pin and drives the primary pack. Same DB path as the action: the membership
    // check and the cap of 3 apply (your own pins may be replaced). The 2 ms gap keeps pins distinct
    // at the millisecond precision JS reads pinned_at with.
    myJoins.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    for (const { groupId } of myJoins) {
      await tx`select pg_sleep(0.002)`;
      await tx`select * from private.pin_group_for(${youId}::uuid, ${groupId}::uuid)`;
    }

    const seeded = [...idOf.values()];
    const [left] = await tx<{ n: number }[]>`
      select count(*)::int as n from public.storms
      where user_id = any(${seeded}::uuid[]) and finished_at is null`;
    if ((left?.n ?? 0) > 0)
      throw new Error("seedDemoWorld: a seeded storm was left unfinished");
    return { mine, myStorms };
  });

  return {
    youId,
    youAttemptIds: written.mine,
    youStormIds: written.myStorms,
  };
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

/**
 * MF-0052: items the planner keeps storms and demo reviews off, and the guard refuses: resolved items
 * (MF-0029), items with a flag by a real (non-demo) reviewer, and items you reviewed (spoiled for your
 * storms; none after a `db:reset`). One rule shared by the planner and the pre-delete check.
 */
export async function listSeedExcludedItems(
  sql: Sql,
  { demoDomain, youEmail }: { demoDomain: string; youEmail: string },
): Promise<string[]> {
  const suffix = `@${assertDemoDomain(demoDomain)}`;
  const you = youEmail.trim().toLowerCase();
  const rows = await sql<{ item_id: string }[]>`
    select item_id from private.flag_resolutions
    union
    select v.item_id from private.item_reviews v join auth.users u on u.id = v.reviewer_id
    where v.verdict = 'flag' and right(lower(u.email), ${suffix.length}) <> ${suffix}
    union
    select v.item_id from private.item_reviews v join auth.users u on u.id = v.reviewer_id
    where lower(u.email) = ${you}
    order by item_id`;
  return rows.map((r) => r.item_id);
}

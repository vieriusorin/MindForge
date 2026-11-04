/**
 * MF-0029 review findings (REVIEW.md, blocking 1 and 2), against the LOCAL stack. Each was shown RED
 * on the code before its fix.
 */
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";
import { loadSeedInputs } from "../load-seed-inputs";
import { planDemoWorld } from "../plan-demo-world";
import { seedDemoWorld } from "../seed-demo-world";
import type { DemoWorld } from "../types";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0029r-${RUN}.test`;
const db = sql();
const admin = adminClient();
let YOU: TestUser;
let world: DemoWorld;

beforeAll(async () => {
  YOU = await createTestUser(`you-r-${RUN}@mf0029.test`);
  const inputs = await loadSeedInputs(join(process.cwd(), "packs/ccdv-f"));
  world = planDemoWorld({
    now: new Date(),
    seed: 42,
    packSlug: "ccdv-f",
    youEmail: YOU.email,
    demoDomain: DEMO,
    questions: inputs.questions,
    items: inputs.items,
  });
});

afterAll(async () => {
  const demo = await db<{ id: string }[]>`
    select id from auth.users where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`}`;
  for (const { id } of demo) await admin.auth.admin.deleteUser(id);
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  await db`delete from private.flag_resolutions where comment = ${`mf0029r ${RUN}`}`;
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("MF-0029 review regressions", () => {
  it("a manifest from another account of yours (e.g. before a db:reset) deletes none of your answers", async () => {
    const { data, error } = await YOU.client.rpc("record_attempt", {
      p_question_id: world.attempts[0]?.questionId,
      p_chosen: world.attempts[0]?.chosen,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("boolean");
    const [manual] = await db<{ id: string }[]>`
      select id::text from public.attempts where user_id = ${YOU.id}`;
    const manualId = Number(manual?.id);

    // The old manifest names the same attempt id under a previous (reset) account of yours.
    await seedDemoWorld({
      sql: db,
      admin,
      world,
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: {
        youId: "00000000-0000-4000-8000-000000000000",
        youAttemptIds: [manualId],
      },
    });
    const [kept] = await db<{ n: number }[]>`
      select count(*)::int as n from public.attempts where id = ${manualId}`;
    expect(kept?.n).toBe(1);
  });

  it("refuses to review an item you have already rejected", async () => {
    const flag = world.reviews.find((r) => r.verdict === "flag");
    expect(flag).toBeDefined();
    await db`
      insert into private.flag_resolutions (item_id, content_hash, action, comment, resolved_by)
      values (${flag?.itemId ?? ""}, ${flag?.contentHash ?? ""}, 'reject', ${`mf0029r ${RUN}`}, ${YOU.id})`;
    await expect(
      seedDemoWorld({
        sql: db,
        admin,
        world,
        demoDomain: DEMO,
        youEmail: YOU.email,
        previous: null,
      }),
    ).rejects.toThrow(/rejected/);
  });
});

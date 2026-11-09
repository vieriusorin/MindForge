// MF-0066 delta review D-5: after a seed run, the diagram the shipped orders come from is approved in the
// database (two demo approvals at its current hash, never the author or you). LOCAL stack only (pnpm test:db);
// run-scoped demo domain and account, removed afterwards.
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
import { withOrderApprovals } from "../plan-order-approvals";
import { planSeed } from "../plan-seed";
import { listSeedExcludedItems, seedDemoWorlds } from "../seed-demo-world";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0066-${RUN}.test`;
const DIAGRAM = "prod-prompting.D2.S2.diagram-loop";

const db = sql();
const admin = adminClient();
let YOU: TestUser;

async function demoUserIds(): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    select id from auth.users where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`}`;
  return rows.map((r) => r.id);
}

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0066.test`);
});

afterAll(async () => {
  for (const id of await demoUserIds()) await admin.auth.admin.deleteUser(id);
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("dev:seed approves the order items' diagrams", () => {
  it("after a seed run the source diagram is approved, by two demo reviewers at its current hash", async () => {
    const inputs = await loadSeedInputs(
      join(process.cwd(), "packs", "prod-prompting"),
    );
    expect(inputs.orderDiagramIds).toContain(DIAGRAM);
    const excludeItemIds = await listSeedExcludedItems(db, {
      demoDomain: DEMO,
      youEmail: YOU.email,
    });
    const { worlds, orderApprovals } = planSeed({
      now: new Date(),
      seed: 42,
      youEmail: YOU.email,
      demoDomain: DEMO,
      excludeItemIds,
      packs: [{ ...inputs, groupName: `Demo ${RUN}` }],
      paths: [],
    });
    await seedDemoWorlds({
      sql: db,
      admin,
      worlds: withOrderApprovals(worlds, orderApprovals.approvals),
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: null,
      paths: null,
    });

    const [state] = await db<{ state: string }[]>`
      select private.item_state(${DIAGRAM}) as state`;
    expect(state?.state).toBe("approved");
    const approvers = await db<{ email: string; current: boolean }[]>`
      select lower(u.email) as email, r.content_hash = i.content_hash as current
      from private.item_reviews r
      join auth.users u on u.id = r.reviewer_id
      join private.items i on i.item_id = r.item_id
      where r.item_id = ${DIAGRAM} and r.verdict = 'approve'
        and right(lower(u.email), ${DEMO.length + 1}) = ${`@${DEMO}`}`;
    expect(approvers).toHaveLength(2);
    expect(approvers.every((a) => a.current)).toBe(true);
    expect(approvers.map((a) => a.email)).not.toContain(YOU.email);
    expect(approvers.map((a) => a.email)).not.toContain(
      "sorin.vieriu@ddroidd.com",
    );
  });
});

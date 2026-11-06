/**
 * MF-0054 acceptance (frozen, SC-8): `dev:seed` pins your demo groups so ccdv-f is the most recent pin,
 * through the database's pin path (the cap of 3 applies to the seed too). LOCAL stack (pnpm test:db),
 * run-scoped emails. Before seeding, YOU already pin two groups of your own (own-1 older, own-2 newer):
 * pinning prod-prompting then ccdv-f must evict own-1 and keep own-2.
 */
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sidebarGroupSection } from "@/server/groups/sidebar-group-section";
import { primaryPackSlug } from "@/server/packs/primary-pack";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";
import { loadSeedInputs } from "../load-seed-inputs";
import { planDemoWorlds } from "../plan-demo-world";
import { seedDemoWorlds } from "../seed-demo-world";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0054-${RUN}.test`;
const PACKS = ["ccdv-f", "prod-prompting"] as const;
const PACKS_DIR = join(process.cwd(), "packs");

let YOU: TestUser;
const OWN: string[] = [];
const db = sql();
const admin = adminClient();

async function demoUserIds(): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    select id from auth.users where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`}`;
  return rows.map((r) => r.id);
}

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0054.test`);
  for (const name of ["own-1", "own-2"]) {
    const { data, error } = await YOU.client.rpc("create_group", {
      p_name: `MF-0054 ${name}`,
      p_pack_slug: "prod-prompting",
    });
    if (error || typeof data !== "string")
      throw new Error(`create_group: ${error?.message}`);
    OWN.push(data);
    const pinned = await YOU.client.rpc("pin_group", { p_group_id: data });
    if (pinned.error) throw new Error(`pin_group: ${pinned.error.message}`);
  }

  const packs = [];
  for (const slug of PACKS) {
    const inputs = await loadSeedInputs(join(PACKS_DIR, slug));
    packs.push({
      pack: inputs.pack,
      groupName: `Demo ${slug}`,
      questions: inputs.questions,
      items: inputs.items,
    });
  }
  const worlds = planDemoWorlds({
    now: new Date(),
    seed: 42,
    youEmail: YOU.email,
    demoDomain: DEMO,
    packs,
  });
  await seedDemoWorlds({
    sql: db,
    admin,
    worlds,
    demoDomain: DEMO,
    youEmail: YOU.email,
    previous: null,
  });
});

afterAll(async () => {
  for (const id of await demoUserIds()) await admin.auth.admin.deleteUser(id);
  for (const id of OWN) await admin.from("groups").delete().eq("id", id);
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("MF-0054 SC-8: the seed pins ccdv-f last", () => {
  it("your pins, newest first: Demo ccdv-f, Demo prod-prompting, own-2 (own-1 evicted by the cap)", async () => {
    const pins = await db<{ name: string }[]>`
      select g.name from private.group_pins p
      join public.groups g on g.id = p.group_id
      where p.user_id = ${YOU.id}
      order by p.pinned_at desc, p.group_id desc`;
    expect(pins.map((p) => p.name)).toEqual([
      "Demo ccdv-f",
      "Demo prod-prompting",
      "MF-0054 own-2",
    ]);
  });

  it("the primary pack and the sidebar section the app computes for you start with ccdv-f", async () => {
    const groups = await db<{ id: string; pack_slug: string; name: string }[]>`
      select g.id, g.pack_slug, g.name from public.group_members m
      join public.groups g on g.id = m.group_id
      where m.user_id = ${YOU.id}
      order by m.joined_at desc`;
    const pins = await db<{ group_id: string; pinned_at: Date }[]>`
      select group_id, pinned_at from private.group_pins where user_id = ${YOU.id}`;
    const input = {
      groups: groups.map((g) => ({
        id: g.id,
        packSlug: g.pack_slug,
        name: g.name,
      })),
      pins: pins.map((p) => ({
        groupId: p.group_id,
        pinnedAt: p.pinned_at.toISOString(),
      })),
    };

    expect(primaryPackSlug(input)).toBe("ccdv-f");
    const section = sidebarGroupSection(input);
    expect(section?.label).toBe("Pinned");
    expect(section?.groups.map((g) => g.name)).toEqual([
      "Demo ccdv-f",
      "Demo prod-prompting",
      "MF-0054 own-2",
    ]);
  });
});

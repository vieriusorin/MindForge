/**
 * MF-0054 acceptance (frozen): the sidebar's group section and the primary pack, from
 * (groups by joined_at desc, the viewer's pins). Rows E1–E7 are the GOAL's edge-input table;
 * expected values are literals from .planning/tasks/MF-0054/GOAL.md, never the code's output.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PACK_SLUG,
  primaryPackSlug,
} from "@/server/packs/primary-pack";
import { sidebarGroupSection } from "../sidebar-group-section";
import type { GroupPin } from "../types";

// joined_at desc, the order listMyGroups returns
const GROUPS = [
  { id: "g-e", packSlug: "pack-e" },
  { id: "g-d", packSlug: "pack-d" },
  { id: "g-c", packSlug: "pack-c" },
  { id: "g-b", packSlug: "pack-b" },
  { id: "g-a", packSlug: "pack-a" },
] as const;

const pin = (groupId: string, pinnedAt: string): GroupPin => ({
  groupId,
  pinnedAt,
});

describe("MF-0054 SC-1: sidebar group section", () => {
  it("E1: no groups → no section", () => {
    expect(sidebarGroupSection({ groups: [], pins: [] })).toBeNull();
  });

  it("E2: groups, no pins → 'Recent' with the 3 newest-joined", () => {
    expect(sidebarGroupSection({ groups: GROUPS, pins: [] })).toEqual({
      label: "Recent",
      groups: [GROUPS[0], GROUPS[1], GROUPS[2]],
    });
    expect(sidebarGroupSection({ groups: [GROUPS[3]], pins: [] })).toEqual({
      label: "Recent",
      groups: [GROUPS[3]],
    });
  });

  it("E3: one pin → 'Pinned' with only that group", () => {
    expect(
      sidebarGroupSection({
        groups: GROUPS,
        pins: [pin("g-a", "2026-11-01T10:00:00.000Z")],
      }),
    ).toEqual({ label: "Pinned", groups: [GROUPS[4]] });
  });

  it("E4: three pins → 'Pinned', newest pin first, regardless of join order", () => {
    expect(
      sidebarGroupSection({
        groups: GROUPS,
        pins: [
          pin("g-e", "2026-11-01T10:00:00.000Z"),
          pin("g-a", "2026-11-03T10:00:00.000Z"),
          pin("g-c", "2026-11-02T10:00:00.000Z"),
        ],
      }),
    ).toEqual({
      label: "Pinned",
      groups: [GROUPS[4], GROUPS[2], GROUPS[0]],
    });
  });

  it("E5: a pinned_at tie is broken by group id, greater first", () => {
    const at = "2026-11-01T10:00:00.000Z";
    expect(
      sidebarGroupSection({
        groups: GROUPS,
        pins: [pin("g-b", at), pin("g-d", at)],
      }),
    ).toEqual({ label: "Pinned", groups: [GROUPS[1], GROUPS[3]] });
  });

  it("E6: a pin for a group not in the list is ignored", () => {
    expect(
      sidebarGroupSection({
        groups: GROUPS,
        pins: [
          pin("g-gone", "2026-11-05T10:00:00.000Z"),
          pin("g-b", "2026-11-01T10:00:00.000Z"),
        ],
      }),
    ).toEqual({ label: "Pinned", groups: [GROUPS[3]] });
    // only stale pins: nothing pinned is visible, so the fallback applies
    expect(
      sidebarGroupSection({
        groups: GROUPS,
        pins: [pin("g-gone", "2026-11-05T10:00:00.000Z")],
      }),
    ).toEqual({
      label: "Recent",
      groups: [GROUPS[0], GROUPS[1], GROUPS[2]],
    });
  });
});

describe("MF-0054 SC-2: primary pack follows the most recent pin", () => {
  it("E1: no groups → the default pack", () => {
    expect(DEFAULT_PACK_SLUG).toBe("ccdv-f");
    expect(primaryPackSlug({ groups: [], pins: [] })).toBe("ccdv-f");
  });

  it("E2: no pins → the newest-joined group's pack", () => {
    expect(primaryPackSlug({ groups: GROUPS, pins: [] })).toBe("pack-e");
  });

  it("E3/E7: with pins → the most recently pinned group's pack, not the newest-joined", () => {
    expect(
      primaryPackSlug({
        groups: GROUPS,
        pins: [pin("g-b", "2026-11-01T10:00:00.000Z")],
      }),
    ).toBe("pack-b");
    expect(
      primaryPackSlug({
        groups: GROUPS,
        pins: [
          pin("g-c", "2026-11-01T10:00:00.000Z"),
          pin("g-a", "2026-11-04T10:00:00.000Z"),
          pin("g-d", "2026-11-02T10:00:00.000Z"),
        ],
      }),
    ).toBe("pack-a");
  });

  it("E5: a tie picks the greater group id, the same group the sidebar shows first", () => {
    const at = "2026-11-01T10:00:00.000Z";
    expect(
      primaryPackSlug({
        groups: GROUPS,
        pins: [pin("g-b", at), pin("g-d", at)],
      }),
    ).toBe("pack-d");
  });

  it("E6: only stale pins → the newest-joined group's pack", () => {
    expect(
      primaryPackSlug({
        groups: GROUPS,
        pins: [pin("g-gone", "2026-11-05T10:00:00.000Z")],
      }),
    ).toBe("pack-e");
  });

  it("parity: the sidebar layout and Today both pass the viewer's pins to the one function", () => {
    for (const page of [
      "src/app/(app)/layout.tsx",
      "src/app/(app)/today/page.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), page), "utf8");
      expect(source, page).toContain('from "@/server/packs/primary-pack"');
      expect(source, page).toMatch(/listMyPins\(/);
      expect(source, page).not.toMatch(/pins:\s*\[\]/);
    }
  });
});

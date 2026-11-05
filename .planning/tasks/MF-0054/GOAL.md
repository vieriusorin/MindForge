---
ticket_id: MF-0054
tier: high-risk                   # new table/column + RLS + a Server Action writing per-user state
stage: intake
builds_on: [MF-0002, MF-0052]
last_iteration: 0
goal_status: reserved             # drafted 2026-11-05 at the user's request; not started
---

> User, 2026-11-05: "open a ticket for real pinning and maybe have something favorites, possibility to add to
> favorite (pin, unpin) i don't know think".

## Objective

**Today.** The sidebar's "Pinned" section is not pinning: `pinnedGroups` = `groups.slice(0, 3)`
(`src/features/app-shell/components/app-sidebar/utils.ts:22-25`) over `listMyGroups`, ordered by `joined_at desc`.
So the "pins" are your 3 newest memberships, and you can't choose, add or remove one. The label promises a choice
the app doesn't offer.

**End state.** A learner pins and unpins their own study groups. The sidebar shows the pinned ones; everything else
stays on `/groups`.

## Recommendation (to confirm at DESIGN)

**One concept, called "pin". No separate "favorites".** Pinning and favoriting would answer the same question
("which groups do I want one click away?"). Two lists would need two rules for what the sidebar shows, and they
would drift. The control is a pin toggle (lucide `Pin` / `PinOff`, with the words "Pin to sidebar" / "Unpin"),
so it reads as "favourite" without a second term. Add **Pinned group** to `CONTEXT.md` when this is built.

Draft shape:
- **Storage:** `group_members.pinned_at timestamptz null`. The pin is per member, so it disappears when you leave
  the group, and no new table is needed. RLS: a member updates only their own row's `pinned_at` (a narrow
  column grant, or a SECURITY DEFINER function in `private`, per the migration rules).
- **Actions:** `pinGroup(groupId)` / `unpinGroup(groupId)` in `src/features/groups/actions.ts`: auth → zod →
  membership check → write → `ActionResult`, called via `useMutation`, then `router.refresh()`.
- **UI:** a toggle on each `/groups` row and on the group page header (shadcn `Button` + `Tooltip`, with an
  `aria-pressed` toggle and an accessible name). The sidebar lists pinned groups ordered by `pinned_at`.
- **Limit:** keep at most 3 pinned (`.claude/rules/ui-design.md`: "Pinned (≤ 3 groups)"). Pinning a 4th replaces
  the oldest pin (user decision 2 below), and the server enforces it.

## Open questions (asked at intake, answered below)

1. **No pins yet:** should the sidebar fall back to the 3 newest groups (today's behaviour, perhaps labelled "Recent"),
   or show an empty "Pinned" hint?
2. **At the limit (3):** refuse the 4th pin, or replace the oldest pin?
3. **Primary pack:** today Today, the sidebar's Play links and Review follow the *newest-joined* group
   (`primaryPackSlug`). Should the first pinned group become the primary pack? That would also give users a way to
   switch which pack the sidebar plays, but it changes MF-0052's seed guarantee: the seed should then pin the ccdv-f
   group.
4. **Name:** "pin" as recommended, or "favourite" (star) if that reads better to users?
5. **Seed:** should `dev:seed` pin groups for you (e.g. ccdv-f + two others) so the feature shows data?

## Decided by the user (2026-11-05)

1. **No pins:** the sidebar shows the 3 newest-joined groups, under the label **"Recent"**. With at least one pin,
   the section is **"Pinned"** and shows only pins.
2. **At the limit:** pinning a 4th group **replaces the oldest pin** (smallest `pinned_at`), in the same write, on the
   server. The UI says which group was unpinned.
3. **Primary pack follows pins:** with pins, Today / Play / Review follow the pinned groups' pack; with none, the
   newest-joined group as today (`primaryPackSlug`). Which pin counts is still to be confirmed (see below).
4. **Name:** "pin". Add **Pinned group** to `CONTEXT.md`.
5. **Seed:** `dev:seed` pins groups for you, with ccdv-f as the one that drives the primary pack, so MF-0052's
   guarantee (ccdv-f primary, Storm visible) still holds.

## Still open

- **Which pin drives the primary pack?** Recommended: the **most recently pinned** group, so pinning a group switches
  Today and Play to its pack. The alternative is the oldest pin, which stays stable. To confirm at DESIGN.

## Out of Scope

- Pinning anything other than study groups (packs, skills, storms).
- Reordering pins by drag.

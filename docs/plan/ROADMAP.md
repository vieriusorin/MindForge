# MindForge roadmap to the CCDV-F exam (2026-12-07)

> **Status:** Draft for the team · **Owner:** Sorin Vieriu · **Written:** 2026-11-03 (W1, day 2)
> Source of scope: `docs/MINDFORGE.md`. This file says **what is done, what is next, who can take it,
> and in what order**. Each ticket below becomes `.planning/tasks/MF-####/GOAL.md` when someone claims it.

---

## 1. Where we are

### Done (uncommitted on `feat/MF-0001`, verified with receipts in `.planning/evidence/`)

| Ticket | What exists | Covers slice |
|---|---|---|
| MF-0001 | Pack format + zod loader, `packs/ccdv-f` (8 domains, 25 skills, exam-guide weights), second sample pack loads with zero code changes, tree-stage mapping | B2, **B9 (G6 proven)** |
| MF-0002 | Supabase magic-link sign-in, groups, invite links, RLS on `profiles` / `groups` / `group_members` | B1 (auth), B8 (groups + invite) |
| MF-0003 | 53 hand-written questions (all `unreviewed`), DB-side grading (key never sent to the browser), FSRS replay → forest, session selector, Scenario Duel | B6, B7 (Duel only) |
| UI session | App shell (inset sidebar, mode toggle), dashboard (briefing, blueprint chart, growth donut, focus list), shadcn design system, `ui-design.md` | — |

### Not started

- **Hosting** (Vercel + hosted Supabase), production email, **CI**.
- **AI content pipeline** (B3 docs corpus, B4 writers + verifier). No prompts, no Claude API code.
- **Review workflow** (B5 Pollination). Nothing is approved yet, so G3/G4 are at 0.
- **Nature cards + diagrams** (no schema, no content, no diagram rendering).
- **Daily Walk, Seed Planting** (B7 rest), **shared group forest + heatmap** (B8 rest).
- Everything W3–W4: storms, readiness, Cuckoo, Diagram Builder, Feynman, Odd One Out, Expedition.

### Known debt (deferred from reviews)

- MF-0002: proxy redirect drops no-store headers; magic-link origin comes from request headers; `rotateInviteCode` swallows errors; `create_group` accepts unknown pack slugs and has no cap; `site_url` is port 3000 (dev runs on 3001).
- MF-0003: duel double-submit, a11y (live region, focus after check/next), raw `fieldset` instead of shadcn `FieldSet`, back link, stale-key vs cached file feedback, sync script doesn't run the validator.
- Retro: no gate that every new public table revokes `anon`/`authenticated` grants (TRUNCATE bypasses RLS).

### The honest gap

Features are on track; **content is not.** G3 needs 25 skills × ≥ 15 approved questions = **375 approved
questions (750 human approvals)**, plus 25 nature cards and 25 diagrams. We have 53 unreviewed
questions and 0 cards. So the plan below puts the content pipeline and review flow on the critical
path, and cuts game modes that don't directly help us pass.

---

## 2. Decisions needed from the owner (before Nov 5)

| # | Question | Recommendation |
|---|---|---|
| D-1 | **Where does content live?** | ✅ **Decided 2026-11-03** (ADR 0001, `CONTEXT.md`). Files are the source of truth; DB holds `item_reviews` by item id + content hash. **Origin** (`official \| human \| ai`) lives in the file; **review state** (`unreviewed \| approved \| flagged \| rejected`) is derived in the DB. Official items start approved. Practice modes serve approved + unreviewed (badged); storms prefer approved; flagged/rejected never served; attempts on rejected questions drop out of the forest replay. |
| D-2 | Q-2: Claude API | ✅ **Decided 2026-11-03.** No runtime AI in the app in v1. Generation is a local script run by the content-pipeline owner; one key in a company Console workspace `mindforge`, kept in `.env.local`; hard cap **$100/month** + a script-side token guard; model and prompt version recorded on every item. |
| D-3 | Q-6: team | ✅ **Decided 2026-11-03.** 5–6 coders, ~30 learners who all review (§6). |
| D-4 | Q-4: group visibility | ✅ **Decided 2026-11-03.** Study groups of ~5–6 per pack (optional big "Cohort" group). Members see an aggregated per-region heatmap (only when ≥ 3 members have attempts) and an avatar list; no individual forests or scores. Opt-in sharing after Dec 7. Expedition progress is a group total only. |
| D-5 | Q-7: second pack | ✅ **Decided 2026-11-03.** G6 is met by `packs/team-onboarding-sample` (MF-0001); a real second pack is chosen at the post-Dec 7 retro. |
| D-6 | Q-8: analogy library owner | ✅ **Decided 2026-11-03.** Coder F seat is the **analogy owner**: their approval is required on every card on top of the 2 reviews; after 48 h any content maintainer may give it. |
| D-7 | Cut list (§5) | ✅ **Decided 2026-11-03.** Accepted; in W4, MF-0016 Spot the Cuckoo goes before MF-0017 Expedition. |

**Further decisions from the grill (2026-11-03)**, all recorded in `CONTEXT.md` and the GOAL files:
review rules (who reviews, no self-approval, flags need a comment, maintainers resolve and reject,
reviewing spoils a question); nature cards attach to skills, no Concept level in v1; Tree needs a
storm-proven skill instead of Feynman; readiness shows memory forecast + last storm score as weather,
never a scaled score; storm rules (split, 12-question Boss Storm, server deadline); Daily Walk of up
to 10 with at most one new skill; hosting on Vercel + hosted Supabase (Frankfurt) + Resend.

Also fold the already-answered questions into `docs/MINDFORGE.md` §2.10 (Q-1 Supabase, Q-2 company pays,
Q-3 Vercel, Q-5 English, Q-9 minimal geometric) and change `MF-###` to `MF-####` in §3.2.

---

## 3. Phase 0 — unblock the team (Nov 3–4, owner only)

Nobody else can start until the work is on `main`.

1. Commit in order: **UI session → MF-0001 → MF-0002 → MF-0003 → MF-0018** (shared files: see the "Notes for the committer" in each evidence file). Open the PR to `main`, merge.
2. ~~Answer D-1…D-7~~ (done 2026-11-03); fold the answers into `MINDFORGE.md` §2.10.
3. Create the tickets in §4 as issues (or just claim them in this file), each with its owner.
4. Onboarding for colleagues: `README.md` already covers local setup (`pnpm install`, `supabase start`, `pnpm db:reset`, `pnpm dev` on **port 3001**). Every ticket runs through `/gsd-goal-loop MF-####`.

---

## 4. Tickets

Every ticket has a drafted `.planning/tasks/MF-####/GOAL.md` (`stage: design`, `goal_status: reserved`)
with objective, constraints, decisions and proposed Success Criteria. To claim one: put your name in
§6, set `goal_status: in-progress`, run `/gsd-goal-loop MF-####` (it resumes at DESIGN), confirm the
SCs, freeze the acceptance tests, then build.

**Tracks** keep people out of each other's files. One person per track at a time.

| Track | Owns |
|---|---|
| **P** Platform | `supabase/config.toml`, `.github/`, `src/proxy.ts`, `src/server/{supabase,auth,http}/`, Vercel config |
| **E** Engine + formats | `src/engine/**`, pack/question/card schemas |
| **C** Content pipeline | `scripts/generate/**`, `prompts/**`, `evals/**`, drafts in `packs/*/` |
| **G** Gameplay UI | `src/features/<mode>/**`, `src/app/(app)/play/**`, `src/app/(app)/today/**` |
| **S** Social + review | `src/features/{groups,review}/**`, `src/server/{groups,reviews}/**` |
| **H** Humans (no code) | Reviewing questions/cards, analogy library |

**Independence rules** (so nobody waits for anybody after MF-0006):

1. **MF-0006 is the only blocker.** The owner lands it on Nov 4. It freezes the item formats and adds the
   **review seam** `getReviewContext(userId, pack)`, which returns "everything unreviewed" until MF-0007
   fills it in. Every mode reads review state only through it.
2. **Migrations run in parallel.** A migration only creates or alters its own ticket's tables. Before
   merging: rebase on `main`, **regenerate** `database.types.ts` (`pnpm db:types`, never hand-merge it),
   run `pnpm db:reset && pnpm test:db`. If your migration's timestamp is older than one already on `main`,
   rename it to a newer timestamp. Each new table repeats `revoke all … from anon, authenticated`.
3. **Inputs, not imports.** When one ticket's output feeds another (storm results → readiness, seed step →
   walk), the receiver defines the input type and runs on an empty default. **Whoever merges second wires
   the two** (a few lines), in their own PR.
4. **Integration checks, not dependencies:** the release gate (Nov 15) needs MF-0004 + MF-0010 on `main`;
   that's a date to hit, not something anyone waits on to start.

Size: **S** ≤ 1 day · **M** 2–3 days · **L** 4–5 days. Tier per `ticket-traceability` (high-risk = schema, RLS, auth, infra).

### W1–W2: playable MVP (release gate **Nov 15**)

| ID | Track | Title | Tier | Size | Depends on | Done when |
|---|---|---|---|---|---|---|
| **MF-0004** | P | Hosted env + auth hardening | high | M | Phase 0, D-2 | App on Vercel against hosted Supabase; magic link arrives via production SMTP; redirect origin comes from config (exact allowlist, no header trust); proxy keeps no-store headers; `create_group` rejects unknown slugs and caps groups per user; `rotateInviteCode` surfaces errors; `site_url` fixed |
| **MF-0005** | P | CI + grants gate | normal | S | Phase 0, MF-0018 | GitHub Action runs typecheck, lint, unit, db tests (local Supabase in CI), build; a DB test fails if any `public` table grants TRUNCATE/INSERT/DELETE to `anon`/`authenticated` outside an allow-list |
| **MF-0018** | P | Local contributor setup (**done, uncommitted**, other session) | normal | S | Phase 0 | Supabase CLI pinned as a devDependency; one setup command (Node ≥ 24 + Docker check, `supabase start`, migrations without wiping data, key sync, `.env.local`); README Quick start. MF-0005 uses its pinned CLI |
| **MF-0006** | E | Content formats v1: nature card + diagram | normal | S | Phase 0 (**only blocker**, lands Nov 4) | Zod schemas for nature card (simply / in nature / **where it breaks required** / contrast / sources) and diagram (Mermaid at the time; since 2026-11-04 a graph of nodes + edges, ADR 0003); loader + schema check; the Temperature card from §2.4 validates as the fixture. **This is the contract for MF-0008 and MF-0010; freeze it first.** |
| **MF-0007** | S | Pollination: review workflow (D-1) | high | M | MF-0006 | `item_reviews` table + RLS; approve / flag / reject on questions (cards once MF-0006 lands); 2 approvals → approved, any open flag → flagged; edit resets approvals via content hash; each reviewer counts once per item; flag queue page for admins |
| **MF-0008** | C | Docs corpus + QuestionWriter + Verifier | normal | L | MF-0006, D-2 | Official doc pages per skill fetched + cached (`sources` in pack); Batch API writes ≥ 15 draft questions per skill; Verifier (Opus) checks key, rationale per option, citation; output passes the existing question schema and lands as a PR; golden set (3 official samples + ~30 hand-written) catches planted wrong keys; prompts in `prompts/` with version header |
| **MF-0009** | G | Daily Walk | normal | M | Phase 0 | `/today` starts a 10–15 min session from the existing selector (`src/engine/memory/select.ts`): due/wilting trees first, weight × weakness × due; reuses Duel grading; forest updates after the session |
| **MF-0010** | G | Seed Planting + card/diagram rendering | normal | M | MF-0006 | Unstudied skill → nature card → diagram (graph drawn with React Flow, ADR 0003; lazy-loaded, readable in dark mode) → 3 quick checks → sprout; works with the hand-written cards that exist (≥ 3 skills for the gate) |
| **MF-0011** | S | Shared group forest + heatmap (D-4) | high | M | MF-0006 | Group page shows an aggregated heatmap per region from members' attempts via a SECURITY DEFINER read; no individual forest visible; RLS test proves a non-member gets nothing |
| **MF-0012** | G | Duel hardening (review debt) | normal | S | Phase 0 | Double-submit guard, a11y (live region, focus), shadcn `FieldSet`, back link to the source group, sync script runs the validator. **Good first ticket for a new colleague.** |
| **H-1** | H | Review the 53 existing questions | — | ongoing | MF-0007 (or via PR before it) | All 53 have 2 approvals or a flag |
| **H-2** | H | Write 25 nature cards (draft) | — | ongoing | MF-0006 | One card per skill with "where it breaks"; D-6 owner approves the analogy |

**Release gate (Nov 15)**, unchanged from §4 of the doc: a colleague who has never seen the app joins
from an invite link on the hosted URL, plants 3 seeds, wins a Scenario Duel, and sees their trees grow.
Needs MF-0004 + MF-0010 + (existing) Duel.

### W3: exam practice (Nov 16–22)

| ID | Track | Title | Tier | Size | Depends on | Done when |
|---|---|---|---|---|---|---|
| **MF-0013** | E + G | Full Storm + Boss Storm | high | L | MF-0006 | 53 questions / 120 min, blueprint-weighted, per-domain report; Boss Storm = one domain; `storms` table + RLS. If the approved pool is too small for a domain, fill from `unreviewed` and label those questions on the report |
| **MF-0014** | C | Card + Diagram writers | normal | M | MF-0008 | NatureCardWriter + DiagramWriter fill the skills without a human card; Verifier checks "where it breaks" and the diagram graph schema (ADR 0003); lands as PR |
| **MF-0015** | E + G | Readiness weather | normal | M | MF-0006 | Per-region memory forecast + last storm score as weather (no scaled score), shown on the dashboard; formula unit-tested with fixed clock; numbers come from the engine only |
| **H-3** | H | Review sprint | — | W3 | MF-0008, MF-0007 | ≥ 15 approved questions per skill (G3) |

### W4: stretch (Nov 23–29) — only if W3 is green

| ID | Track | Title | Size | Done when |
|---|---|---|---|---|
| MF-0016 | G | Spot the Cuckoo | M | Question variant: find the flawed line in a snippet; reuses Duel grading; content from a CuckooWriter prompt or hand-written |
| MF-0017 | S | Group Expedition | M | Weekly co-op goal ("bring Security to green") counted from correct recalls; progress on the group page |

### W5: freeze (Nov 30–Dec 6)

No features. Bug fixes, flag triage, content fixes only. Everyone plays.

---

## 5. Cut to after Dec 7 (D-7)

Diagram Builder, Feynman Campfire (runtime AI grading, cost), Odd One Out, notes import (NotesMapper),
weekly docs re-fetch automation, reviewing-waters-the-tree reward. Reason: each is ≥ M size and none
moves G1 (pass) or G3 (content coverage) as much as storms and approved questions do.

---

## 6. Critical path and parallel lanes

```
Nov 3–4   Phase 0 (owner): merge to main ─► MF-0006 formats + review seam (owner)
                                                   │
Nov 5 →   all in parallel, no waiting:             ▼
          A: MF-0004 hosted env, MF-0005 CI      (independent of everything)
          B: MF-0008 question writer ─► MF-0014  (same person, in sequence)
          C: MF-0012 duel fixes, MF-0009 walk, MF-0016 cuckoo
          D: MF-0010 seed planting, MF-0013 storms
          E: MF-0007 review, MF-0011 heatmap, MF-0017 expedition
          F: golden set, cards (H-2), content QA
          Owner: MF-0015 readiness, PR reviews
```

The only chains left are **inside one person's queue** (B: 0008 → 0014). Across people there are only
integration points: the second merger wires storms → readiness and seed step → walk.

**The real critical path is content, not code:** MF-0008 drafts → H-3 review sprint → enough approved
questions for storms. If MF-0008 slips, the team writes questions by hand in the same YAML; nothing
downstream changes.

**Team (D-3, decided 2026-11-03):** 5–6 coders, cohort of ~30 learners. Every learner reviews: 750 approvals ÷ 30 people ÷ 15 days ≈ **2 reviews per person per day**. Owners are assigned per track, so a ticket moves between people without editing its GOAL.md.

| Seat | Track | W1–W2 | W3–W4 |
|---|---|---|---|
| Owner (Sorin) | E + lead | Phase 0, MF-0006, PR reviews | MF-0015 readiness |
| Coder A | P | MF-0004, MF-0005 | Platform support, flag triage page polish |
| Coder B | C | MF-0008 | MF-0014 |
| Coder C | G | MF-0012 (warm-up), MF-0009 | MF-0016 |
| Coder D | G | MF-0010 | MF-0013 |
| Coder E | S | MF-0007, MF-0011 | MF-0017 |
| Coder F (if 6) | C/H | Golden set + eval for MF-0008, H-2 cards | Content QA, helps MF-0013 |
| All ~30 learners | H | H-1, H-2 | H-3 review sprint |

Fill names here: Coder A = …, B = …, C = …, D = …, E = …, F = ….

---

## 7. Working rules (short)

- One ticket = one branch off `main` = one PR. Run `/gsd-goal-loop MF-####`; high-risk tickets need the fresh-context reviewer and an evidence file.
- Nobody commits for anyone else; the PR author commits their own work.
- Engine stays pack-agnostic; every on-screen number comes from `src/engine/` (no arithmetic in components).
- UI follows `.claude/rules/ui-design.md` (shadcn only, tokens only) and `react-client-patterns.md`.
- Local stack only until MF-0004 lands; nobody points tests at the hosted project.
- A feature not playable by its week moves past Dec 7 (doc §1.7).

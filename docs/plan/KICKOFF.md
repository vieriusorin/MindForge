# Kickoff briefs (2026-11-03)

One brief per seat, ready to send. Each has a **day-1 task that needs no merged code**, so people can
start before `main` is ready, and then their first ticket.

**Everyone, first hour:** read `docs/MINDFORGE.md` §0–2, `CONTEXT.md` (glossary), `docs/plan/ROADMAP.md`
§4 (independence rules) and §7 (working rules), then your ticket's `.planning/tasks/MF-####/GOAL.md`.
Once `main` is ready (owner will say): install Node 24 and Docker, clone, then
`corepack enable && pnpm install && pnpm dev:setup && pnpm dev` (app on port **3001**; README → Quick start).
No global Supabase CLI needed. Sign in via Mailpit, play a Duel. Work through `/gsd-goal-loop MF-####`.
Branch per ticket off `main`, one PR per ticket, nobody commits for anyone else.

---

## Coder A: Platform

**Day 1 (no code needed):**
- Create the hosted Supabase project `mindforge-prod` in Frankfurt (company org). Don't run migrations yet.
- Create the Vercel project in the company team; turn on Vercel Authentication for previews.
- Install **Resend** through the Vercel Marketplace; verify a sending domain or use the Resend test domain for now.
- Send the owner: project refs, which env vars exist (names only, never values).

**Then:** MF-0004 (hosted env + auth hardening), MF-0005 (CI + grants gate). MF-0018 (local setup, pinned
Supabase CLI) is already done by another session; CI calls `pnpm exec supabase …`, never a global CLI. Write `docs/runbook/deploy.md` as you go.
**Done this week when:** a teammate signs in on the `*.vercel.app` URL with a real magic link.
**Don't touch:** `src/engine/**`, `src/features/**` (except auth/groups actions named in MF-0004).

---

## Coder B: Content pipeline

**Day 1 (no code needed):**
- Get the API key for the `mindforge` Console workspace from the owner; put it only in `.env.local`. Confirm the $100/month cap is set.
- Load the `claude-api` skill and note the current Sonnet/Opus model ids, Batch API and prompt caching syntax.
- For each of the 25 skills in `packs/ccdv-f/pack.yaml`, list 1–4 official doc URLs (docs.claude.com / platform.claude.com, never Skilljar). Send the list to the owner for a check (MF-0008 C-1).

**Then:** MF-0008 (corpus, QuestionWriter, Verifier), then MF-0014 (card + diagram writers).
**Done this week when:** a dry run produces 20 verified drafts for one skill that pass the loader.
**Don't touch:** app code under `src/app`, `src/features`.

---

## Coder C: Gameplay (practice)

**Day 1:** read `src/features/duel/**`, `src/engine/memory/select.ts` and `.planning/tasks/MF-0003/REVIEW.md`
(the notes MF-0012 closes). Read `.claude/rules/ui-design.md` and `react-client-patterns.md`.

**Then:** MF-0012 (Duel fixes, warm-up), MF-0009 (Daily Walk), later MF-0016 (Spot the Cuckoo, W4 stretch).
**Done this week when:** MF-0012 is merged.
**Don't touch:** migrations; `src/features/seed-planting/**` (Coder D).

---

## Coder D: Gameplay (learning + storms)

**Day 1:** read `MINDFORGE.md` §2.4–2.5 (nature cards, diagrams), the MF-0006 GOAL (the formats you
render), `.claude/rules/ui-design.md`. Spike in a scratch branch: render a diagram client-side (since 2026-11-04: a graph drawn with React Flow, ADR 0003),
lazy-loaded, readable in light and dark theme. Report what works.

**Then:** MF-0010 (Seed Planting + diagram rendering; needed for the Nov 15 release gate), then MF-0013 (Storms, W3).
**Done this week when:** the spike is reported and MF-0010's SCs are confirmed with the owner.
**Don't touch:** `src/features/walk/**` (Coder C), review tables (Coder E).

---

## Coder E: Social + review (database-heavy)

**Day 1:** read `supabase/migrations/*`, the README migration rules, and memory notes on Supabase
(revoke all first; TRUNCATE bypasses RLS; `connection()` before auth reads). Read MF-0007 and ADR 0001.
Sketch the tables and functions for MF-0007 (item registry, reviews, flag resolutions, maintainers)
and send the sketch to the owner before writing the migration.

**Then:** MF-0007 (Pollination), MF-0011 (group heatmap), later MF-0017 (Expedition, W4 stretch).
**Done this week when:** MF-0007's migration and DB acceptance tests are red-then-green locally.
**Don't touch:** `private.packs` / `create_group` (Coder A).

---

## Coder F: Content quality + analogy owner

**Day 1 (no code needed):**
- Write 10 of the ~30 golden-set questions for `evals/golden/` (exam-style, with the right key, a rationale for every option and an official doc link), plus 5 with a **planted flaw** (wrong key, missing rationale, wrong citation). Use the same YAML format as `packs/ccdv-f/questions/D2.S1.yaml`, but save the files in `evals/golden/`, **not** in `packs/` (golden questions must never be served to learners).
- Write **3 nature cards** for different skills, using the Temperature card in `MINDFORGE.md` §2.4 as the model. They're needed for the Nov 15 release gate (MF-0010 C-1).

**Then:** finish the golden set (with Coder B), review AI cards as analogy owner, content checks.
**Done this week when:** 3 cards and 15 golden questions are in a PR.

---

## Owner (Sorin)

- **Nov 3–4:** Phase 0 (commit in order, merge to `main`), then **MF-0006**, the only blocker. Tell everyone when it's merged.
- Set the Console key + cap; add yourself and Coder B/F to the content maintainer list (MF-0007).
- Then MF-0015 (readiness) and PR reviews.

## All ~30 learners (from W2)

- 2 reviews a day in the app once MF-0007 is live. Until then, review the 53 existing questions as PR comments (H-1).

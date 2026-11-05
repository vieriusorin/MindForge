---
ticket_id: MF-0053
tier: normal                      # dev tooling: a planning gate + skill text; no schema, auth, figures
stage: handoff   # SCs frozen at checkpoint 2026-11-05
branch: feat/MF-0053
builds_on: [MF-0052, MF-0025, MF-0028]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Drafted 2026-11-05 by the MF-0052 retro (cause: known-trap-repeated). Picked up 2026-11-05.

## Objective

**Today.** The gsd-goal-loop DESIGN preflight (Stage 2, item 1) says to run every command an SC names as its proof
(`pnpm test:db`, `pnpm build`, `pnpm check:packs`) before the checkpoint. MF-0025 and MF-0052 both skipped
`pnpm test:db`, and the same `mf-0013-storms` red surfaced only in TEST (MF-0052: a plan amendment and a user-approved
re-freeze). The instruction is prose and has been skipped twice.

**End state.** `pnpm gate:planning` (already in the Stop gate via `gate:*` and in CI, `.github/workflows/ci.yml:48`)
fails a GOAL.md past DESIGN whose Success Criteria name a `pnpm <script>` that its Iteration Log's "design preflight"
line does not mention, and the skill tells the author to write that line.

## Facts (re-derived at pickup, 2026-11-05)

- Gate: `scripts/check-planning.mjs` (CLI, `MF_TASKS_DIR` override) → pure `checkPlanning(entries)` in
  `scripts/lib/planning-check.mjs` (MF-0028). Frozen test: `src/test/__tests__/mf-0028-planning-check.acceptance.test.ts`;
  its fixtures use dirs `MF-0001…MF-0043`, all before the cutoff below.
- The phrase "design preflight" appears in **no** skill or template file; only 2 of 53 GOALs use it. The retro assumed a
  convention that is not written anywhere → SC-6 writes it.
- Probe of the drafted rule (scratchpad `probe.mjs`, read-only, cutoff ignored):
  - **MF-0052** (`git show 8b1aa89:.planning/tasks/MF-0052/GOAL.md`): preflight line present, SCs name `pnpm build`,
    `db:reset`, `dev:seed`, `test:db` that it does not mention → RED. (The retro said "names neither" `test:db` nor
    `build`; it also misses `db:reset` and `dev:seed`.)
  - **MF-0025**: SCs name `typecheck, lint, test, test:db`; **no** "design preflight" line at all (the retro said SC-6;
    the miss is the absent line) → RED via SC-2.
  - All 39 shipped GOALs past DESIGN would be flagged without the cutoff → the cutoff is required, not optional.
- With the cutoff, today's governed set is empty except MF-0053 itself (MF-0054 is `reserved`).
- Baseline 2026-11-05 on `8b1aa89`: typecheck ok · `biome check` 612 files ok · 144 files / 683 tests pass ·
  `gate:planning` 53 folders ok. `main` CI: run for `8b1aa89` in progress; previous (`629744a`) `success`.

## Constraints

- Gate scripts are guarded (`.claude/rules`, hooks): the user approves the change (C-1).
- Pure decision in `scripts/lib/planning-check.mjs`, I/O in the CLI (engineering-principles §1; MF-0028 shape).
- The MF-0028 frozen acceptance file stays byte-identical and green.
- No retroactive flags on shipped tickets.

**Constraints → how met.** Guarded → C-1 at the checkpoint. Pure/I-O split → new export `checkDesignPreflight`, CLI
reads `package.json` scripts and passes names in. MF-0028 frozen → `checkPlanning` signature unchanged (SC-7).
No retroactive flags → cutoff on folder name (SC-3).

## Success Criteria

- [x] **SC-1** `checkDesignPreflight(entries, scriptNames)` (new export, `scripts/lib/planning-check.mjs`): for a GOAL in
  scope, every script in `scriptNames` that `## Success Criteria` names as `pnpm <s>` or `pnpm run <s>` must appear as
  `pnpm <s>` on a `## Iteration Log` line containing `design preflight` (case-insensitive). Matching is whole-name:
  `pnpm test` does not cover `pnpm test:db`, and `pnpm test:db` does not cover `pnpm test`. A miss yields exactly one
  line `<dir>: design preflight does not mention pnpm <a>, pnpm <b>, named by an SC` (names in first-SC-mention order).
  *Proof:* frozen acceptance test.
- [x] **SC-2** A GOAL in scope with no such line yields `<dir>: stage <stage> but no "design preflight" line in the Iteration Log`.
  *Proof:* frozen acceptance test.
- [x] **SC-3** Out of scope → no line: folder `<= MF-0052` (string order), `goal_status: reserved`, `stage` `intake` or
  `design`, `goalText` null. `pnpm <x>` where `x` is not in `scriptNames` (`pnpm exec`, `pnpm dlx`) is ignored. CRLF
  text gives the same result as LF. In scope = `stage` ∈ plan · build · test · handoff · watch.
  *Proof:* frozen acceptance test.
- [x] **SC-4** Proof-case replay through the function, with the verbatim GOAL text placed under a folder after the cutoff:
  MF-0052 (`8b1aa89`) → mentions missing `build, db:reset, dev:seed, test:db` (as a set); MF-0025 → the SC-2 line.
  *Proof:* frozen acceptance test reading `git show 8b1aa89:<path>` at runtime.
- [x] **SC-5** `pnpm gate:planning` runs both checks, reading script names from the repo's `package.json`: exits 1 and
  prints the SC-1 line for a temp `MF_TASKS_DIR` holding a bad `MF-0060`; exits 0 on the real repo.
  *Proof:* frozen acceptance test (spawned CLI).
- [x] **SC-6** `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 preflight item (1) and the Iteration Log shape in
  `references/templates.md` tell the author to write one Iteration Log line `design preflight:` naming every
  `pnpm` command an SC names, each with its result or `not run: <reason>`, and say that `gate:planning` enforces it
  after MF-0052. *Proof:* `grep -n "design preflight" .claude/skills/gsd-goal-loop/SKILL.md .claude/skills/gsd-goal-loop/references/templates.md` (not frozen).
- [x] **SC-7** Regression lock: `mf-0028-planning-check.acceptance.test.ts` unchanged (sha256 = MF-0028 `FROZEN.json`)
  and green. *Proof:* hash + `pnpm test`.

## Decided without a question

- Cutoff is the folder name `> MF-0052`, a constant in the lib: the retro's proposed scope; the probe shows 39 shipped
  hits otherwise.
- Only stages past `design` are checked: the preflight runs *before the checkpoint*, so flagging intake/design would
  fail the Stop gate while the GOAL is being drafted.
- "Named" = a `package.json` script key, so `pnpm exec biome`, `pnpm dlx shadcn` never count: the rule is about proof
  commands, which are scripts.
- New export instead of widening `checkPlanning`: keeps the MF-0028 contract and its frozen test untouched (SC-7).
- Tier `normal`: no HIGH_RISK path (gate scripts are guarded, not high-risk).

## Concerns

| # | Concern | Owner | Status |
|---|---|---|---|
| C-1 | Editing guarded gate code (`scripts/lib/planning-check.mjs`, `scripts/check-planning.mjs`) and the gsd-goal-loop skill. | user | resolved 2026-11-05: edit both |
| C-2 | "Mention" is textual: `pnpm test:db` on the line passes even without a result. The gate cannot judge truth; the skill text asks for a result or `not run: <reason>`. | user | resolved 2026-11-05: mention is enough |
| C-3 | Steps an SC names that are not proofs (`pnpm db:reset`, `pnpm dev:seed` in MF-0052) count too, so the line must say e.g. `pnpm db:reset not run: wipes the shared local stack`. Matches Stage 2 item (2) (list state-wiping commands). | user | resolved 2026-11-05: count them |

## Decided by the user (2026-11-05)

- C-1 edit gate + skill · C-2 textual mention suffices · C-3 non-proof steps named by an SC count.
- No proof command wipes shared local state (SCs need no DB, no `db:reset`).

## Out of Scope

- Checking the line's claims against real command output (receipts). · Retroactive fixes to shipped GOALs.
- MF-0054 (pinning) and any app code.

## Iteration Log

- 2026-11-05 design preflight: `pnpm typecheck && pnpm lint && pnpm test` exit 0 (144 files, 683 tests); `pnpm gate:planning` ok (53 folders), on `8b1aa89`. `pnpm test:db` and `pnpm build` not run: SC-1 names them only as matching examples; no SC needs the DB or a build.
- 2026-11-05 proof-case replay: RED (MF-0052 misses build, db:reset, dev:seed, test:db; MF-0025 has no preflight line).
- 2026-11-05 iteration 0: frozen 14/15 red → BUILD (lib + CLI + skill text) → TEST: typecheck/lint/test (698) / gate:planning pass, frozen hashes match. DONE.

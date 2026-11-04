---
ticket_id: MF-0015
iteration: 0
---

## Discovery

- `/today` (`src/app/(app)/today/page.tsx`) already loads `pack`, `attempts`, `review`, and computes
  `countable = countableAttempts(attempts, review)` and `now`. Readiness reuses those; no new read.
- Memory: `replayMemory(attempts, at)` (ts-fsrs, no fuzz) returns retrievability at `at`;
  `memoryBySkill(attempts, at)` groups by skill. Replaying at the horizon = "current state, no future
  reviews" (reviews only happen at attempt times ≤ now). Elapsed days are floored by ts-fsrs.
- Pack: `exam.date` optional ISO date (MF-0006); CCDV-F has `2026-12-07`; onboarding sample has no exam.
- Precedent for card + engine figures: `summarizeForest` → `FocusList` (server component, Card +
  Separator rows + Badge), `StageIcon`.
- Gates: none in package.json beyond typecheck/lint/test/build.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1, SC-2, SC-4 | 1 | frozen acceptance file |
| SC-3 | 2, 3 | browser /today, light + dark |
| SC-5 | all | receipt |

## Steps

1. `src/engine/readiness/readiness.ts`: `READINESS_THRESHOLDS = { sunnyFrom: 85, cloudyFrom: 72, passMarkPercent: 72 } as const`
   (in `types.ts`/own const, exported via index); `weatherFor(percent | null)`; horizon =
   max(now, `${date}T00:00:00Z`); `memoryBySkill(attempts, horizon)`; per domain: forecast =
   Σ(w·R)/Σw over all skills (unattempted 0) or null if none attempted; last storm by max `finishedAt`;
   value = min of the present ones; round once; weather on rounded; overall = Σ(domainWeight·value,
   fog 0)/Σ domainWeight, null if all fog. Inner tests: `__tests__/readiness.test.ts` (exam passed →
   horizon = now; weatherFor boundaries; unknown storm domain ignored).
2. `src/features/dashboard/components/readiness-card/`: `readiness-card.tsx` (server component,
   no hooks), `types.ts` (`ReadinessCardProps { readiness: Readiness }`), `utils.ts`
   (`WEATHER_DISPLAY` icon+label+badge variant table, `stormLabel`, `forecastLabel`), `index.ts`,
   `__tests__/utils.test.ts`. Rows: weather icon tile (aria-hidden icon, word in Badge), domain name,
   meta "Forecast 52% · Storm 60%" / "No storm yet", right-aligned value; footer overall line
   "Overall 51% · pass mark 72% (approx.)".
3. `page.tsx`: `const forecast = readiness({ pack, attempts: countable, storms: [], now })`
   (MF-0013 wires storms); render `{forecast && <ReadinessCard readiness={forecast} />}` in the grid.

## Riskiest step

Step 1's horizon/projection: replaying at the horizon must never use a different attempt set than the
forest (would let forecast and forest disagree) → same `countable`. Not versioned content, no re-runnable
writes, no other people's data — the GOAL-stage checks for those do not apply.

## Rejected options

- Add `lastReviewAt` to `MemorySnapshot` and project with `forgetting_curve`: touches a type used by
  frozen MF-0001/MF-0011 fixtures; replay at horizon gives the same number with no type change.
- Recharts bar per domain: weather needs words + icon per row; a list card matches ui-design §3.5.

```json tasks
[
  {"id": "T1", "agent": "service-builder", "owns": ["src/engine/readiness/**"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-4"], "done_when": "frozen acceptance file green + inner tests", "context": "steps 1"},
  {"id": "T2", "agent": "ui-builder", "owns": ["src/features/dashboard/components/readiness-card/**", "src/app/(app)/today/page.tsx"], "depends_on": ["T1"], "closes": ["SC-3"], "done_when": "card visible on /today light+dark", "context": "steps 2-3"},
  {"id": "T3", "agent": "verifier", "owns": [], "depends_on": ["T2"], "closes": ["SC-5"], "done_when": "receipt PASS for current tree", "context": "typecheck, lint, test, build"}
]
```

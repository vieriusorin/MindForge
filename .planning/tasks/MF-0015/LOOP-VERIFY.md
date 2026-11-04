---
ticket_id: MF-0015
iteration: 0
---

## RED at freeze (2026-11-04)

Pre-freeze stub (typecheck green): `src/engine/readiness/readiness.ts` throws `not implemented`;
`types.ts` + `index.ts` declare the contract. Bindings: no `ticket:freeze` / `ticket:verify` /
`ticket:eval` scripts in `package.json` → defaults by hand, hash over LF-normalised content.

```
× SC-1: per-domain forecast, last storm, weather and overall, ten days before the exam   Error: not implemented
× SC-1: on exam day the lower of forecast and storm decides; 72 is cloudy, 88 is sunny  Error: not implemented
× SC-1: weather follows the whole percent shown (84.6 shows 85 → sunny; 71.4 shows 71 → rain)  Error: not implemented
× SC-2: no storm and no memory is fog; memory without a storm uses the forecast (no storm yet)  Error: not implemented
× SC-2: with nothing at all, every domain and the overall line are fog  Error: not implemented
× SC-4: the non-exam sample pack gets no readiness  Error: not implemented
× SC-4: an exam pack without an exam date gets no readiness  Error: not implemented
```

Each red is the SC's own (the function under test is unimplemented; fixtures load, the real
onboarding pack parses). FSRS oracle cross-checked once against ts-fsrs 5.4.2:
one Good on a new card → S = 2.3065, R after 10 days = 0.77436692 (formula by hand: 0.77437).

## Receipt — iteration 0 (2026-11-04) — DONE

Tree hash (`git diff HEAD -- src` + untracked `src/` files, sha256): `c6f098703410b36d54153ba5959a351090a87ded9a5d17e083b0ed9614e4212f`
Frozen file hash unchanged: `ade38982c6120e9f7664aa572865cfe99b42f5d0a1aa216a8d40e0283cc8c7d5` (= FROZEN.json).

```
pnpm typecheck   exit 0
pnpm lint        exit 0   Checked 409 files in 88ms. No fixes applied.
pnpm test        exit 0   Test Files 73 passed (73) · Tests 286 passed (286)   (baseline 70 / 270)
pnpm build       exit 0   /today ◐ Partial Prerender
```

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | mf-0015-readiness.acceptance: 3/3 SC-1 cases green (52/60 rain, 80 cloudy, fog; overall 51 rain; exam-day 88 sunny / 72 cloudy, overall 89; 84.6→85 sunny, 71.4→71 rain) |
| SC-2 | PASS | 2/2 SC-2 cases green (fog; forecast-only "no storm yet"; all-fog overall null) |
| SC-3 | PASS | Browser, http://localhost:3001/today, seeded learner, 1440×1100, light + dark emulated: "Readiness" card, 8 regions each with icon + word badge (Cloudy/Rain/Sunny), "Memory forecast N% · No storm yet", footer "Overall 67% · Rain · Pass mark 72% (approx.)" |
| SC-4 | PASS | 2/2 SC-4 cases green (team-onboarding-sample → null; exam pack without date → null) |
| SC-5 | PASS | receipt above; card folder index/types/utils/view + __tests__/utils.test.ts; view holds no hooks |

Inner tests: `src/engine/readiness/__tests__/readiness.test.ts` (5), `readiness-card/__tests__/utils.test.ts` (4).

Not verified: real storm input (MF-0013 not merged; page passes `[]`); a browser check of the onboarding pack (proved at engine level, as the SC allows); screen reader pass.

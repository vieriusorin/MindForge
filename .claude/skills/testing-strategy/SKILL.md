---
name: testing-strategy
description: Project-agnostic testing rules — find the installed test toolchain and real commands before writing a test; test services, pure helpers and authz in co-located __tests__/; mock at the facade, not deeper; DB-backed suites need a seeded database; figures shown in two places get a calculation-parity test; authorization needs DB/policy-level tests, not only E2E; no snapshot tests; ask before adding a new test toolchain (e.g. React Testing Library, msw). Load before writing tests or deciding a verification strategy.
---

# Testing Strategy

Before writing any test, find out what the project really has. Resolve every binding below from
`package.json`, the test configs and `CLAUDE.md`/`AGENTS.md`. **Do not invent commands.** If this
file and the repo disagree, the repo wins.

## Project bindings

| Binding | What to look for | Default if absent |
|---|---|---|
| Unit/integration runner | `vitest`/`jest` in devDependencies, `vitest.config.*`/`jest.config.*` | Ask before adding one |
| E2E runner | `@playwright/test`/`cypress`, `e2e/` dir | No E2E layer; say so |
| Component testing | `@testing-library/react`, `jsdom`/`happy-dom` | Not installed: put logic in hooks/utils and test those |
| Network mocking | `msw`, `nock` | Not installed: mock at the facade |
| Commands | `scripts` in `package.json` (`test`, `test:e2e`, an authz subset, `typecheck`, `lint`) | `<pm> test`, `<pm> exec tsc --noEmit` |
| Test location | Existing `__tests__/` or `*.test.ts` siblings | Co-located `__tests__/` |
| DB seed | A `db:seed`-style script and the fixture IDs tests read | No DB tests until a seed exists |
| Reference tests | The best existing facade-mock test and the best parity test in the repo | Write the first one carefully; it becomes the reference |

Find where coverage is concentrated (count test files per directory). That shows where the
project already thinks its risk is.

## Rules

### Test server-side and pure code first
New services, pure helpers (`lib/`, feature `utils`) and anything touching authorization get a
test file in a co-located `__tests__/` folder. If the repo already does this, keep doing it. Don't
present it as a new practice.

### Mock at the facade, not deeper
Mock at the module boundary that can't run outside its runtime, such as an auth getter that reads
request cookies. Run everything after it for real: the query, the row-level security, the
returned shape. If you mock deeper, the test only checks your mocks.

### Database-backed tests need a seeded database
Suites that read seeded fixtures must fail with an explicit message telling you to run the seed
command. A silent wrong result is not acceptable. Run the seed at least once before a DB suite.

### Calculation parity deserves a test
Any figure shown in two places (screen and export, list and detail, UI and email) gets a test that
asserts both paths produce the same value. Extend the existing parity test if there is one. Don't
rely on review.

### Authorization needs policy-level coverage, not just E2E
E2E proves what the UI shows, not what the database or API would allow. Keep policy-level tests
(RLS, guards, the authz subset) separate from browser tests.

### Before adding a new test toolchain, ask
Component testing or network mocking may be a real gap. Adding them is still a toolchain decision
with a maintenance cost. Propose it; don't add it unprompted. Logic kept in hooks and pure utils
can already be tested without a DOM.

### No snapshot tests
They break on every styling class change and say nothing about behaviour.

### Test behaviour, not implementation
Assert what a caller observes. UI-string assertions use the app's real copy, in the UI language.

### Know what jsdom can't prove (MF-0010 retro)
jsdom and user-event ignore `inert`, and Tailwind never compiles in jsdom. For a focus or
CSS-selector SC, assert the attribute or class on the subtree in a ui test, and prove the
behaviour in the browser (both themes for colour).

## Suggested gate for any change

```bash
<typecheck> && <test> && <lint>   # the project's real script names
```

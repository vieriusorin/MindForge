# Engineering Principles

**Normative from 2026-11-03.** Applies to every layer: pages, actions, server reads, engine,
lib, client components and hooks, migrations. The layer rules (`server-side.md`,
`client-side.md`, `composition-patterns.md`, `testing.md`, `state-and-data.md`) are these
principles made concrete. When a case isn't covered there, decide it from here.

## 1. Separation of concerns: one job per layer

```
page.tsx ──reads──▶ src/server/** ──rows──▶ DTO
   │                                          │
   ├──calls──▶ src/engine/** (pure decisions, figures) ◀──┘
   │
   └──props──▶ feature view ◀── hook (orchestration) ◀── utils.ts (pure decisions)
                                   │
                                   └──mutates──▶ actions.ts ──▶ src/server/** / DB
```

- **Functional core, imperative shell.** Decisions (rules, figures, validation, mapping) are
  pure functions in `src/engine/**`, `src/lib/**` or a component's `utils.ts`. I/O (DB, cookies,
  router, network, clock, randomness) lives at the edges and passes values into the core.
- A file that both decides and does I/O is split. The decision moves inward, where a plain unit
  test reaches it.

## 2. SOLID in every layer

| Principle | Server (reads, actions, routes) | Engine / lib | Client (views, hooks) |
|---|---|---|---|
| **S**ingle responsibility | a read returns one noun, an action performs one write, a route serves one resource | one module per domain concept (`forest`, `memory`) | view renders, hook orchestrates, utils decide |
| **O**pen/closed | new behaviour is a new read or action, not a flag on an old one (`getGroup(id, { withMembers })` ✗) | tables and config (`FOREST_THRESHOLDS`, `STAGE_HINT`) over growing `switch` chains | slots, `cva` variants, lookup tables |
| **L**iskov | every action honours the `ActionResult` contract. Every read keeps its null-or-throw contract | implementations behind one type are interchangeable (pack loaders, schedulers) | wrappers accept and forward the wrapped element's props |
| **I**nterface segregation | DTOs carry only the fields the caller shows (`Pick`, explicit `select`) | functions take the values they use, not whole objects "in case" | minimal props, declared `Use<Name>Return` without setters |
| **D**ependency inversion | actions and reads get the Supabase client from `src/server/supabase/*` and never construct it inline. Pure helpers take the client as a parameter (`fetch-attempts.ts`) | the engine imports nothing from `server`, `features` or React. The clock and randomness are parameters | views depend on props and callbacks, never on actions, router or query client |

Apply them where there is logic to separate. A 30-line component or a one-query read stays one
file (`react-client-patterns.md` rule 8).

## 3. Design rules

- **One owner per fact.** A type, a schema, a figure or a constant is defined once and imported
  elsewhere. Duplication of *knowledge* is the bug. Duplication of two similar-looking lines is not.
  Extract on the second real consumer, not in anticipation.
- **KISS / YAGNI.** Build what the ticket needs. Don't add options, abstractions, generic helpers
  or config for a hypothetical caller.
- **Validate at the boundary, trust inside.** Every input from outside (form, action, route param,
  search param, file, JSON, env) is parsed with zod once at the edge. Inner code takes typed values
  and does not re-check them.
- **Fail fast and loud.** Invalid state throws or returns a typed error immediately. No silent
  defaults that hide a bug (`?? 0` on a figure, an empty `catch`).
- **Make illegal states unrepresentable.** Use discriminated unions over boolean clusters and
  branded strings for ids and dates where mixing them up is possible.
- **Immutability by default.** `readonly` DTOs, no mutating parameters, new objects over in-place edits.
- **Least privilege.** RLS on every table, explicit authorization in every action, the narrowest
  Supabase client and the fewest columns that work.
- **Small, deep modules.** A module hides a decision behind a small API. Many tiny pass-through
  files and one giant file are both failures.

## 4. Every change is proven

| A change to… | Is proven by |
|---|---|
| engine / lib / `utils.ts` decision | unit test (`*.test.ts`) per exported decision |
| server read or action logic | unit test of its pure parts, plus `*.db.test.ts` when RLS, grants or SQL behaviour matter |
| client hook that branches, or an interactive component | `ui` test (`*.test.tsx`, RTL) per user-visible outcome |
| a bug | a test that fails before the fix |
| a figure shown in two places | a parity test |
| a page, layout or Suspense placement | `pnpm build` and a browser check |

Details and helpers: `testing.md`. A change without its proof is not done.

## 5. Definition of done

1. The change follows the layer rules and these principles, and nothing is grandfathered that
   was touched.
2. `pnpm typecheck && pnpm lint && pnpm test` pass. Add `pnpm test:db` for `supabase/**` or
   `src/server/**`, and `pnpm build` plus a browser check on port 3001 for UI.
3. New decisions have tests, and the tests assert requirements, not the implementation's output.
4. The hand-off lists the changed files and a commit message (`no-commit.md`).

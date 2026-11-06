# Code Conventions

**Normative from 2026-11-03.** Applies to every file under `src/`. Biome (`pnpm lint`) enforces
formatting and its recommended rules; this file covers what Biome can't see. How-to for types:
the `typescript-strict` skill. Domain names: `CONTEXT.md` wins over code and tickets.

## Names

| Thing | Convention | Example |
|---|---|---|
| Files and folders | kebab-case | `list-my-groups.ts`, `create-group-form/` |
| Components, types, interfaces | PascalCase | `GroupList`, `GroupDetail` |
| Functions, variables | camelCase, verb first for functions | `getGroup`, `summarizeForest` |
| Hooks | `use<Name>` in `use-<name>.ts` | `useCreateGroupForm` |
| Constants that are config/tables | SCREAMING_SNAKE | `STAGE_ICON`, `FOREST_THRESHOLDS` |
| Booleans | `is` / `has` / `can` / `should` prefix | `isAdmin`, `canInvite` |
| Event props / handlers | prop `on<Event>`, handler `handle<Event>` | `onArchive`, `handleArchive` |
| Server reads | `get<Noun>` (one or null) · `list<Nouns>` (array) | `getGroup`, `listMembers` |
| Server Actions | imperative verb + noun | `createGroup`, `rotateInviteCode` |
| Tests | `<subject>.test.ts`; DB `*.db.test.ts`; frozen SC `*.acceptance.test.ts` | |

Use the full domain word (`attempt`, not `att`). Abbreviate only universal terms (`id`, `url`, `db`).

## Functions and exports

- Write `function` declarations for exported functions and components. Use `const` arrows only
  for callbacks and small local lambdas.
- Use named exports everywhere. **Default exports only where Next requires them:** `page`,
  `layout`, `loading`, `error`, `not-found`, `template`, `default`, and `*.config.*`.
- Give every exported function, hook, Server Action and server read an explicit return type.
- Prefer one public thing per server/engine file. The file name is the function name in kebab-case.
- Return early. Keep nesting at three levels or fewer, and replace nested ternaries in JSX with a
  variable or a lookup table.
- Use an object parameter once a function takes more than two arguments or any boolean flag.

## Imports

- Use `@/` across folders and relative paths only inside one component or engine folder.
- Use `import type` for type-only imports.
- Allowed barrels (`index.ts`): a component folder, an engine module (`src/engine/<m>/index.ts`).
  Add no other barrels, and never `export *` from `src/server/**`.
- Never deep-import past a barrel (`@/features/x/components/y/hooks/...`).
- Import direction: `app → features → server → engine/lib`. `engine` and `lib` import neither
  `server` nor `features`. `components/` (shared UI) imports no `features/`.

## Types

- Never use `any`, `enum`, `namespace` or `@ts-ignore`. Use `unknown` and narrow it. Write
  `@ts-expect-error` only with a reason.
- Model closed sets as `as const` arrays plus a derived union. Use `as const satisfies Record<Union, T>`
  for every map keyed by a union.
- Never cast with `as` to silence the compiler. Parse with zod at the boundary instead (form
  input, action input, route params, search params, file and JSON content). **Named exceptions**,
  each kept to the one line that needs it:
  - re-typing keys that TypeScript widens to `string`: `Object.keys(x) as K[]`, and
    `Object.entries` / `Object.fromEntries(…) as Record<K, V>` over a closed union
    (`action-result.ts`, `growth-donut/utils.ts`)
  - a caught error: prefer `error instanceof Error`. `(error as NodeJS.ErrnoException).code`
    is fine for a Node errno check
  - test fixtures and `src/test/**` helpers
  `as unknown as` is never allowed outside one commented helper.
- Declare one shape in one place. Derive the others with `Pick`, `extends` or indexed access;
  don't restate them.

## Comments

- Comment the **why**: a constraint, a ticket (`MF-0003:`), a trap. Never narrate what the next
  line does.
- Give exported server reads and engine functions a one-line `/** … */` contract when null,
  throw or edge behaviour isn't obvious from the type.
- Don't leave commented-out code or a `TODO` without a ticket ID.

## Errors and logging

- Server reads **throw** on infrastructure errors with a prefixed message
  (`throw new Error(\`getGroup: ${error.message}\`)`) and **return `null`/`[]`** for "not found" or
  "not visible".
- Server Actions never throw to the client for expected failures. They return `ActionResult`
  (`state-and-data.md` §3).
- Don't leave `console.log` in committed code. `console.error` is allowed in error boundaries and
  Route Handlers only, and never with a secret, token or a whole row. **Named exception** (MF-0058, user
  2026-11-06): the `catch` around each `recordCourseCompletion(` call may `console.error` the error message
  only, because a failed completion record must never fail the attempt and must not fail silently.

## Dates and numbers

- Pass the clock in (`now: Date`) to engine and lib functions. Never call `Date.now()` or
  `new Date()` inside `src/engine/**` or inside a render.
- Every figure shown on screen comes from `src/engine/**`, with no arithmetic in a component or page.

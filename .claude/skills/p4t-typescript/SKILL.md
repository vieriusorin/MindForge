---
name: p4t-typescript
description: P4T TypeScript rules: strict, no any/@ts-ignore/enum, import type, explicit return types on exported functions and hooks, Use<Name>Return interfaces with no setters, discriminated unions on `ok` (ActionResult), branded MonthKey/IsoDate, and the TYPE-COMPOSITION rules — when to declare vs derive, one owner per shape, Pick/extends (never Omit) across a PII/financial DTO boundary, generics with constraints, `as const satisfies Record<Union, T>` for every union-keyed map, mapped and conditional types, Next's global PageProps<"/route">, the shared Tx/period/option types. Load when writing or reviewing TypeScript types, interfaces, hook signatures, exported function signatures, or when a new interface looks like one that already exists.
---

# TypeScript — P4T

`docs/typescript-conventions.md` (LS-0311) is the long-form *why*; this skill is the checklist.
`.planning/tasks/LS-0335/TYPE-CONSOLIDATION.md` records the 2026-09-24 consolidation, and
`pnpm gate:type-dupes` keeps it from regressing. Same-name declarations: **0**. Identical-shape
clusters: **3**, each a reviewed "different concept" on the gate's `KEEP_SHAPE_CLUSTERS` list.

Baseline measured 2026-09-24 over `src/` (non-test): **0** `any`, **0** `@ts-ignore` /
`@ts-expect-error`, **0** `enum`. Keep all three at zero; a PR that adds one needs a comment that
names the reason, and reviewers should treat it as a design question, not a lint nit.

---

## 1. Baseline rules

| Rule | Detail |
|---|---|
| `strict: true` | No exceptions. No `any`; for an unknown value use `unknown` and narrow. |
| `import type` | For every type-only import (`import type { Role } from "@/server/authz/matrix"`). |
| Explicit return types | On every **exported** function, Server Action, service and hook. Local helpers may infer. |
| `@/` alias | For `src/` across folders; relative only inside a component folder. |
| No `enum`, no `namespace` | Use a `const` array + derived union (§4.5). |
| `as unknown as` | Never at a call site. A raw `sql` read uses `executeRows<TRow>(tx, sql…)` (`server/db/tx.ts`), which holds the one cast. The 8 left are distinct seams (`globalThis`, `z.NEVER`, a zod schema union), each commented. |

### Hook returns — declared, never inferred

Every behavioural hook declares `Use<Name>Return` in its folder's `types.ts`. **Never**
`type UseXReturn = ReturnType<typeof useX>` — the interface is a *prohibition*: it keeps
state-mutating members away from the view. `pnpm gate:hooks` enforces it.

- Sanctioned: `control`, `register`, `errors`, `onSubmit`, `isSubmitting`, derived values.
- Forbidden: `handleSubmit`, `setValue`, `setError`, `reset`, `trigger`, `watch`, `formState`,
  any raw `set<Foo>`. Name the command (`onModeChange`), not the setter (`setMode`).
- **A shared base for hook returns is itself named `Use*Return`** (`UseGridSelectionReturn`,
  `UseReasonDialogReturn`, `UseClientTableReturn<TRow>`). `gate:hooks` finds contracts by that
  name, so a base called `GridSelection` would be a place a setter could hide from it.

### Result carriers — discriminate on `ok`

```ts
// src/lib/action-result.ts — the one carrier for Server Action results
export type ActionResult<TData extends object = NoData, TError = string, TCommon extends object = NoData> =
  (({ ok: true } & TData) | { ok: false; error: TError }) & TCommon;
```

Never discriminate a result on `status` — `status` is a domain field on half the rows here.
Instantiate the carrier (`ActionResult<{ id: string }>`); do not hand-write a new `{ ok … }` union.

### Status state — discriminated unions

```ts
type SaveState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };
```

Pair with an exhaustive `switch` ending in `const _exhaustive: never = state;`.

### Temporal strings — branded

`MonthKey` / `IsoDate` from `src/lib/temporal.ts`. Parse at the boundary (`parseMonthKey`,
`requireIsoDate`); never `x.split("-").map(Number)` (`pnpm gate:dates`). Entity ids are
deliberately **not** branded (ADR-009).

---

## 2. The composition rule — declare or derive?

> **Derive** when the source of truth is an implementation you control and the type is its shadow.
> **Declare** when the type *is* the contract — when it exists to constrain the implementation.

| Situation | Do | Example in repo |
|---|---|---|
| Form values from a zod schema | `z.infer<typeof schema>`, named `<Feature>FormValues` | `concediu-entitlement-dialog/utils.ts` |
| Row type of a Drizzle table (server-only) | `typeof table.$inferSelect`, then `Pick` | — |
| Response of a service you own | the service's **exported named row type** first; `Awaited<ReturnType<typeof fn>>` only if none exists | `CerereDetailRow`, `AllSantiereCostBreakdown` |
| Union of literals from a list you own | `(typeof LIST)[number]` | `APP_ROLES` → `AppRole` |
| Hook return, Server Action result, DTO, domain union | **declare** it | `Use*Return`, `ActionResult<…>`, `EmployeeAdminDTO`, `AlertType` |

---

## 3. One owner per shape

Before writing `interface Foo {`, search for the shape, not the name. The 2026-09-24 audit found
32 identical-shape clusters and 13 same-name clusters (LS-0335). The standing owners:

| Shape | Owner — import it, do not restate it |
|---|---|
| `{ from: string; to: string }` | `DateRange` (`lib/temporal.ts`). Domain names stay as aliases (`CostPeriod`, `CasareReportPeriod`), and **the alias's doc states the boundary convention** — most are inclusive, casare and pontaj-ore are half-open. |
| `{ from: Date; to: Date }` | `InstantRange` (`lib/time-zone.ts`) |
| Drizzle transaction | `Tx`, or `TxOf<TSchema>` for a generic seam (`server/db/tx.ts`). `PostgresJsTransaction<…>` is spelled in that file only. |
| Raw `sql` rows | `executeRows<TRow>(tx \| db, sql…)` (`server/db/tx.ts`) |
| `postgres()` client in seeds | `SqlClient` (`server/db/seed/sql-client.ts`) |
| `Role` | `AppRole` (`lib/roles.ts`, derived from `APP_ROLES`); `matrix.ts` and the seeds alias or re-export it. Never re-list the five literals. |
| `{ id; nume }`, `{ employeeId; numeComplet }`, `{ employeeId; employeeNume }`, `{ santierId; santierNume }` | `NamedOption`, `PersonOption`, `EmployeeNameRef`, `SantierRef` (`lib/options.ts`) |
| Posting window (`employeeId`, `validFrom`, `validTo`) | `AllocationInterval` (`lib/allocation-interval.ts`), composed with the refs above |
| Paged rows / page controls | `PagedRows<TRow>` (`lib/report-pagination.ts`); controls are `Omit<PagedRows<never>, "rows">` |
| Report screen rows | the service's `*ExportRow`: screen and export are the SAME row by the parity invariant |
| Cost figures | `CostBreakdownTotals` (`cost-engine/types.ts`), extended per composition |
| Cerere read columns | `Pick<CerereDetailRow, …>` (`cereri/get-cerere.ts`) |
| Rendered email | `EmailContent` (`identity/send-auth-email.ts`, the transport) |
| Diurnă inputs for a people-report | `readScopedDiurnaInputs` → `DiurnaInputs` (`rapoarte/read-diurna-inputs.ts`) — a read, and a type |

**`@/types` is the index, not the home** (LS-0336). `src/types/index.ts` re-exports the
client-safe shared owners above (`DateRange`, `MonthKey`, `IsoDate`, `InstantRange`, the four
`lib/options.ts` refs, `AllocationInterval`, `ActionResult`, `NoData`, `PagedRows`, `AppRole`), so
`import type { DateRange, NamedOption } from "@/types"` is the one path to reach for. Nothing is
DECLARED there: a new shared shape gets its owner next to its source and a line in the barrel, in
the same change. Server-shared types (`Tx`, `executeRows`, DTOs) are never indexed; import them from
their owner. `src/types/__tests__/index.test.ts` fails on a declaration, a runtime export, an
`@/server` re-export, or a type in `lib/options.ts` / `lib/allocation-interval.ts` that is missing
from the barrel.

**Same name in two files is a smell even when the shapes differ.** Two `SantierOption`s, two
`BulkHoursDialogProps`, six `FormValues` make "go to definition" lie. Prefix with the owner
(`AddIncidentFormValues`, `LunarBulkHoursDialogProps`).

**Never let a DTO `extends` a DB row type** (`EmployeeRow`, `SantierRow`). A column added to the
SELECT would become a required DTO field, the mapper would be forced to copy it, and it would ship
to every viewer. DTOs chain among themselves only (Public → Self → Admin).

**Hoist on the second consumer** (`react-client-patterns.md` rule 9): same feature →
`src/modules/<f>/types.ts`; second *feature* → `src/lib/`; server-only → the owning service.

---

## 4. Which tool for which job

### 4.1 `Pick` / `extends` vs `Omit` — allowlist vs denylist

`Pick<T, K>` and `interface B extends A` are **allowlists**: a field added to the source does not
appear in the derived type. `Omit<T, K>` is a **denylist**: every future field of the source
appears automatically.

**Hard rule — across a PII or financial boundary (`server/authz/dto.ts`, anything that strips
`tarifOrar`, `personalEmail`, `emergencyContact`, a cost figure) never derive the narrower type
with `Omit` from the wider one.** Build upwards instead:

```ts
// right — a new admin-only field cannot leak into the public DTO
export interface EmployeePublicDTO { id: string; codAngajat: string; numeComplet: string; /* … */ }
export interface EmployeeSelfDTO extends EmployeePublicDTO { personalEmail: string | null; /* … */ }
export interface EmployeeAdminDTO extends EmployeeSelfDTO { tarifOrar: string; tarifOrarValidFrom: string }

// wrong — adding `salaryNet` to Admin silently adds it to Public
type EmployeePublicDTO = Omit<EmployeeAdminDTO, "tarifOrar" | "personalEmail" | /* … */>;
```

Everywhere else `Omit` is fine when the sentence really is "all of X except":
`Omit<PagedRows<never>, "rows">`, `Omit<ComponentProps<"input">, "type">`.

### 4.2 Generics — when the *relationship* is the contract

Use a type parameter when two positions must agree, not to avoid writing a type. Constrain it.

```ts
// lib/export/build-export.ts — a column can only name a key the row actually has
export interface ExportColumn<TRow> { key: keyof TRow & string; header: string }

// modules/rapoarte/utils/report-view.ts — accepts anything with the two keys it reads
export const toPickerOptions = <T extends { id: string; nume: string }>(rows: T[]) => …
```

```ts
// modules/flota/actions.ts — every per-vehicle action reports vehicleId plus its own payload
export type VehicleActionResult<TExtra extends object = NoData> = ActionResult<VehicleRef & TExtra>;
export type CloseTripActionResult = VehicleActionResult<{ tripId: string; implausibleJump: boolean }>;

// modules/santiere/types.ts — two client-side tables, identical but for the row
export interface UseClientTableReturn<TRow> { columns: ColumnDef<TRow, unknown>[]; rows: TRow[]; /* … */ }
```

Signs a generic is wanted: two interfaces identical except for one field's type, or N copies of
`{ rows: X[]; total: … }`. Signs it is not: one call site, or a parameter that appears once
(`<T>(x: T): void` — just use `unknown`). Two identical shapes with the *same* field types want a
shared interface, not a generic (`AlertCollection` replaced `CerereAlerts`/`OvertimeAlerts`).

### 4.3 Unions — closed sets and "one of these shapes"

- Closed literal set → union derived from a `const` array (§4.5).
- Alternative shapes → discriminated union on a literal key (`ok`, `kind`, `status`).
- Never an optional-field bag. `FlotaActionResult` had 13 optional payloads, so any flota action
  could structurally return any other's, and `result.tripId` after `createVehicleAction` compiled.
  LS-0335 split it into one result type per action (above).

### 4.4 `satisfies` — check without widening

```ts
// server/services/notificari/utils/alert-priority.ts
export const ALERT_PRIORITY = { … } as const satisfies Record<AlertType, number>;
```

**Required** for every map keyed by a domain union (labels, priorities, tab config, chart config):
a new union member without an entry becomes a compile error, and the literal types survive for
the consumer. Prefer it over an annotation (`: Record<AlertType, number>`) when the consumer
benefits from the narrow literal type; the annotation is acceptable when it does not.
Use `satisfies` on object literals returned into a declared shape (`} satisfies CoverageDayAbsence`)
to catch excess keys at the construction site.

### 4.5 `as const` arrays → unions (instead of `enum`)

```ts
export const APP_ROLES = ["administrator", "sef_santier", "sef_depozit", "sef_flota", "lucrator"] as const;
export type AppRole = (typeof APP_ROLES)[number];
```

One array feeds the type, the zod `z.enum(APP_ROLES)`, and the UI option list. Query-key tuples
are `as const` too.

### 4.6 Mapped types — one shape per key of another

```ts
// lib/export/build-export.ts — every row field is serialised as a string
export type ExportRowShape<TRow> = { [K in keyof TRow]: string };

// server/services/import/entity-registry.ts — a handler per entity, typed to that entity's row
const IMPORT_ENTITY_HANDLERS: { [K in ImportEntityType]: ImportEntityHandler<ImportRowByEntity[K]> } = { … };
```

Reach for one when you are about to write the same object type once per union member.
`Record<K, V>` is the mapped type for the case where `V` does not depend on `K`.

### 4.7 Conditional types — rarely, and at a seam

One exists (`server/pdf/foaie-document.ts`: `… extends infer T ? keyof T : never`). Use them for a
library/generic seam (unwrapping, key extraction) — never to encode business rules, which belong
in a function with a test. If a conditional type needs a comment to read, a named overload or two
declared types are usually clearer.

### 4.8 Indexed access and `typeof` — follow a declared owner

`EmployeeAdminDTO["status"]`, `(typeof CATALOG)[number]["slug"]`, `Parameters<typeof fn>[0]`.
Good for pointing at one field of an owner instead of restating its literal union
(`status: "activ" | "inactiv"` appears in three DTOs — index one of them, or name the union).

---

## 5. Next.js route props

Next 16 generates global `PageProps<"/route">` and `LayoutProps<"/route">`
(`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`). Use them
instead of hand-writing `{ params: Promise<{ id: string }> }` — the route literal is checked
against the file tree, so a renamed segment becomes a type error:

```ts
export default async function Page(props: PageProps<"/flota/[id]">) {
  const { id } = await props.params;
}
```

The globals live in `.next/types/routes.d.ts`, and `.next/` and `next-env.d.ts` are gitignored, so
`pnpm typecheck` is `next typegen && tsc --noEmit` and CI runs that script (LS-0335). **Run
`pnpm typecheck`, not bare `tsc`**, on a fresh checkout, or `PageProps` will not resolve.

An inner Suspense section that receives the promise takes `PageProps<"/r">["params"]` (indexed
access), or `Pick<PageProps<"/r">, "searchParams">` for the object. It does not restate
`Promise<{ id: string }>`.

---

## 6. Review checklist

- [ ] No new `any`, `@ts-ignore`, `enum`, `namespace`.
- [ ] Every new `interface`/`type` searched for an existing owner by **shape** (§3).
- [ ] No new same-name type in a second file. `pnpm gate:type-dupes` fails on both.
- [ ] DTO narrowing is `Pick`/`extends`, not `Omit` (§4.1, also gated). No DTO extends a row type.
- [ ] Union-keyed maps use `as const satisfies Record<Union, T>` (§4.4).
- [ ] Hook return declared, no setters; Server Action returns `ActionResult<…>`.
- [ ] Exported functions have explicit return types; type-only imports use `import type`.
- [ ] Route props use `PageProps<"/…">`.

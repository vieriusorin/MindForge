---
name: p4t-react-feature-architecture
description: P4T feature decoupling rules: modules/ is UI-only and actions.ts is thin, reads live in src/server/services/<f>/ as single-purpose functions, compose in parallel at the RSC page with ReactNode slots instead of fetching in children, the N+1 joined-read escape hatch, cross-feature import limits, and the override that derived figures (salarii, diurna, cazare, cost/km, casare) must come from server/services/cost-engine/ rather than page-side arithmetic. Load before adding a service read, an actions.ts, or wiring a page to feature components.
---

# React Feature Architecture

Source: [Feature-based React Architecture — Robin Wieruch](https://www.robinwieruch.de/react-feature-architecture/)

The principle: each vertical feature is decoupled from the others as far as possible.
Components and reads stay focused on one domain, and the *page* composes them. This keeps
`modules/pontaj` from quietly growing knowledge of șantiere, flotă and cereri.

## Name translation — read this first

The article's folder names are not this repo's folder names. Do not create `src/features/`.

| Article | This repo | Contains |
|---|---|---|
| `features/<f>/components/` | `src/modules/<f>/components/` | UI only — components, hooks, `actions.ts` |
| `features/<f>/queries/` | `src/server/services/<f>/` | the reads and the domain logic |

`modules/` is UI. `actions.ts` in a module is thin: parse input (zod) → call a service →
`revalidatePath`/return. No reads and no arithmetic live in `modules/`, and there is no
`modules/<f>/queries/` folder — that would be a third home for reads. Authoritative layout:
`.planning/research/ARCHITECTURE.md` §Recommended Project Structure.

Feature names mirror the RBAC matrix page groupings 1:1: `pontaj`, `santiere`, `inventar`,
`flota`, `cereri`, `rapoarte`, `notificari`.

## Reads are single-purpose

One read per domain noun. No permutations of nested relations.

```ts
// Wrong — src/server/services/santiere/get-santier.ts
// Every new caller adds another variant: getSantierWithPontaj, getSantierWithVehicles, …
export const getSantierWithPontaj = async (santierId: string) => {
  return db.query.santiere.findFirst({
    where: eq(santiere.id, santierId),
    with: { pontajEntries: true },
  });
};
```

```ts
// Correct — src/server/services/santiere/get-santier.ts
import type { Santier } from "@/server/db/schema/santiere";

export const getSantier = async (santierId: string): Promise<Santier | undefined> => {
  return db.query.santiere.findFirst({ where: eq(santiere.id, santierId) });
};
```

```ts
// Correct — src/server/services/pontaj/get-pontaj-entries.ts
import type { PontajEntry } from "@/server/db/schema/pontaj";

export const getPontajEntries = async (
  santierId: string,
  range: DateRange,
): Promise<PontajEntry[]> => { ... };
```

## Compose at the page, fetch in parallel

A feature component that fetches its own data creates a waterfall: the page awaits the
șantier, then the child awaits pontaj. Both reads only need `santierId`. Fetch both in the
RSC page and pass the child *as a prop*.

```tsx
// src/app/(dashboard)/santiere/[id]/page.tsx
import { getSantier } from "@/server/services/santiere/get-santier";
import { getPontajEntries } from "@/server/services/pontaj/get-pontaj-entries";
import { SantierDetail } from "@/modules/santiere/components/santier-detail";
import { PontajTable } from "@/modules/pontaj/components/pontaj-table";

const SantierPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const santierPromise = getSantier(id);
  const entriesPromise = getPontajEntries(id, currentMonth());

  const [santier, entries] = await Promise.all([santierPromise, entriesPromise]);

  if (!santier) notFound();

  return (
    <SantierDetail
      santier={santier}
      pontaj={<PontajTable entries={entries} />}
    />
  );
};

export default SantierPage;
```

```tsx
// src/modules/santiere/components/santier-detail.tsx
import type { ReactNode } from "react";
import type { Santier } from "@/server/db/schema/santiere";

interface SantierDetailProps {
  santier: Santier;
  pontaj: ReactNode;
}

export const SantierDetail = ({ santier, pontaj }: SantierDetailProps) => (
  <section>
    <h1>{santier.nume}</h1>
    {pontaj}
  </section>
);
```

Name the slot for what it holds (`pontaj`, `kpi`, `transferuri`) rather than using `children`.

Two payoffs beyond the parallel fetch:

- `PontajTable` can be a Client Component (TanStack Table, nuqs filters) while
  `SantierDetail` and the page stay Server Components. Without composition, one `"use client"`
  child drags the parent boundary with it.
- A page composed of a server half and a client half needs **both** `revalidatePath` and
  `invalidateQueries` after a mutation — `revalidatePath` does nothing to the TanStack cache.

## Derived figures do NOT get composed page-side

This overrides the rule above, and it is not negotiable.

Single-purpose reads apply to **rows**. They do not apply to **figures**. Any number that
also lands in an export — salarii, diurnă, cazare, cost/km, casare totals — comes from one
function in `server/services/cost-engine/`, called by both the RSC page and
`app/api/export/[report]`. Never assemble a figure in the page out of several feature reads:
that is exactly how screen and export drift, which `.planning/PROJECT.md` calls
trust-destroying.

```tsx
// Wrong — page-side arithmetic across features. The export route cannot reuse it.
const [entries, rate] = await Promise.all([getPontajEntries(id, range), getDiurnaRate(id)]);
const diurna = entries.filter((e) => e.deplasare).length * rate;
```

```tsx
// Correct — one function, both callers.
import { getSantierCost } from "@/server/services/cost-engine/santier-cost";

const breakdown = await getSantierCost(id, range);
```

Chart numbers are figures too: they come from the same cost-engine function as the table
beside them, never a separate query.

## The join escape hatch — and where it lives

Per-feature reads degenerate into N+1 on list pages. The real case here is pontaj: many
angajați × many days × several șantiere. Fetching a șantier's rows once per employee is the
bug, not the decoupling.

So a joined/aggregated read is allowed when the alternative is N+1 — but it lives in
`server/services/<feature>/` as one named, deliberate function, never inside a module and
never as an ad-hoc query in a page. Before reaching for it, check whether the page needs
that data at all (lazy pane, drill-in on click) — that is usually the better fix.

## Cross-feature imports

- A page may import from any number of features. That is its job.
- A module component may import another module's component only when it is composing it as
  a slot — prefer passing it in from the page.
- A service in `server/services/a/` must not import `server/services/b/` to widen its own
  read. Compose the two at the page, or write one deliberate joined read per the section above.
- Shared, feature-agnostic helpers (formatters, nuqs parsers, zod schemas, constants) go in
  `src/lib/`. Something is only shared once a second feature actually needs it.

## Language

Domain nouns keep their Romanian spelling in identifiers (`pontaj`, `santier`, `depozit`,
`diurna`, `cerere`) — that is what the users say. Everything else in code stays English.
User-facing strings are Romanian.

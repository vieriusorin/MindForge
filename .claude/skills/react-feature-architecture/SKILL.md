---
name: react-feature-architecture
description: Feature decoupling rules for React / Next.js App Router apps — the feature UI folder is UI-only and actions.ts is thin, reads live in a server services layer as single-purpose functions, compose in parallel at the RSC page with ReactNode slots instead of fetching in children, the N+1 joined-read escape hatch, cross-feature import limits, and the override that derived business figures (totals, rates, costs) come from one domain service rather than page-side arithmetic. Load before adding a service read, an actions.ts, or wiring a page to feature components.
---

# React Feature Architecture

Source: [Feature-based React Architecture — Robin Wieruch](https://www.robinwieruch.de/react-feature-architecture/)

The principle: each vertical feature is decoupled from the others as far as possible.
Components and reads stay focused on one domain, and the *page* composes them. This keeps one
feature's folder from quietly growing knowledge of every other feature.

## Project bindings

Resolve these from `CLAUDE.md` / `AGENTS.md`, the existing folder layout, and `package.json`
before writing code. The codebase wins over the defaults.

| Binding | What to look for | Default if absent |
|---|---|---|
| Feature UI root | where feature components / hooks / `actions.ts` live | `src/modules/<feature>/` |
| Services root | where reads and domain logic live | `src/server/services/<feature>/` |
| Shared helpers | feature-agnostic formatters, parsers, schemas | `src/lib/` |
| Figures engine | the one place derived business figures are computed | `src/server/services/<figures-domain>/` — create it on the first figure that is shown in two places |
| Export / report surface | routes that re-emit figures shown on screen (CSV, PDF, API) | none — the figures rule still applies to charts beside tables |
| Feature list | the canonical feature names (often the nav / permission groupings) | the existing top-level folders under the UI root |
| Architecture doc | a planning/ADR doc defining the layout | none |
| Identifier language | whether domain nouns keep a non-English spelling | English everywhere |

## Name translation — read this first

The article's folder names are probably not this repo's. Do not create `src/features/` unless
that is already the convention.

| Article | Here (bindings) | Contains |
|---|---|---|
| `features/<f>/components/` | feature UI root | UI only — components, hooks, `actions.ts` |
| `features/<f>/queries/` | services root | the reads and the domain logic |

The feature UI root is UI. `actions.ts` in a feature is thin: parse input (zod) → call a
service → revalidate / return. No reads and no arithmetic live in the UI root, and there is no
`<feature>/queries/` folder — that would be a third home for reads.

Feature names should mirror one stable grouping 1:1 (usually the nav or permission matrix).

## Reads are single-purpose

One read per domain noun. No permutations of nested relations.

```ts
// Wrong — services/projects/get-project.ts
// Every new caller adds another variant: getProjectWithTasks, getProjectWithMembers, …
export const getProjectWithTasks = async (projectId: string) => {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { tasks: true },
  });
};
```

```ts
// Correct — services/projects/get-project.ts
export const getProject = async (projectId: string): Promise<Project | undefined> => {
  return db.query.projects.findFirst({ where: eq(projects.id, projectId) });
};

// Correct — services/tasks/get-tasks.ts
export const getTasks = async (projectId: string, range: DateRange): Promise<Task[]> => { ... };
```

## Compose at the page, fetch in parallel

A feature component that fetches its own data creates a waterfall: the page awaits the
project, then the child awaits tasks. Both reads only need `projectId`. Fetch both in the RSC
page and pass the child *as a prop*.

```tsx
// app/(dashboard)/projects/[id]/page.tsx
const ProjectPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const [project, tasks] = await Promise.all([getProject(id), getTasks(id, currentMonth())]);

  if (!project) notFound();

  return <ProjectDetail project={project} tasks={<TaskTable tasks={tasks} />} />;
};

export default ProjectPage;
```

```tsx
// <ui-root>/projects/components/project-detail.tsx
interface ProjectDetailProps {
  project: Project;
  tasks: ReactNode;
}

export const ProjectDetail = ({ project, tasks }: ProjectDetailProps) => (
  <section>
    <h1>{project.name}</h1>
    {tasks}
  </section>
);
```

Name the slot for what it holds (`tasks`, `kpi`, `transfers`) rather than using `children`.

Two payoffs beyond the parallel fetch:

- `TaskTable` can be a Client Component (interactive table, URL-state filters) while
  `ProjectDetail` and the page stay Server Components. Without composition, one `"use client"`
  child drags the parent boundary with it.
- A page composed of a server half and a client half needs **both** server revalidation
  (`revalidatePath` / tags) and client-cache invalidation (e.g. `invalidateQueries`) after a
  mutation — server revalidation does nothing to a client query cache.

## Derived figures do NOT get composed page-side

This overrides the rule above, and it is not negotiable.

Single-purpose reads apply to **rows**. They do not apply to **figures**. Any number that
also lands somewhere else — an export, a report, an invoice, a chart — comes from one function
in the figures engine, called by every surface that shows it. Never assemble a figure in the
page out of several feature reads: that is exactly how screen and export drift, and a figure
that disagrees with itself destroys trust in every other figure.

```tsx
// Wrong — page-side arithmetic across features. The export route cannot reuse it.
const [entries, rate] = await Promise.all([getTimeEntries(id, range), getHourlyRate(id)]);
const cost = entries.reduce((h, e) => h + e.hours, 0) * rate;
```

```tsx
// Correct — one function, every caller.
import { getProjectCost } from "@/server/services/<figures-domain>/project-cost";

const breakdown = await getProjectCost(id, range);
```

Chart numbers are figures too: they come from the same engine function as the table beside
them, never a separate query.

## The join escape hatch — and where it lives

Per-feature reads degenerate into N+1 on list pages — many people × many days × several
parents. Fetching a parent's rows once per child is the bug, not the decoupling.

So a joined/aggregated read is allowed when the alternative is N+1 — but it lives in the
services root as one named, deliberate function, never inside a UI feature and never as an
ad-hoc query in a page. Before reaching for it, check whether the page needs that data at all
(lazy pane, drill-in on click) — that is usually the better fix.

## Cross-feature imports

- A page may import from any number of features. That is its job.
- A feature component may import another feature's component only when it is composing it as
  a slot — prefer passing it in from the page.
- A service in `services/a/` must not import `services/b/` to widen its own read. Compose the
  two at the page, or write one deliberate joined read per the section above.
- Shared, feature-agnostic helpers (formatters, URL-state parsers, zod schemas, constants) go
  in the shared helpers binding. Something is only shared once a second feature needs it.

## Language

Follow the identifier-language binding: if the users' domain nouns are non-English, they may
keep that spelling in identifiers (it is what the users say); everything else in code stays
English. User-facing strings follow the product's locale.

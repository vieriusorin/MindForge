---
name: server-client-components
description: How a Server Component and a Client Component look in MindForge, and which state tool each kind of state uses — RSC reads for first render, TanStack Query for client-refetched server data, useMutation over Server Actions for writes, nuqs for URL state, react-hook-form + zod for forms, useState only for ephemeral UI. Worked page → client-island examples, the props-crossing rules, children-as-slots, Suspense placement, and the anti-pattern list. Load before creating any page.tsx, any "use client" file, or before choosing where a piece of state lives.
---

# Server & Client Components — the MindForge shape

Contract: `.claude/rules/state-and-data.md`. Folder layout inside a client component:
`.claude/rules/react-client-patterns.md`. Caching and Suspense under Cache Components:
`nextjs-data`. This skill is the **map**; the library skills are the detail:

| Need | Skill |
|---|---|
| Client-side reads, mutations, cache sync | `client-data-tanstack-query` |
| Forms | `forms-rhf-zod` (+ `ui-shadcn` for the `Field` family) |
| URL state (filters, tabs, pages) | `nuqs-typescript-zod` |

## 1. Decide where the state lives — in this order

```
Does the first render need it?            → RSC read in page.tsx, pass as props.        STOP
Should reload / back / a shared link keep it? → nuqs (search-params.ts).                (and maybe ↓)
Must the client re-fetch it without navigating? → TanStack Query (queries.ts + Route Handler).
Is it a write?                            → Server Action + useMutation in the hook.
Is it form input?                         → react-hook-form + zodResolver (schemas.ts).
Else (open/closed, hover, local step)     → useState in hooks/use-<name>.ts.
```

The first answer that fits wins. Most screens in this app stop at line one: an RSC page that
reads, and presentational components that render. Reach for the client only when the
interaction demands it.

## 2. The Server Component (the page is the container)

Reference: `src/app/(app)/groups/page.tsx`.

```tsx
// src/app/(app)/groups/page.tsx — no "use client", no hooks, no handlers
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CreateGroupForm } from "@/features/groups/components/create-group-form";
import { GroupList } from "@/features/groups/components/group-list";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMyGroups } from "@/server/groups/list-my-groups";
import { listPacks } from "@/server/packs/list-packs";

async function GroupsSlot() {
  const user = await getCurrentUser();                 // auth: per-request, so under Suspense
  if (!user) redirect("/sign-in?next=/groups");
  const [groups, packs] = await Promise.all([          // parallel reads, never a waterfall
    listMyGroups(user.id),
    listPacks(),
  ]);
  const packNames = Object.fromEntries(packs.map((p) => [p.slug, p.name]));
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
      <GroupList groups={groups} packNames={packNames} /> {/* server component: just markup */}
      <CreateGroupForm packs={packs} />                 {/* client island: gets plain DTOs */}
    </div>
  );
}

export default function GroupsPage() {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <h1 className="mb-6 text-4xl">My study groups</h1>  {/* static shell, prerendered */}
      <Suspense fallback={<p className="text-muted-foreground">Loading your groups…</p>}>
        <GroupsSlot />
      </Suspense>
    </div>
  );
}
```

What a Server Component **does**: auth, reads from `src/server/**`, engine calls
(`src/engine/**`), `notFound()` / `redirect()`, composing feature components.
What it **never does**: hooks, event handlers, `"use client"`, arithmetic for displayed
figures (that's the engine's job), or `use cache` on per-user data.

## 3. The Client Component (a leaf island)

Reference: `src/features/groups/components/create-group-form/`.

```
create-group-form/
  index.ts                      export { CreateGroupForm } + types
  create-group-form.tsx         "use client" — markup only, calls the hook
  types.ts                      CreateGroupFormProps
  hooks/use-create-group-form.ts  useForm + useMutation + router — all behaviour
```

```tsx
// create-group-form.tsx — the view. No useState/useEffect/useMemo; everything from the hook.
"use client";
export function CreateGroupForm({ packs }: CreateGroupFormProps) {
  const { control, register, errors, onSubmit, isSubmitting } =
    useCreateGroupForm(packs[0]?.slug ?? "");
  return <form onSubmit={onSubmit} noValidate>{/* Field family … */}</form>;
}
```

```ts
// hooks/use-create-group-form.ts — the behaviour. Explicit Use<Name>Return, no setters.
"use client";
export function useCreateGroupForm(defaultPackSlug: string): UseCreateGroupFormReturn {
  const router = useRouter();
  const form = useForm({ resolver: zodResolver(CreateGroupInput), defaultValues: { … } });
  const mutation = useMutation({ mutationFn: createGroup, onSuccess: … });
  return { control: form.control, register: form.register, errors: form.formState.errors,
           onSubmit: form.handleSubmit((v) => mutation.mutate(v)), isSubmitting: mutation.isPending };
}
```

Read the real files. They pass typecheck, lint and the Stop gate, which the snippets here
can't prove.

## 4. What may cross the boundary

Props from a Server Component into a Client Component are serialised. Allowed:

- plain data (DTOs from `src/server/**` types: `PackOption`, `MyGroup`, …). Dates as ISO
  strings, not `Date` objects (`client-side.md` §1)
- Server Actions (imported in the client file from `actions.ts`, or passed as props)
- **JSX** (`children`, named slots) — including Server Components already rendered
- a `Promise` of serialisable data, unwrapped with `use()` under `<Suspense>`

Never: a Supabase client, functions that aren't Server Actions, class instances, secrets,
raw DB rows with columns the user may not see. Client files never import `src/server/**`
(`server-only` turns that into a build error; don't work around it).

## 5. Composition: keep the client island small

Put `"use client"` on the smallest leaf that needs interactivity. To put server-rendered
content *inside* an interactive shell, pass it as `children` instead of importing it:

```tsx
// page.tsx (server)
<CollapsibleCard title="Your forest">     {/* client: owns open/closed state */}
  <Forest trees={trees} />                 {/* server: rendered on the server, passed in */}
</CollapsibleCard>
```

A Client Component that imports a component turns that component into client code too. Passing
it as a child does not.

## 6. Suspense placement (Cache Components)

| Thing | Needs `<Suspense>` above it |
|---|---|
| `getCurrentUser()`, `cookies()`, any per-user read | yes, in the page |
| `params` / `searchParams` / nuqs `loadX(searchParams)` in an RSC | yes |
| A client component calling `useQueryState(s)` / `useSearchParams` | yes. Dev works without it; **`next build` fails** |
| A client component calling `useSuspenseQuery` | yes, it suspends until data arrives |
| A server prefetch + `<HydrationBoundary>` | yes, prefetch inside the boundary |

The fallback is real UI (a `Skeleton` layout or a muted line), never `null` around the whole
page.

## 7. Anti-patterns → the fix

| Seen in review | Fix |
|---|---|
| `"use client"` on a `page.tsx` / `layout.tsx` | Move interactivity to a leaf; page stays RSC |
| `useEffect(() => { fetch(…).then(setData) }, [])` | RSC read, or `useQuery(xCache.options())` |
| `useState` for a filter, tab or page number | nuqs parser in `search-params.ts` |
| `router.push(\`?status=${s}\`)` | `setParams({ status: s })` from `useQueryStates` |
| `useActionState(action, …)` / `<form action={…}>` for a new form | RHF + `useMutation` (`forms-rhf-zod`) |
| `startTransition(async () => await action())` in a hook | `useMutation({ mutationFn: action })` |
| Server Action used to *read* data for a client list | GET Route Handler + `useQuery` |
| `queryKey: ["groups"]` written inline in a component | `groupsCache.options()` from `queries.ts` |
| Hook returns `setValue` / `setFilter` / `handleSubmit` | expose intent-named callbacks (`onSubmit`, `selectStatus`) |
| Zod schema declared inside `actions.ts` and again in the form | one schema in `schemas.ts`, imported by both |
| Percentage or total computed in a component | engine function in `src/engine/**` |

## Checklist for a new screen

- [ ] `page.tsx` is an RSC; reads in parallel; per-user work under `<Suspense>`.
- [ ] Each piece of state placed by §1. No `useState` holding URL-worthy or server state.
- [ ] Each client component lives in its own folder (`react-client-patterns.md`).
- [ ] Writes are Server Actions returning `ActionResult`, called through `useMutation`.
- [ ] After a write, the screen is synced (`invalidateQueries` and/or `router.refresh()`).
- [ ] UI from installed shadcn components only; tokens only (`ui-design.md`).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (build catches missing Suspense).

# React Client Patterns — P4T

**Normative.** `.claude/skills/react-component-split/SKILL.md` is the how-to with worked
before/after from this repo; this file is the contract it points at. On any conflict, this
file wins. Mechanically enforced by `pnpm gate:component-split`
(`scripts/check-component-split.mjs`) on the paths listed in
`COMPONENT_SPLIT_MIGRATED_PATHS` — a ceiling that only rises.

## Why

UI mixed with client state, action calls and inline interfaces is the shape this repo keeps
regressing to: `identity/components/provision-login-dialog.tsx` reached 984 lines,
`pontaj/.../cell-editor.tsx` 827. The cost is not aesthetic. All 29 co-located module tests
in this repo assert against `utils.ts`; none assert against a component or a hook, and none
can — `@testing-library/react`, `jsdom` and `happy-dom` are deliberately not installed, so
`renderHook` is unavailable. **Logic that stays inside a `.tsx` is logic that cannot be
tested at all.** The split exists to move decisions into a place where they can be asserted.

## The folder

Every client component gets its own folder. The barrel keeps the public import path stable,
which is what makes the whole layout refactorable without touching consumers.

```
src/modules/<feature>/components/<name>/
  index.ts                     barrel — the only public entry
  <name>.tsx                   presentational: markup, no behaviour
  types.ts                     props interfaces for this component AND its children
  utils.ts                     pure functions + zod schemas (only if there are any)
  hooks/use-<name>.ts          client behaviour: state, effects, action calls
  components/                  child presentational pieces, folder-internal, no barrel
  __tests__/utils.test.ts      required wherever utils.ts exists
```

Relative inside the folder (`./types`, `../utils`, `./hooks/use-<name>`); `@/` across
folders. Children import siblings as `./<other-child>` and reach up with `../types`.

## Rules

1. **The presentational `.tsx` holds no behaviour.** No `useState`, `useEffect`, `useMemo`,
   `useCallback`, `useTransition`, `useReducer`, `useOptimistic`. It receives everything it
   needs as props or from its hook.

   Escape, for the genuinely DOM-coupled case only (an audio element, a canvas, a focus
   trap): annotate the file with

   ```ts
   // split-gate: behaviour-in-view -- <reason>
   ```

   The gate counts and prints these, so the escape stays visible rather than silent. It is
   not a way to postpone the split.

2. **No props interface is declared in a `.tsx`.** It lives in `types.ts`, so the hook and
   the view import the same shape rather than drifting.

3. **`utils.ts` only where pure logic exists**, and it must export at least one function. A
   `utils.ts` created to satisfy the layout is a violation, not a formality.

4. **Every `utils.ts` export is imported by `__tests__/utils.test.ts`.** Five exports and one
   test is the failure this rule names. Assert the decision, not the call.

5. **Hooks are named `use-<component-name>.ts`.** Never a generic `useForm` — this repo does
   not install the shadcn `Form` wrapper, so react-hook-form's own `useForm` is imported
   directly in these files and the names collide.

6. **The react-hook-form carve-out, as `check-hook-returns.mjs` (LS-0311) defines it.** A
   `Use<Name>Return` may expose `control`, `register`, `errors`, `onSubmit`, `isSubmitting`
   and derived values — the plumbing the view needs to render at all, given this repo has no
   shadcn `Form` wrapper and zero `useFormContext` calls. Do not wrap those; it destroys RHF's
   type inference.

   `handleSubmit` is **forbidden**, along with `setValue`, `setError`, `reset`, `trigger`,
   `watch`, `formState` and any `set<Foo>`. Those let the view mutate state the hook owns.
   `handleSubmit` is banned specifically so the success path — toast, `router.refresh()`,
   `onSuccess` — stays inside the hook; the hook exposes a wrapped `onSubmit` instead. That
   gate is separate from this one and runs as `pnpm gate:hooks`.

7. **Never extract a hook from a Server Component.** Hooks are illegal there. An RSC keeps
   its auth, reads, gates and `notFound()` in place and yields only markup and types. This is
   the single most common way the refactor goes wrong — check for `"use client"` first.

8. **Split by logic density, not by the `"use client"` directive.** A small presentational
   component with one `useState` is one file plus `types.ts`. Four files for forty lines is
   worse than what it replaced.

9. **Hoist on the second consumer, not the first.** A type or helper used by a second
   component in the same feature moves to `src/modules/<f>/types.ts` or
   `src/modules/<f>/utils/<surface>.ts`. `src/lib/` is for what a second *feature* imports.

## Exemptions

- **`*-lazy.tsx`** — the `next/dynamic` wrappers (LS-0145). All five repo-wide are flat
  siblings of what they wrap, covered by `e2e/flows/lazy-charts.spec.ts`. They hold no state,
  no markup logic and no props interface of their own. Folding one behind a barrel that also
  statically re-exports the heavy recharts component risks undoing the code split — weight
  this repo already lost once to a mistaken revert. They stay flat.
- **`src/components/ui/**`** — shadcn-owned; formatted, not linted, not restructured.
- **Server Components**, including every `src/app/**/page.tsx` container.

#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write) — path-matched rule injection.
 *
 * Replaces the old always-on `.claude/rules/*.md` load (~15k tokens every session)
 * with a ~200-token digest delivered only when a matching file is actually touched.
 * The digest is a reminder plus a pointer; the full rule lives in the paired skill.
 *
 * Never blocks. Any failure exits 0 silently — a broken hook must not stop an edit.
 * Each digest is injected at most once per session (state in the OS temp dir).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** @type {{ id: string, test: RegExp, skill: string, text: string }[]} */
const RULES = [
  {
    id: "rsc-page",
    test: /src\/app\/.*\/(page|layout|template)\.tsx$/,
    skill: "nextjs-data",
    text: `RSC page/layout. Cache Components is ON (\`cacheComponents: true\`).
- Any \`cookies()\` / \`getUser()\` / \`searchParams\` read must sit under a \`<Suspense>\` with a real skeleton — not \`loading.js\` at the route root, not an empty fallback around \`<body>\`.
- NEVER \`export const runtime | dynamic | revalidate | fetchCache\`, \`unstable_cache\`, \`unstable_noStore\`. All blocked under the flag.
- NEVER \`use cache\` on anything role-scoped, PII-bearing, or money-bearing. Nomenclatoare and per-row șantier metadata only.
- The page IS the container: it awaits params, authorizes, runs the parallel reads, and passes components down as \`ReactNode\` slots. No JSX layout beyond the slot call, no \`"use client"\`, no arithmetic on figures.
- Independent reads go in one \`Promise.all\`. \`Promise.allSettled\` only where a partial page is genuinely fine — never for rows feeding a total.`,
  },
  {
    id: "route-handler",
    test: /src\/app\/api\/.*route\.ts$/,
    skill: "nextjs-data",
    text: `Route Handler. GET handlers follow the page prerendering model under Cache Components.
- No \`export const runtime\` — Node.js is the default and route segment config is blocked.
- Export routes SERIALIZE only. Every figure comes from the same \`server/services/cost-engine/\` function the screen calls. Never a "quick" alternative SQL query — screen/export divergence is called trust-destroying in PROJECT.md.
- \`revalidateTag(tag, 'max')\` is callable here; \`updateTag\` is Server-Actions-only.`,
  },
  {
    id: "server-action",
    test: /src\/modules\/.*\/actions\.ts$/,
    skill: "nextjs-data",
    text: `Server Action. Reachable by direct POST — the user never had to see the button.
- Shape: authorize → parse (zod \`.strict()\`) → call a service → invalidate → return. No business logic here.
- \`requireCapability(...)\` / \`getUser()\` inside EVERY action. Never \`getSession()\`.
- Pontaj/transferuri/cereri rows are uncached, so there is no tag to expire: use \`refresh()\` server-side + \`invalidateQueries\` client-side. A \`updateTag('pontaj-…')\` here is a silent no-op that reads like invalidation.
- \`redirect()\` LAST — it throws, so anything after it never runs.
- Thread the audit actor via \`set_config('app.current_user_id', …, true)\` in the same transaction; the AFTER trigger writes the row.`,
  },
  {
    id: "module-component",
    test: /src\/modules\/.*\.tsx$/,
    skill: "react-client-patterns + ui-shadcn",
    text: `Component under modules/. Per-component FOLDER layout:
\`components/<name>/\` → \`index.ts\` (barrel) + \`<name>.tsx\` (markup only) + \`types.ts\` + \`utils.ts\` (pure) + \`hooks/use-<name>.ts\` (behaviour). Child pieces go in a nested \`components/\` subfolder with no barrel.
- Presentational file holds NO data reads, NO \`getUser()\`, NO role derivation. If it fetches or authorizes it is in the wrong layer.
- Any \`useForm\`, 2+ \`useState\`, an effect, a \`useQuery\`/\`useMutation\`, or an async submit → move to the hook. Hook returns derived values, never \`setValue\`/\`reset\`/\`watch\`/\`handleSubmit\`/raw \`formState\`. (\`control\`, \`register\`, \`errors\`, \`onSubmit\`, \`isSubmitting\` ARE sanctioned — that is the RHF seam.)
- Forms: the shadcn \`Form\` wrapper does NOT exist here. \`FormField\`/\`FormProvider\`/\`useFormContext\` will not compile. Use the \`Field\` family: \`<Field data-invalid={Boolean(errors.x)}>\`, \`<FieldLabel htmlFor="x">\` with a matching \`id\` on the control (manual — nothing wires it for you), \`<FieldError errors={errors.x ? [errors.x] : undefined} />\`.
- No \`*-container.tsx\`. UI strings come from the typed i18n dictionaries (\`ro.ts\` is the source, \`en.ts\` mirrors it; \`getT()\` in RSC, \`useT()\` in client), never a hardcoded literal. English code. New components via \`pnpm dlx shadcn@latest add\`, never hand-copied.`,
  },
  {
    id: "db-schema",
    test: /(src\/server\/db\/|drizzle\/.*\.sql$|supabase\/.*\.sql$)/,
    skill: "ticket-traceability + supabase-postgres-best-practices",
    text: `HIGH-RISK TIER (schema / RLS / migrations). Ticket-invariant applies: PT-#### id (LS-#### is the legacy series), linked requirements, automated tests, reviewer checkpoint, and an evidence bundle at \`.planning/evidence/PT-####.md\`.
- NEVER \`drizzle-kit push\` — it does not reliably apply \`pgPolicy\` / \`.enableRLS()\`. \`pnpm drizzle-kit generate\` → review the SQL → \`pnpm drizzle-kit migrate\`.
- Temporal tables (\`santier_allocations\`, \`vehicle_allocations\`, \`vehicle_documents\`, \`tool_transfers\`) are append-only or closed-not-deleted. History is a \`valid_from/valid_to\` query, never an audit-log replay.
- \`audit_log\` is for the actor/timestamp/old/new/**reason** trail only, written by a Postgres AFTER trigger.
- RLS is row-level: column hiding (\`tarif_orar\`, \`personal_email\`, \`emergency_contact\`) is DTO mapping in \`server/authz/dto.ts\`.
- Duplicate/overlapping pontaj needs a DB exclusion constraint, not just app-code checks.`,
  },
  {
    id: "authz",
    test: /src\/server\/authz\//,
    skill: "ticket-traceability",
    text: `HIGH-RISK TIER (authz). Acceptance criteria live in \`.planning/input/RBAC-MATRIX.md\` — check against it, do not infer.
- \`getUser()\` never \`getSession()\`.
- Column-level restriction is DTO field-stripping here; RLS cannot do it.
- Covered by \`pnpm test:authz\`. SQL-level RLS coverage stays distinct from Playwright, which only proves what the UI shows.`,
  },
  {
    id: "service-read",
    test: /src\/server\/services\/(?!cost-engine)/,
    skill: "react-feature-architecture",
    text: `Service layer. One single-purpose read per domain noun — \`getSantier\`, not \`getSantierWithPontaj\`. No permutations of nested relations.
- A service in \`services/a/\` must not import \`services/b/\` to widen its read. Compose at the page, or write one deliberate joined read (allowed only where the alternative is N+1).
- Any figure that also lands in an export — salarii, diurnă, cazare, cost/km, casare totals — belongs in \`server/services/cost-engine/\`, NOT in a \`utils/\` helper here. A "small helper" that recomputes part of a figure is exactly how screen and export drift.
- Keep Drizzle queries thin (return rows); arithmetic and business branching go in TS.
- \`getServiceDb()\` is confined to the identity module's Supabase Auth Admin surface. Adding a caller requires a PROJECT.md Key Decisions entry and passes \`pnpm gate:service-role\`.`,
  },
  {
    id: "cost-engine",
    test: /src\/server\/services\/cost-engine\//,
    skill: "react-feature-architecture",
    text: `COST ENGINE — calculation parity invariant. One function per figure, called by BOTH the RSC page and \`app/api/export/[report]\`.
- The export route serializes; it never recalculates.
- Chart numbers are figures too: same function as the table beside them, never a separate query.
- Do not cache these (role-gated, money-bearing) — stream under \`<Suspense>\` instead.
- Diurnă eligibility is per-șantier (flag + configurable rate). Never hardcode "Iași = no diurnă".
- New figure appearing in both a screen and an export → extend \`rapoarte/__tests__/estimativ-plata-cost-parity.test.ts\`.`,
  },
  {
    id: "tests",
    test: /__tests__\/.*\.test\.tsx?$|^e2e\/|\/e2e\//,
    skill: "testing-strategy",
    text: `Test file. Vitest + Playwright are installed and in active use (~750 Vitest files).
- Mock at the façade, not deeper — \`get-current-identity.test.ts\` is the reference (mocks \`getAuthUser\`, runs the rest against the real local DB).
- DB-backed suites run ONLY via \`pnpm test <paths>\` (the test stack, \`.env.test.local\`); bare \`vitest run\` hits the prod-clone \`.env.local\`. Fixtures come from \`pnpm db:test:seed\`, never \`db:seed\`.
- No snapshot tests. Assert what a caller observes; expected values come from the requirement, never from calling the code under test.
- React Testing Library and msw are NOT installed — propose before adding.
- A test listed in a ticket's \`FROZEN.json\` is the contract: never edit it to go green (the guard hook asks the user).
- Gate: \`pnpm typecheck && pnpm test && pnpm lint:all\` and every \`gate:*\` from package.json. The Stop gate runs the fast half for you.`,
  },
];

const FOOTER = (skill) => `\n(Full rule: \`${skill}\` skill — load it if you need the detail.)`;

function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    return;
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath.length === 0) return;

  const matched = RULES.filter((r) => r.test.test(filePath));
  if (matched.length === 0) return;

  // Per-session dedupe: a digest is worth ~200 tokens once, not on every edit.
  const sessionId = String(input?.session_id ?? "no-session").replace(/[^\w-]/g, "");
  const stateDir = join(tmpdir(), "claude-p4t-rule-hook");
  const statePath = join(stateDir, `${sessionId}.json`);

  /** @type {string[]} */
  let seen = [];
  try {
    if (existsSync(statePath)) seen = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    seen = [];
  }

  const fresh = matched.filter((r) => !seen.includes(r.id));
  if (fresh.length === 0) return;

  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(statePath, JSON.stringify([...seen, ...fresh.map((r) => r.id)]));
  } catch {
    // Dedupe is an optimization; proceed without it rather than dropping the injection.
  }

  const additionalContext = fresh.map((r) => `${r.text}${FOOTER(r.skill)}`).join("\n\n---\n\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: `P4T rules for \`${filePath}\`:\n\n${additionalContext}`,
      },
      suppressOutput: true,
    }),
  );
}

try {
  main();
} catch {
  // Never block an edit because the reminder hook failed.
}
process.exit(0);

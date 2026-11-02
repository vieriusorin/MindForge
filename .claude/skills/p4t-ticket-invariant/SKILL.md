---
name: p4t-ticket-invariant
description: P4T ticket traceability rules: every behavior/schema/security/user-facing change carries an LS-#### ticket ID joining requirement to plan to commit to evidence; the three risk tiers (Spike needs nothing, Normal needs ticket plus acceptance criteria plus a verify: command, High-risk adds tests, reviewer checkpoint and an evidence bundle); PLAN.md frontmatter contract; the three coverage gates; and the .planning/evidence/LS-####.md format. High-risk here means server/db/schema/, server/authz/, Supabase auth wiring, or anything touching the RBAC matrix. Load when starting a non-trivial task, writing a plan, or deciding what proof a change needs.
---

# Ticket Invariant — Traceability Across the Agent Chain

Every task that changes production behavior, schema, security, or a user-facing
flow MUST carry a stable **ticket ID**. The ticket ID is the join key that links
requirement → plan → commit → test → verification, so humans and agents can
answer: *which requirement did this change satisfy, what proves it, what is still
unverified.*

This rule extends GSD — it does not replace it. Requirement IDs in
`.planning/REQUIREMENTS.md` (e.g. `API-01`, `MIG-04`) stay canonical. Ticket IDs
are **execution** IDs that link back to those requirements.

## Ticket ID format

Reuse the existing commit-tag scheme: `LS-####` (already used in git history —
`LS-0001`, `LS-0002`). One ticket per atomic deliverable. The same ID appears in:

- the PLAN.md frontmatter (`ticket_id`)
- the commit message trailer (`LS-####`)
- the evidence file name (`.planning/evidence/LS-####.md`)

## Risk tiers — scale ceremony with risk

Do **not** force the full bundle on every task. Match the tier to the change.

| Tier | Applies to | Required |
|------|-----------|----------|
| **Spike** | prototypes, one-off scripts, throwaway exploration, single-file chores | Nothing. Optional requirement note + summary. No ticket. |
| **Normal** | new feature, enhancement, non-trivial bugfix | `ticket_id` + acceptance criteria + at least one `verify:` command |
| **High-risk** | auth, payments, RBAC, DB schema/migrations, infra, public API contract, user-facing flows | `ticket_id` + linked `requirements` + automated tests + reviewer checkpoint + evidence bundle |

High-risk maps directly to existing project boundaries: anything touching
`apps/api/src/db/schema/`, RBAC (`apps/web/lib/rbac/`), auth (`lib/auth/`),
NestJS guards, or the OpenAPI contract is **always** high-risk.

## Plan contract (PLAN.md frontmatter)

GSD plan frontmatter already carries `requirements:` and `must_haves`. Add two
fields for Normal and High-risk tiers:

```yaml
---
phase: 08-feature-x
plan: 01
ticket_id: LS-0042            # NEW — required for Normal + High-risk
requirements:                  # existing — link back to canonical reqs
  - API-07
  - MIG-04
verify:                        # NEW — machine-runnable proof commands
  - pnpm typecheck
  - pnpm vitest run --filter feature-x
  - pnpm --filter @lexiscore/web test:e2e feature-x.spec.ts
evidence: .planning/evidence/LS-0042.md   # NEW — where proof output lands
must_haves:                    # existing — truths / artifacts / key_links
  truths: [...]
---
```

`verify:` commands MUST be runnable by an agent with no human input and MUST
return a non-zero exit code on failure. No interactive flags (`-i`), no watch
mode.

## Three coverage gates — a task is NOT complete unless all pass

A secondary agent (`gsd-verifier` / the `/feature-loop` judge) checks three
things. Missing any one = task incomplete, regardless of code being written.

1. **Requirement coverage** — every `requirement` ID in the plan maps to a real
   ID in `.planning/REQUIREMENTS.md`. No orphan tickets.
2. **Test-evidence coverage** — every acceptance criterion is referenced by at
   least one `verify:` command or an explicit, recorded manual verification step.
   (This is what `gsd-nyquist-auditor` already enforces — reuse it.)
3. **Reviewer sign-off coverage** — High-risk tickets carry a reviewer status:
   `pending | passed | failed | waived`. `waived` requires a one-line reason in
   the evidence file.

## Evidence bundle (.planning/evidence/LS-####.md)

For Normal and High-risk tickets, the evidence file records proof:

```markdown
# LS-0042 — Add audit trail for admin role changes

Requirements: API-07, MIG-04
Tier: high-risk

## Acceptance criteria → evidence
- [x] Admin role changes persisted → vitest `audit-role-change` (12 passing)
- [x] Audit event has actor/target/timestamp → e2e `admin-audit.spec.ts`
- [x] Unauthorized users get 403 → vitest RolesGuard spec

## Verify output
$ pnpm typecheck            → 0 errors
$ pnpm vitest run audit     → 12 passed
$ pnpm test:e2e admin-audit → 3 passed

## Files touched
apps/api/src/admin/*, apps/web/app/admin/audit/*

## Reviewer
status: passed (security + a11y)
residual risk: none
```

## Hard rules

- No ticket → no merge for Normal/High-risk work.
- No ticket is complete unless its linked requirements exist in REQUIREMENTS.md.
- No requirement is "delivered" unless ≥1 `verify:` command or recorded manual
  step references it.
- No High-risk AI-generated change is trusted until evidence + reviewer sign-off
  are attached.
- Commit message carries the `LS-####` trailer (manual commit per
  `.claude/rules/no-commit.md` — agents never commit).

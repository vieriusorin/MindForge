---
name: ticket-traceability
description: Ticket traceability rules — every behavior/schema/security/user-facing change carries a <PREFIX>-#### ticket ID joining requirement to plan to commit to evidence; three risk tiers (Spike needs nothing, Normal needs ticket plus acceptance criteria plus a verify: command, High-risk adds tests, reviewer checkpoint and an evidence bundle); the PLAN.md frontmatter contract; the three coverage gates; and the evidence file format. High-risk = schema/migrations, authz/RBAC, auth wiring, payments, infra, public API contracts. Load when starting a non-trivial task, writing a plan, or deciding what proof a change needs.
---

# Ticket Traceability Across the Agent Chain

Every task that changes production behavior, schema, security or a user-facing flow MUST carry a
stable **ticket ID**. The ID is the join key linking requirement → plan → commit → test →
verification. With it, humans and agents can answer: *which requirement did this change satisfy,
what proves it, and what is still unverified?*

Requirement IDs (e.g. `API-01`, `MIG-04` in the requirements file) stay canonical. Ticket IDs are
**execution** IDs that link back to them.

## Project bindings

| Binding | What to look for | Default if absent |
|---|---|---|
| ID prefix | Ticket tags in `git log`, `CLAUDE.md`, existing evidence files | `TK-####` |
| Requirements file | `.planning/REQUIREMENTS.md` or an equivalent spec | Create `.planning/REQUIREMENTS.md` |
| Evidence dir | Existing evidence bundles | `.planning/evidence/` |
| High-risk paths | Schema/migration dirs, authz/RBAC modules, auth wiring, payment code, infra, the public API contract | Those categories, wherever they live |
| Verifier agent | The project's judge/verifier agent | A fresh-context subagent |

Reuse an existing commit-tag scheme if the history has one. One ticket per atomic deliverable.
The same ID appears in:

- the PLAN.md frontmatter (`ticket_id`)
- the commit message trailer
- the evidence file name (`<evidence-dir>/<ID>.md`)

## Risk tiers: scale ceremony with risk

Do **not** force the full bundle on every task. Match the tier to the change.

| Tier | Applies to | Required |
|------|-----------|----------|
| **Spike** | prototypes, one-off scripts, throwaway exploration, single-file chores | Nothing. Optional requirement note + summary. No ticket. |
| **Normal** | new feature, enhancement, non-trivial bugfix | `ticket_id` + acceptance criteria + at least one `verify:` command |
| **High-risk** | auth, payments, RBAC, DB schema/migrations, infra, public API contract, user-facing flows | `ticket_id` + linked `requirements` + automated tests + reviewer checkpoint + evidence bundle |

Anything under the high-risk paths in the bindings is **always** high-risk, whatever the size of the diff.

## Plan contract (PLAN.md frontmatter)

```yaml
---
plan: 01
ticket_id: TK-0042             # required for Normal + High-risk
requirements:                  # link back to canonical reqs
  - API-07
  - MIG-04
verify:                        # machine-runnable proof commands
  - <pm> typecheck
  - <pm> test feature-x
  - <pm> test:e2e feature-x.spec.ts
evidence: .planning/evidence/TK-0042.md   # where proof output lands
must_haves:
  truths: [...]
---
```

An agent must be able to run every `verify:` command with no human input, and the command must
exit non-zero on failure. No interactive flags (`-i`), no watch mode.

## Three coverage gates: a task is NOT complete unless all pass

A secondary agent (the verifier or the `/feature-loop` judge) checks three things. If any one is
missing, the task is incomplete, however much code was written.

1. **Requirement coverage**: every `requirement` ID in the plan maps to a real ID in the
   requirements file. No orphan tickets.
2. **Test-evidence coverage**: every acceptance criterion is referenced by at least one `verify:`
   command or an explicit, recorded manual verification step.
3. **Reviewer sign-off coverage**: High-risk tickets carry a reviewer status of
   `pending | passed | failed | waived`. `waived` needs a one-line reason in the evidence file.

## Evidence bundle (`<evidence-dir>/<ID>.md`)

```markdown
# TK-0042 — Add audit trail for admin role changes

Requirements: API-07, MIG-04
Tier: high-risk

## Acceptance criteria → evidence
- [x] Admin role changes persisted → unit `audit-role-change` (12 passing)
- [x] Audit event has actor/target/timestamp → e2e `admin-audit.spec.ts`
- [x] Unauthorized users get 403 → unit guard spec

## Verify output
$ <pm> typecheck            → 0 errors
$ <pm> test audit           → 12 passed
$ <pm> test:e2e admin-audit → 3 passed

## Files touched
<paths>

## Reviewer
status: passed (security + a11y)
residual risk: none
```

## Hard rules

- No ticket → no merge for Normal/High-risk work.
- No ticket is complete unless its linked requirements exist in the requirements file.
- No requirement is "delivered" unless at least one `verify:` command or recorded manual step
  references it.
- No High-risk AI-generated change is trusted until evidence and reviewer sign-off are attached.
- The commit message carries the ticket trailer. If the project has a no-commit rule, agents
  never commit; the developer does.

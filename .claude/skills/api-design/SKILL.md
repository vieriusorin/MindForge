---
name: api-design
description: Response shape, status codes, and pagination conventions for P4T's Route Handlers. Use when touching app/api/cron/notifications or app/api/export/[report], or when designing a paginated/filterable list read.
---

# API Design — P4T

> **Provenance.** Sections grounded in a planning doc cite it. Anything tagged
> **(proposed)** is this file's own suggestion, *not* logged in
> `.planning/PROJECT.md` → Key Decisions — treat it as a starting point to confirm, not
> a decision. The status-code-for-invisible-rows question in particular is downstream of
> the unresolved **Phase 0 RLS-vs-app-layer** boundary decision (CLAUDE.md
> §"Open decision"): under RLS-as-boundary the row simply isn't returned and 404 falls
> out for free; under app-layer-as-boundary someone has to choose. Do not treat this file
> as having chosen.

**Scope warning.** P4T has exactly two legitimate Route Handlers:

- `src/app/api/cron/notifications/route.ts` — called by `pg_cron`, derives alerts
- `src/app/api/export/[report]/route.ts` — serializes an already-computed report

Everything else — every create, update, transfer, pontaj mutation — is a **Server
Action** in `src/modules/<feature>/actions.ts`. Do not add REST CRUD endpoints, do not
add `/api/v1/` versioning, do not build a public API surface. See CLAUDE.md §Architecture
and `.claude/rules/react-feature-architecture.md`.

This file therefore covers only: the response/error shape both handlers use, status
codes, and the pagination conventions a filterable read follows (whether it is reached
by a Server Component or by TanStack Query).

## Route Handler rules

```typescript
// Both handlers need this — exceljs and @react-pdf/renderer are not Edge-compatible.
export const runtime = "nodejs";
```

**The export handler never recalculates.** It calls the same
`server/services/cost-engine/` function the on-screen page calls, then serializes.
No alternative SQL, no "quick" recompute, no rounding of its own. Screen/export
divergence is called trust-destroying in `.planning/PROJECT.md`.

```typescript
// src/app/api/export/[report]/route.ts
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const { report } = await params;
  // 1. auth — getUser(), never getSession()
  // 2. authz — capability check + DTO strip (tarif_orar / PII by role)
  // 3. figures — the SAME cost-engine function the page uses
  // 4. serialize only
}
```

**The cron handler is the one place `getServiceDb()` is legitimate** (the other is the
admin-invite flow). It authenticates the caller with a **shared secret header, distinct
from any user session** — `ARCHITECTURE.md` §366 and §441 — since it runs with elevated
privileges. Dedupe via the UNIQUE constraint on
`(user_id, alert_type, subject_id, period_bucket)` + `ON CONFLICT DO NOTHING`, never an
application-side existence check.

## Status codes

```
200 OK                    — successful read
201 Created               — created (include Location header)
204 No Content            — accepted, nothing to return

400 Bad Request           — malformed JSON, missing required param
401 Unauthorized          — no valid session (getUser() returned nothing)
403 Forbidden             — authenticated but capability check failed
404 Not Found             — resource absent, or present but invisible to this role
409 Conflict              — state conflict (e.g. overlapping pontaj, transfer already accepted)
422 Unprocessable Entity  — valid JSON, failed zod validation
500 Internal Server Error — unexpected; never expose details
```

Two P4T-specific notes:

- **Denied *page* routes do not use either code.** Decision **D-21**
  (`.planning/phases/P4T-01-…/01-CONTEXT.md`): a denied route **redirects to
  `/dashboard`** with no explanation, and the denial is logged server-side. A Romanian
  403 page was rejected (confirms the route exists to a prober) and so was a 404 (hides
  real routing bugs). That is settled — do not add a 403 or 404 page.
- **What a *Route Handler* returns for a row the caller may not see is open (proposed).**
  D-21 covers page navigation, not JSON. The two candidates pull opposite ways: 404 leaks
  less, 403 keeps genuine bugs visible — which is exactly the reason D-21 rejected 404 for
  pages. Resolve alongside the Phase 0 RLS decision and log it; until then, follow whatever
  the export/cron handlers already do and flag the choice in review.
- **409 for the domain conflicts (proposed)**, not 400: duplicate/overlapping pontaj
  (enforced by a DB exclusion constraint per `PITFALLS.md`, so catch the constraint
  violation rather than pre-checking), and a `tool_transfers` state-machine transition
  that is no longer valid. The constraint-not-app-check part is sourced; the specific
  status code is this file's suggestion.

### Anti-patterns

```jsonc
// BAD — 200 for everything, status duplicated in the body
{ "status": 200, "success": false, "error": "Not found" }

// GOOD — HTTP status carries the outcome
// HTTP/1.1 404 Not Found
{ "error": { "code": "not_found", "message": "Șantierul nu a fost găsit" } }
```

`500` for a validation failure, and `200` for a created resource, are both bugs.

## Response shape — (proposed)

No planning doc specifies a response envelope. The shapes below are a consistent default,
not a decision; if the first real handler does something else, change this file to match it
rather than the reverse.

Success:

```json
{ "data": { "id": "abc-123", "nume": "Șantier Copou" } }
```

Collection with pagination:

```json
{
  "data": [{ "id": "abc-123" }, { "id": "def-456" }],
  "meta": { "total": 142, "page": 1, "perPage": 20, "totalPages": 8 }
}
```

Error:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Datele trimise nu sunt valide",
    "details": [
      { "field": "ore", "message": "Trebuie între 0 și 24", "code": "out_of_range" }
    ]
  }
}
```

```typescript
// src/lib/api-response.ts
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface FieldError {
  field: string;
  message: string;
  code: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: FieldError[] };
}
```

`message` is Romanian — it is user-facing. `code` and `field` are English machine keys.
This follows CLAUDE.md §Language (UI strings ro-RO, code identifiers English). The
`camelCase`-not-`snake_case` JSON convention is **(proposed)** — consistent with the TS
side, but not written down anywhere yet.

`details` comes from zod. Map it explicitly rather than dumping `error.issues` —
a raw dump can leak schema internals:

```typescript
const parsed = Schema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json<ApiError>(
    {
      error: {
        code: "validation_error",
        message: "Datele trimise nu sunt valide",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
      },
    },
    { status: 422 },
  );
}
```

## Pagination and filtering

Offset pagination is the default **(proposed)**. Grounding: `PROJECT.md` §Scale and
`REQUIREMENTS.md` O-5 record tens of employees, a handful of parallel șantiere, 3 vehicles
— "pagination and bulk pontaj required, no extreme-scale engineering" — and `PLAT-02`
mandates shadcn `Table` + TanStack Table for every paginated table. Offset follows from
that; the docs do not name it explicitly.

```
?page=2&perPage=20
?sort=-data,angajat        // - prefix = descending, comma-separated
?santierId=abc&status=activ
?dataFrom=2026-06-01&dataTo=2026-06-30
```

Cursor pagination is only worth it if a list genuinely exceeds ~10K rows and is scrolled
rather than paged. Do not pre-emptively build it.

Query params are parsed with **nuqs parsers** shared between the URL and the read, so the
same shape is used client- and server-side. Put the parsers in `src/lib/` — one
definition, imported by the page, the client table, and the export handler, so a filtered
export matches the filtered screen. See the `nuqs-typescript-zod` skill.

**Never accept a client-supplied field list** (`?fields=id,tarif_orar`). Which columns a
role may see is decided server-side in `server/authz/dto.ts` — a client-driven projection
is an authz bypass.

Sort keys must be validated against an allow-list of column names before reaching
Drizzle. An interpolated sort key is SQL injection.

## Checklist

Before shipping a Route Handler change:

- [ ] This genuinely belongs in a Route Handler, not a Server Action
- [ ] `export const runtime = "nodejs"` present
- [ ] Auth via `supabase.auth.getUser()` — never `getSession()`
- [ ] Capability check + DTO field-stripping applied (`tarif_orar`, PII)
- [ ] Figures come from the cost-engine function the screen uses — no recalculation
- [ ] Input validated with zod; `details` mapped explicitly, not dumped
- [ ] Sort/filter keys validated against an allow-list
- [ ] Denied page routes redirect to `/dashboard` + server-side log (D-21) — no 403/404 page
- [ ] Status code for an invisible row is a conscious choice, flagged in review (still open)
- [ ] Domain conflicts caught as DB constraint violations, not pre-checked
- [ ] Error body leaks no stack trace, SQL, or schema internals
- [ ] Romanian `message`, English `code`, `camelCase` keys
- [ ] `getServiceDb()` used only in the cron handler or admin-invite flow

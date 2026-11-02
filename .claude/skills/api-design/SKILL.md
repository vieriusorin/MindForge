---
name: api-design
description: Response shape, status codes, error envelope, and pagination/filtering conventions for Next.js Route Handlers in an app where mutations are Server Actions. Use when designing or editing a Route Handler (route.ts) — export, cron/webhook, or any JSON endpoint — or when designing a paginated/filterable list read.
---

# API Design — Route Handlers in a Server-Actions app

> **Provenance.** Anything tagged **(proposed)** is this file's default, not a project
> decision. If the project has recorded a different choice (CLAUDE.md, ADRs, decisions log),
> the project wins — update this file's bindings, not the code. The status code for rows the
> caller may not see is downstream of the project's authorization boundary (DB-level RLS vs
> app-layer checks): under RLS the row simply isn't returned and 404 falls out for free; under
> app-layer checks someone has to choose. Don't treat this file as having chosen.

## Project bindings

Resolve from `package.json`, `CLAUDE.md`/`AGENTS.md` and the codebase before writing code.

| Binding | What to look for | Default if absent |
|---|---|---|
| Legitimate Route Handlers | the list of `app/api/**/route.ts` the project allows | export + scheduled job/webhook only |
| Action files | where Server Actions live | `src/modules/<feature>/actions.ts` |
| Auth read | server-verified user read | `getUser()`, never a cookie-only `getSession()` |
| Capability check + DTO strip | authz helper and field-stripping layer | `requireCapability` + `server/authz/dto.ts` |
| Elevated DB client | service-role / admin client | `getServiceDb()` — allowed only where listed |
| Calculation engine | single owner of derived figures | `server/services/<calc>/` |
| Denied-route policy | what a denied *page* does (redirect / 403 / 404) | ask — it is a product decision |
| UI language | language of user-facing `message` strings | English |
| JSON key casing | camelCase vs snake_case | camelCase **(proposed)** |
| URL param parsers | shared nuqs/zod parsers location | `src/lib/` |

**Scope warning.** In a Server-Actions app, Route Handlers are the exception. Typical
legitimate ones: an **export** endpoint that serializes an already-computed report, and a
**scheduled job / webhook** endpoint called by a machine. Every create, update, transfer or
state change is a **Server Action**. Do not add REST CRUD endpoints, `/api/v1/` versioning,
or a public API surface unless the project explicitly wants one (see the
`react-feature-architecture` skill).

This file covers: the response/error shape, status codes, and pagination conventions for a
filterable read (whether reached by a Server Component or a client query library).

## Route Handler rules

**Runtime.** Export handlers using Node-only libraries (exceljs, `@react-pdf/renderer`) must run
on Node.js. Under `cacheComponents: true` that is the default and `export const runtime` is
blocked — omit it (see `nextjs-data`). On the previous model, set `export const runtime = "nodejs"`.

**The export handler never recalculates.** It calls the same calculation-engine function the
on-screen page calls, then serializes. No alternative SQL, no "quick" recompute, no rounding of
its own. A screen and an export that disagree destroy trust.

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const { report } = await params;
  // 1. auth — server-verified user read, never a cookie-only session
  // 2. authz — capability check + DTO strip (PII / financial fields by role)
  // 3. figures — the SAME engine function the page uses
  // 4. serialize only
}
```

**A machine-called handler (cron, webhook) is where an elevated DB client may be legitimate.**
It authenticates the caller with a **shared secret header (or signature), distinct from any user
session**, since it runs with elevated privileges. Make it idempotent: dedupe via a UNIQUE
constraint on the natural key (e.g. `(user_id, kind, subject_id, period_bucket)`) +
`ON CONFLICT DO NOTHING`, never an application-side existence check (it races).

## Status codes

```
200 OK                    — successful read
201 Created               — created (include Location header)
204 No Content            — accepted, nothing to return

400 Bad Request           — malformed JSON, missing required param
401 Unauthorized          — no valid session (auth read returned nothing)
403 Forbidden             — authenticated but capability check failed
404 Not Found             — resource absent, or present but invisible to this role
409 Conflict              — state conflict (overlapping record, transition no longer valid)
422 Unprocessable Entity  — valid JSON, failed zod validation
500 Internal Server Error — unexpected; never expose details
```

Notes:

- **Denied *page* routes follow the project's denied-route policy**, not this table. A common
  choice is redirect-to-home with a server-side log: a 403 page confirms the route exists to a
  prober, a 404 hides real routing bugs. Once the project decides, don't add a competing page.
- **What a *Route Handler* returns for a row the caller may not see is a decision (proposed:
  follow the existing handlers).** 404 leaks less, 403 keeps genuine bugs visible. Resolve it
  alongside the authorization-boundary decision, log it, and flag the choice in review.
- **409 for domain conflicts (proposed)**, not 400: duplicate/overlapping records and
  state-machine transitions that are no longer valid. Enforce uniqueness/overlap with a DB
  constraint and catch the violation — don't pre-check in the app (it races).

### Anti-patterns

```jsonc
// BAD — 200 for everything, status duplicated in the body
{ "status": 200, "success": false, "error": "Not found" }

// GOOD — HTTP status carries the outcome
// HTTP/1.1 404 Not Found
{ "error": { "code": "not_found", "message": "Project not found" } }
```

`500` for a validation failure, and `200` for a created resource, are both bugs.

## Response shape — (proposed)

A consistent default, not a decision; if the first real handler does something else, change
this file to match it rather than the reverse.

```json
{ "data": { "id": "abc-123", "name": "Example" } }
```

```json
{
  "data": [{ "id": "abc-123" }, { "id": "def-456" }],
  "meta": { "total": 142, "page": 1, "perPage": 20, "totalPages": 8 }
}
```

```json
{
  "error": {
    "code": "validation_error",
    "message": "The submitted data is not valid",
    "details": [{ "field": "hours", "message": "Must be between 0 and 24", "code": "out_of_range" }]
  }
}
```

```typescript
export interface ApiResponse<T> { data: T; meta?: PaginationMeta }
export interface FieldError { field: string; message: string; code: string }
export interface ApiError { error: { code: string; message: string; details?: FieldError[] } }
```

`message` is user-facing, in the UI language. `code` and `field` are English machine keys.

`details` comes from zod. Map it explicitly rather than dumping `error.issues` — a raw dump can
leak schema internals:

```typescript
const parsed = Schema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json<ApiError>(
    {
      error: {
        code: "validation_error",
        message: "The submitted data is not valid",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."), message: i.message, code: i.code,
        })),
      },
    },
    { status: 422 },
  );
}
```

## Pagination and filtering

Offset pagination is the default **(proposed)** for small-to-medium business data (hundreds to
low thousands of rows per list, paged tables). Check the project's stated scale first.

```
?page=2&perPage=20
?sort=-date,name           // - prefix = descending, comma-separated
?projectId=abc&status=active
?dateFrom=2026-06-01&dateTo=2026-06-30
```

Cursor pagination is only worth it if a list genuinely exceeds ~10K rows and is scrolled rather
than paged. Do not pre-emptively build it.

Parse query params with **shared parsers** (nuqs + zod) used by the URL and the read, so the
same shape applies client- and server-side. One definition, imported by the page, the client
table and the export handler — so a filtered export matches the filtered screen. See the
`nuqs-typescript-zod` skill.

**Never accept a client-supplied field list** (`?fields=id,salary`). Which columns a role may
see is decided server-side in the DTO layer — a client-driven projection is an authz bypass.

Sort keys must be validated against an allow-list of column names before reaching the query
builder. An interpolated sort key is SQL injection.

## Checklist

Before shipping a Route Handler change:

- [ ] This genuinely belongs in a Route Handler, not a Server Action
- [ ] Runtime correct for its libraries (and no `export const runtime` under Cache Components)
- [ ] Auth via the server-verified user read — never a cookie-only session
- [ ] Capability check + DTO field-stripping applied (PII, financial fields)
- [ ] Figures come from the engine function the screen uses — no recalculation
- [ ] Input validated with zod; `details` mapped explicitly, not dumped
- [ ] Sort/filter keys validated against an allow-list
- [ ] Denied page routes follow the project's policy — no competing 403/404 page
- [ ] Status code for an invisible row is a conscious choice, flagged in review
- [ ] Domain conflicts caught as DB constraint violations, not pre-checked
- [ ] Machine-called handlers authenticate with a secret/signature and are idempotent
- [ ] Error body leaks no stack trace, SQL, or schema internals
- [ ] `message` in the UI language, English `code`, consistent key casing
- [ ] Elevated DB client used only in the handlers the project allows

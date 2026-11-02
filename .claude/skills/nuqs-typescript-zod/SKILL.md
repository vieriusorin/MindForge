---
name: nuqs-typescript-zod
description: Master type-safe URL query parameters in Next.js using Nuqs and Zod validation. Use when implementing URL-based state management for filters, pagination, search, tabs, or any UI state that should persist in the URL. Triggers on tasks involving URL query params, filter synchronization, or Next.js state management.
allowed-tools: [Read, Write, Edit, Bash]
---

# Nuqs with TypeScript and Zod Validation

Nuqs (Next.js URL Query Strings) provides type-safe URL query parameter management in Next.js applications. By integrating with Zod schemas, you can validate, serialize, and deserialize parameters automatically, ensuring your application state remains consistent with the URL.

## When to Use This Skill

- Implementing filters that persist in URL (e.g., status filters, search queries)
- Creating paginated lists with URL state
- Building tabs/mode switchers that sync with URLs
- Managing complex form state in URLs
- Server-side rendering with URL-based initial state
- Type-safe query parameter handling across client and server

## Installation & Setup

### 1. Install Nuqs

```bash
<pm> add nuqs
```

> Use the project's package manager. Re-verify the installed major against the docs at implementation
> start (`npm view nuqs version`) — this skill's patterns assume nuqs v2 + zod 4.

### 2. Configure NuqsAdapter

Wrap your application with `NuqsAdapter` to enable Nuqs functionality:

```typescript
// src/components/providers.tsx
"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PreferencesProvider } from "@/contexts/PreferencesContext";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <NuqsAdapter>
      <PreferencesProvider>{children}</PreferencesProvider>
    </NuqsAdapter>
  );
};
```

## Core Patterns

### 1. Built-in Parsers (Simple Cases)

For basic types, use Nuqs built-in parsers:

```typescript
import { parseAsString, parseAsInteger, parseAsBoolean } from "nuqs";
import { useQueryState } from "nuqs";

export function SearchBar() {
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [active, setActive] = useQueryState("active", parseAsBoolean.withDefault(false));

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

**Available built-in parsers:**
- `parseAsString`
- `parseAsInteger`
- `parseAsFloat`
- `parseAsBoolean`
- `parseAsTimestamp`
- `parseAsIsoDateTime`
- `parseAsArrayOf(parser)`
- `parseAsJson`

### 2. String Literal Parsers (Enums)

✅ **GOOD:** Type-safe enum filtering with `parseAsStringLiteral`

```typescript
// src/hooks/trips/useTripFilters.ts
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { TripStatusType } from "@/infrastructure/database/schema/enums";

const TRIP_STATUSES = ["planning", "active", "completed", "archived"] as const;

export function useTripFilters() {
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(TRIP_STATUSES).withDefault("planning")
  );

  const clearFilters = () => {
    setStatus(null); // Removes param from URL
  };

  return {
    status: status as TripStatusType | null,
    setStatus,
    clearFilters,
  };
}
```

❌ **BAD:** Manual string validation without type safety

```typescript
const [status, setStatus] = useQueryState("status");
// status is string | null, no validation
// No TypeScript inference for allowed values
```

**Consumer Component:**

```typescript
// src/components/trips/TripFilters.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useTripFilters } from "@/hooks/trips/useTripFilters";
import type { TripStatusType } from "@/infrastructure/database/schema/enums";

const statuses: { value: TripStatusType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function TripFilters() {
  const { status, setStatus } = useTripFilters();

  return (
    <div className="flex gap-2 flex-wrap">
      {statuses.map(({ value, label }) => (
        <Button
          key={value}
          variant={
            (value === "all" && !status) || status === value
              ? "default"
              : "outline"
          }
          size="sm"
          onClick={() => setStatus(value === "all" ? null : value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
```

### 3. Custom Parser Functions

For inline validation logic, use custom parser functions:

```typescript
// src/components/review/ReviewPageClient.tsx
"use client";

import { useQueryState } from "nuqs";

type ExtendedReviewMode = "learn" | "review" | "practice";

export function ReviewPage() {
  const [mode, setMode] = useQueryState<ExtendedReviewMode>("mode", {
    defaultValue: "learn",
    parse: (value) => (value as ExtendedReviewMode) || "learn",
  });

  return (
    <div>
      <button onClick={() => setMode("review")}>
        Switch to Review Mode
      </button>
    </div>
  );
}
```

### 4. Zod Schema Parsers (Complex Validation)

For complex validation requirements, combine Zod schemas with Nuqs parsers:

✅ **GOOD:** Robust validation with Zod

```typescript
import { z } from "zod";
import { createParser } from "nuqs";

// 1. Define the Zod Schema
const SortSchema = z.enum(["price-asc", "price-desc", "rating", "newest"]);
type SortOption = z.infer<typeof SortSchema>;

// 2. Create the Parser with Zod validation
export const sortParser = createParser({
  parse: (value: string | null) => {
    const result = SortSchema.safeParse(value);
    return result.success ? result.data : "newest"; // Default on invalid
  },
  serialize: (value: SortOption) => value,
});

// 3. Use the parser
const [sort, setSort] = useQueryState("sort", sortParser);
// sort is fully typed as SortOption
```

**Advanced Zod Parser with Complex Objects:**

```typescript
import { z } from "zod";
import { createParser } from "nuqs";

const PriceRangeSchema = z.object({
  min: z.number().min(0),
  max: z.number().max(10000),
});

type PriceRange = z.infer<typeof PriceRangeSchema>;

export const priceRangeParser = createParser<PriceRange>({
  parse: (value: string | null) => {
    if (!value) return { min: 0, max: 10000 };

    try {
      const parsed = JSON.parse(value);
      const result = PriceRangeSchema.safeParse(parsed);
      return result.success ? result.data : { min: 0, max: 10000 };
    } catch {
      return { min: 0, max: 10000 };
    }
  },
  serialize: (value: PriceRange) => JSON.stringify(value),
});

// Usage
const [priceRange, setPriceRange] = useQueryState("price", priceRangeParser);
// URL: ?price={"min":100,"max":500}
```

### 5. Multiple Query States

Manage multiple URL parameters together with `useQueryStates`:

```typescript
import { useQueryStates, parseAsString, parseAsInteger } from "nuqs";
import { parseAsStringLiteral } from "nuqs";

const SORT_OPTIONS = ["price-asc", "price-desc", "rating", "newest"] as const;

export function ProductFilters() {
  const [filters, setFilters] = useQueryStates(
    {
      sort: parseAsStringLiteral(SORT_OPTIONS).withDefault("newest"),
      query: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
      category: parseAsString,
    },
    {
      history: "push", // 'push' adds history entry, 'replace' doesn't
      shallow: false,  // false triggers Next.js data fetching (RSC)
    }
  );

  // Update multiple params at once
  const handleSearch = (searchQuery: string) => {
    setFilters({ query: searchQuery, page: 1 }); // Reset page on search
  };

  // Reset all filters
  const clearFilters = () => {
    setFilters({ sort: null, query: null, page: null, category: null });
  };

  return (
    <div>
      <input
        value={filters.query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      <select
        value={filters.sort}
        onChange={(e) => setFilters({ sort: e.target.value as any })}
      >
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="rating">Top Rated</option>
      </select>
      <button onClick={clearFilters}>Clear Filters</button>
    </div>
  );
}
```

### 6. Server-Side Integration (Next.js 15)

✅ **GOOD:** Next.js 15 async searchParams pattern

```typescript
// src/app/trips/page.tsx
import { TripsList } from "@/components/trips/TripsList";
import { getTrips } from "@/queries/handlers/trips/GetTripsHandler";
import type { TripStatusType } from "@/infrastructure/database/schema/enums";

interface TripsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const params = await searchParams;
  const statusFilter = params.status as TripStatusType | undefined;

  // Fetch data with filter
  const result = await getTrips(statusFilter);

  if (!result.success) {
    return <div>Error loading trips</div>;
  }

  return <TripsList initialTrips={result.data} />;
}
```

❌ **BAD:** Using `createLoader` when project uses async searchParams

```typescript
import { createLoader } from "nuqs/server";

const loadSearchParams = createLoader({
  status: statusParser,
});

export default async function Page({ searchParams }: PageProps) {
  const { status } = await loadSearchParams(searchParams);
  // Inconsistent with project conventions
}
```

**Server Component Pattern:**

```typescript
// src/app/flashcards/page.tsx
interface FlashcardsPageProps {
  searchParams: Promise<{ categoryId?: string }>;
}

export default async function FlashcardsPage({
  searchParams,
}: FlashcardsPageProps) {
  const params = await searchParams;
  const categoryId = params.categoryId
    ? Number.parseInt(params.categoryId, 10)
    : null;

  // Use categoryId to fetch filtered data
  const flashcards = await getFlashcards(categoryId);

  return <FlashcardsList cards={flashcards} />;
}
```

## Advanced Patterns

### URL Cleanup Pattern

Remove parameters from the URL by setting them to `null`:

```typescript
// Remove single param
setStatus(null); // URL goes from ?status=active to cleared

// Reset multiple params
setFilters({
  status: null,
  page: null,
  query: null
});
```

### Shallow Routing Options

Control browser history and Next.js data fetching behavior:

```typescript
const [filters, setFilters] = useQueryStates(
  {
    status: statusParser,
    query: parseAsString,
  },
  {
    // History mode
    history: "push",    // "push" - adds history entry (default)
                        // "replace" - replaces current entry

    // Shallow routing
    shallow: false,     // false - triggers Next.js data fetching (RSC)
                        // true - prevents data fetching
  }
);
```

**When to use `shallow: false`:**
- You want server components to re-fetch data when params change
- Working with React Server Components (RSC)
- Need server-side filtering/pagination

**When to use `shallow: true`:**
- Pure client-side filtering
- No server data dependencies
- Optimistic UI updates

### Integration with Forms

```typescript
"use client";

import { useQueryState, parseAsString } from "nuqs";

export function SearchForm() {
  const [search, setSearch] = useQueryState("q", parseAsString);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setSearch(formData.get("search") as string);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="search"
        defaultValue={search || ""}
        placeholder="Search..."
      />
      <button type="submit">Search</button>
    </form>
  );
}
```

### Debounced Search with Nuqs

```typescript
"use client";

import { useQueryState, parseAsString } from "nuqs";
import { useEffect, useState } from "react";

export function DebouncedSearch() {
  const [search, setSearch] = useQueryState("q", parseAsString);
  const [localValue, setLocalValue] = useState(search || "");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(localValue || null);
    }, 500);

    return () => clearTimeout(timeout);
  }, [localValue, setSearch]);

  return (
    <input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder="Search (debounced)..."
    />
  );
}
```

### Array Parameters

```typescript
import { parseAsArrayOf, parseAsString } from "nuqs";

export function TagFilter() {
  const [tags, setTags] = useQueryState(
    "tags",
    parseAsArrayOf(parseAsString).withDefault([])
  );

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div>
      {["travel", "food", "tech"].map((tag) => (
        <button
          key={tag}
          onClick={() => toggleTag(tag)}
          className={tags.includes(tag) ? "active" : ""}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
// URL: ?tags=travel&tags=food
```

## Best Practices

| Practice | Client Benefit | Server Benefit |
|----------|----------------|----------------|
| **Custom Zod Parsers** | Full TypeScript inference & validation errors | Consistent schemas across client/server boundaries |
| **String Literal Parsers** | Type-safe enum handling with IDE autocomplete | Prevents invalid enum values from reaching server |
| **Custom Hook Abstraction** | Reusable filter logic, centralized state | Consistent URL structure across pages |
| **Shallow Routing Control** | Optimistic UI updates, no page refresh | Triggers RSC data fetching when needed |
| **URL Cleanup with null** | Clean URLs, better UX | Default states explicit in server logic |
| **Default Values** | Graceful fallbacks for missing params | Predictable initial state |

## Troubleshooting

### "useQueryState must be used in a client component"

**Problem:** Trying to use `useQueryState` in a server component.

**Solution:** Add `"use client"` directive at the top of the file:

```typescript
"use client";

import { useQueryState } from "nuqs";
```

### Query params not syncing with URL

**Problem:** URL doesn't update when calling setter functions.

**Solution:** Verify `NuqsAdapter` is wrapping your app:

```typescript
// src/components/providers.tsx
"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return <NuqsAdapter>{children}</NuqsAdapter>;
};
```

### Type errors with enum values

**Problem:** TypeScript errors when using enum values with Nuqs.

**Solution:** Use `parseAsStringLiteral` with const tuple:

```typescript
// ✅ GOOD
const STATUSES = ["active", "inactive"] as const;
const [status, setStatus] = useQueryState(
  "status",
  parseAsStringLiteral(STATUSES)
);

// ❌ BAD
const [status, setStatus] = useQueryState("status");
```

### Server component not receiving updated params

**Problem:** Server component doesn't re-fetch when URL params change.

**Solution:** Set `shallow: false` in `useQueryStates` options:

```typescript
const [filters, setFilters] = useQueryStates(
  { status: statusParser },
  { shallow: false } // Enables RSC data fetching
);
```

### Default values not working

**Problem:** Param defaults to `null` instead of expected default.

**Solution:** Use `.withDefault()` method:

```typescript
// ✅ GOOD
const [page, setPage] = useQueryState(
  "page",
  parseAsInteger.withDefault(1)
);

// ❌ BAD
const [page, setPage] = useQueryState("page", parseAsInteger);
// page can be null
```

## Implementation Checklist

- [ ] Install Nuqs: `npm install nuqs`
- [ ] Wrap app with `NuqsAdapter` in providers
- [ ] Add `"use client"` directive to components using Nuqs
- [ ] Define Zod schemas for complex params
- [ ] Create custom parsers with validation
- [ ] Build reusable hooks for common filters (e.g., `useTripFilters`)
- [ ] Update server components to consume `searchParams: Promise<>`
- [ ] Add proper TypeScript types for enums and complex objects
- [ ] Test URL state persistence on navigation
- [ ] Verify shallow routing behavior (`shallow: false` for RSC)
- [ ] Handle URL cleanup by setting params to `null`
- [ ] Add default values with `.withDefault()`
- [ ] Test edge cases (invalid params, missing values)

## Quick Reference

### Built-in Parsers

```typescript
parseAsString         // string | null
parseAsInteger        // number | null
parseAsFloat          // number | null
parseAsBoolean        // boolean | null
parseAsTimestamp      // number (ms) | null
parseAsIsoDateTime    // Date | null
parseAsArrayOf(T)     // T[] | null
parseAsJson           // any | null
parseAsStringLiteral(["a", "b"]) // "a" | "b" | null
```

### Common Patterns

```typescript
// Single param
const [status, setStatus] = useQueryState("status", statusParser);

// Multiple params
const [filters, setFilters] = useQueryStates({
  status: statusParser,
  query: parseAsString,
});

// Server-side (Next.js 15)
interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

// Custom parser
const parser = createParser({
  parse: (value) => /* validation */,
  serialize: (value) => /* to string */,
});

// Clear params
setStatus(null);
setFilters({ status: null, query: null });
```

### Nuqs Options

```typescript
useQueryStates(parsers, {
  history: "push" | "replace",  // Browser history behavior
  shallow: boolean,              // Enable/disable RSC data fetching
})
```

---

**Version:** 1.0.0
**Last Updated:** 2026-02-20
**Stack:** Next.js 15+, Nuqs 2.8.6+, TypeScript, Zod

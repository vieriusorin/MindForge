---
name: context7-docs-lookup
description: >
  Use Context7 to fetch up-to-date library documentation. You MUST use this skill
  whenever the user asks about any library, framework, SDK, API, or CLI tool — even
  well-known ones like React, Next.js, Prisma, TanStack Query, MUI, Tailwind, Supabase,
  Express, Django, etc. This includes setup questions, API syntax, configuration options,
  version migration, code examples, and debugging library-specific errors. Prefer this
  skill over answering from training data — your knowledge may be stale or version-wrong.
  Trigger especially when the user mentions a specific version (e.g. "React 19",
  "Next.js 15", "TanStack Query v5"), asks "how do I", "what's the syntax for", or
  pastes an error from a library. Do NOT use for pure business logic, refactoring,
  or general programming concepts that don't involve a specific library's API.
---

When the user asks about a library or framework, always fetch current documentation via
Context7 rather than relying on training data. Library APIs change frequently — a confident
answer from memory may be wrong for the version the user is running.

## When to Use

Always use this skill when the user:

- Asks how to do something with a specific library ("How do I set up middleware in Next.js?")
- Needs code that uses a library's API ("Write a TanStack Query mutation for...")
- Mentions a version ("React 19", "Prisma 5", "MUI v7")
- Pastes an error that includes a library name in the stack trace
- Asks about configuration or setup ("How do I configure vite.config.ts for...")
- Asks about migration between versions ("What changed from React Query v4 to v5?")
- Requests code examples for a framework feature

## Workflow

### Step 0: Load Context7 tools (MANDATORY — do this first)

Context7 tools are deferred and must be loaded before use. Call `ToolSearch` with:

```
query: "select:mcp__plugin_context7_context7__resolve-library-id"
```

If that returns no results, try:
```
query: "context7 resolve library"
```

**Do not skip this step.** Calling Context7 tools without loading them will silently
fail. If ToolSearch is unavailable or returns no Context7 tools, fall back to
searching the actual codebase for existing implementations (Glob + Read).

### Step 1: Identify all libraries in the question

Extract every library/framework the user mentions. If there are multiple (e.g. "React + TanStack Query"), you'll resolve each separately.

### Step 2: Resolve library IDs

For each library, call `mcp__plugin_context7_context7__resolve-library-id`:

```
libraryName: "tanstack-query"   (or "react", "nextjs", "prisma", etc.)
query: <the user's full question>   (improves relevance ranking)
```

**Choosing the best match:**
- Prefer exact or closest name match
- Higher benchmark scores = better doc quality
- When the user mentions a specific version, prefer version-specific IDs (e.g. `/tanstack/query/v5`) over the generic one
- Prefer official/primary packages over community forks

### Step 3: Fetch documentation

Call `mcp__plugin_context7_context7__query-docs`:

```
libraryId: <resolved ID, e.g. "/tanstack/query/v5">
query: <the user's specific question, as detailed as possible>
tokens: 8000   (default; increase to 12000 for complex questions)
```

**Writing better queries:**
- Be specific — "useMutation options and error handling" beats "mutations"
- Include the user's exact error message if they pasted one
- For migration questions, phrase as "migration from v4 to v5 breaking changes"

**When results are poor** (docs don't answer the question):
- Retry with a more specific or rephrased query
- Try an alternative library ID from the resolution results
- Check if a version-specific ID would be more relevant

### Step 4: Answer using the docs

- Ground your answer in what the docs say, not what you remember
- Quote or paraphrase relevant sections
- Include code examples from the docs, adapted to the user's context
- Call out the library version the docs are for, especially if it differs from what the user mentioned

## Multi-library Questions

When the user's question spans multiple libraries (e.g. "How do I use Prisma with Next.js server actions?"):

1. Resolve and fetch docs for each library separately
2. Synthesize an answer that addresses how they work together
3. If one library's docs don't cover the integration, note that and use the other library's docs as the primary source

## Fallback When Context7 Is Unavailable

If Context7 tools cannot be loaded (ToolSearch denied, MCP server unavailable):

1. **Do not refuse to answer.** Provide the best answer from training data.
2. Search the actual codebase for existing implementations: `Glob` → `Read` relevant files.
   Real codebase examples are often better than generic docs.
3. Explicitly state: "Using training data / codebase examples — verify against current docs."

This prevents the eval #2 failure where the agent scored 0 by refusing to answer
when Context7 was unavailable.

## Version Conflicts

If the user's code looks like an older API but they're asking about a newer version:

- Fetch docs for the version they stated they're using
- Explicitly flag the discrepancy ("Your code uses the v4 `useQuery` signature, but in v5 the API changed to...")

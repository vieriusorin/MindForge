# TanStack Query Sample: a `projects` Feature

An illustrative end-to-end example: a filterable, paginated list plus create, rename and archive.
The names are made up. Map them onto the project's own paths and HTTP client.

---

## types.ts

```typescript
// Inputs are not Readonly; callers build them
export type ProjectFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'active' | 'archived';
};

export type CreateProjectInput = { name: string; description?: string };

// Responses are Readonly; server data is not mutated in place
export type Project = Readonly<{
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  updatedAt: string;
}>;

export type ProjectPage = Readonly<{ items: readonly Project[]; total: number }>;
```

---

## api.ts

```typescript
import { http } from '@/lib/http'; // ← the project's shared client; throws on non-2xx
import type { CreateProjectInput, Project, ProjectFilters, ProjectPage } from './types';

export const fetchProjects = (filters: ProjectFilters, signal?: AbortSignal) =>
  http.get<ProjectPage>('/api/projects', { params: filters, signal });

export const fetchProject = (id: string, signal?: AbortSignal) =>
  http.get<Project>(`/api/projects/${id}`, { signal });

export const createProject = (input: CreateProjectInput) =>
  http.post<Project>('/api/projects', input);

export const renameProject = ({ id, name }: { id: string; name: string }) =>
  http.patch<Project>(`/api/projects/${id}`, { name });

export const archiveProject = (id: string) =>
  http.post<Project>(`/api/projects/${id}/archive`);
```

---

## queries.ts

```typescript
import { keepPreviousData, queryOptions, skipToken } from '@tanstack/react-query';
import { fetchProject, fetchProjects } from './api';
import type { ProjectFilters } from './types';

export const projectQueries = {
  all: () => ['projects'] as const,
  lists: () => [...projectQueries.all(), 'list'] as const,

  // ✅ The whole filters object is in the key, so changing any filter refetches
  list: (filters: ProjectFilters) =>
    queryOptions({
      queryKey: [...projectQueries.lists(), filters] as const,
      queryFn: ({ signal }) => fetchProjects(filters, signal), // ✅ signal enables cancellation
      placeholderData: keepPreviousData,
    }),

  details: () => [...projectQueries.all(), 'detail'] as const,

  // ✅ skipToken: no request and no `enabled` juggling while id is undefined
  detail: (id: string | undefined) =>
    queryOptions({
      queryKey: [...projectQueries.details(), id] as const,
      queryFn: id ? ({ signal }) => fetchProject(id, signal) : skipToken,
      staleTime: 60_000,
    }),
};
```

---

## mutations.ts

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveProject, createProject, renameProject } from './api';
import { projectQueries } from './queries';
import type { Project, ProjectPage } from './types';

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    // ✅ Invalidate by prefix: every list variant (any filter/page) refetches
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectQueries.lists() }),
  });
}

export function useRenameProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: renameProject,
    // ✅ The response IS the new state: write it, then refresh the lists
    onSuccess: (project) => {
      queryClient.setQueryData(projectQueries.detail(project.id).queryKey, project);
      return queryClient.invalidateQueries({ queryKey: projectQueries.lists() });
    },
  });
}

// ✅ Optimistic: remove the row immediately, roll back on error
export function useArchiveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveProject,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: projectQueries.lists() });
      const snapshots = queryClient.getQueriesData<ProjectPage>({ queryKey: projectQueries.lists() });
      queryClient.setQueriesData<ProjectPage>({ queryKey: projectQueries.lists() }, (old) =>
        old ? { ...old, items: old.items.filter((p: Project) => p.id !== id), total: old.total - 1 } : old,
      );
      return { snapshots };
    },
    onError: (_err, _id, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: projectQueries.all() }),
  });
}
```

---

## Component Consumption

```tsx
function ProjectList({ filters }: { filters: ProjectFilters }) {
  const query = useQuery(projectQueries.list(filters));
  const archive = useArchiveProject();

  // ✅ data first: stale data stays visible during background errors and retries
  if (query.data) {
    return (
      <>
        {query.isError && <Banner>Couldn't refresh. Showing cached data.</Banner>}
        <Table
          rows={query.data.items}
          dimmed={query.isPlaceholderData}
          onArchive={(id) =>
            archive.mutate(id, { onError: (e) => toast.error(e.message) }) // ✅ UI effects per call
          }
        />
      </>
    );
  }
  if (query.isPending) return <Skeleton />;
  return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
}
```

---

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| `fetch` that never checks `res.ok` | The HTTP helper throws on non-2xx |
| `try/catch` in `queryFn` that only rethrows | Remove it. TanStack Query handles rejections |
| Key missing a filter (`['projects', 'list', page]`) | Put the whole filters object in the key |
| `refetch()` after a mutation | Invalidate in the mutation hook |
| `invalidateQueries({ queryKey: ['projects', 'list', filters] })` | Invalidate the prefix `projectQueries.lists()` |
| `enabled: !!id` plus a non-null assertion in `queryFn` | `skipToken` |
| Toasts inside the shared mutation hook | Per-call `mutate(vars, { onSuccess, onError })` |

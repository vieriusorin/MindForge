-- MF-0058: learning paths. A learner enrolls in a path (a file in paths/), and the server records
-- once when a course (a pack of kind: course) in it is complete.
--
-- Access model (.planning/tasks/MF-0058/GOAL.md, C-2, SC-5):
--   * path_enrollments: own rows only; a learner reads, enrolls and leaves; no update (nothing to edit);
--   * course_completions: a learner reads own rows and never writes one. The server-side recorder
--     (secret key, ADR 0006) may insert a row and read it back, never update or delete it, so
--     "recorded once" is a DB fact, not only code;
--   * nothing for anon or PUBLIC on either table;
--   * no FK from pack_slug / path_slug: paths are files, and course packs need not be registered in
--     private.packs (the SC-4 fixture pack is not). The slug checks keep junk out;
--   * the primary keys lead with user_id and serve every read, so there is no extra index.

create table public.path_enrollments (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path_slug text not null check (path_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  started_at timestamptz not null default now(),
  primary key (user_id, path_slug)
);

create table public.course_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_slug text not null check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  completed_at timestamptz not null default now(),
  pack_version integer not null check (pack_version > 0),
  primary key (user_id, pack_slug)
);

-- ── RLS + grants ───────────────────────────────────────────────────────────────
alter table public.path_enrollments enable row level security;
alter table public.course_completions enable row level security;

-- new tables otherwise hand TRUNCATE (which bypasses RLS) to these roles; service_role is re-granted
-- exactly what the recorder needs below
revoke all on public.path_enrollments from public, anon, authenticated, service_role;
revoke all on public.course_completions from public, anon, authenticated, service_role;

grant select, insert, delete on public.path_enrollments to authenticated;
grant select on public.course_completions to authenticated;
-- MF-0058 C-2: the recorder (secret key) may add a row and read it, never change or remove one
grant select, insert on public.course_completions to service_role;

create policy "path_enrollments: read own"
  on public.path_enrollments for select to authenticated
  using (user_id = (select auth.uid()));

create policy "path_enrollments: enroll self"
  on public.path_enrollments for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "path_enrollments: leave own"
  on public.path_enrollments for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "course_completions: read own"
  on public.course_completions for select to authenticated
  using (user_id = (select auth.uid()));

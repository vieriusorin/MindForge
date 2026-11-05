import type { Sql } from "postgres";

export interface ReviewQueueOwner {
  packSlug: string;
  /** The first email (in the order given) whose review queue for the pack is non-empty; null when none. */
  email: string | null;
}

/**
 * MF-0052 SC-6: per pack, which seeded account has something to review. `list_reviewable` hides your
 * own items, so the author of a pack's content sees an empty queue there. Read-only: each call runs as
 * that user (role authenticated + JWT claims) in a transaction that is rolled back.
 */
export async function reviewQueueOwners(
  sql: Sql,
  {
    packSlugs,
    emails,
  }: { packSlugs: readonly string[]; emails: readonly string[] },
): Promise<ReviewQueueOwner[]> {
  const users = await sql<{ id: string; email: string }[]>`
    select id, lower(email) as email from auth.users
    where lower(email) = any(${emails.map((e) => e.toLowerCase())}::text[])`;
  const idOf = new Map(users.map((u) => [u.email, u.id]));
  const out: ReviewQueueOwner[] = [];
  for (const packSlug of packSlugs) {
    let owner: string | null = null;
    for (const email of emails) {
      const id = idOf.get(email.toLowerCase());
      if (!id) continue;
      if (await hasReviewable(sql, id, packSlug)) {
        owner = email.toLowerCase();
        break;
      }
    }
    out.push({ packSlug, email: owner });
  }
  return out;
}

const ROLLBACK = new Error("review-queue-owners: read-only rollback");

async function hasReviewable(
  sql: Sql,
  userId: string,
  packSlug: string,
): Promise<boolean> {
  let found = false;
  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
      await tx`set local role authenticated`;
      const rows =
        await tx`select 1 from public.list_reviewable(${packSlug}) limit 1`;
      found = rows.length > 0;
      throw ROLLBACK;
    });
  } catch (error) {
    // A non-member is refused by list_reviewable (42501): no queue for them.
    if (error !== ROLLBACK && !isInsufficientPrivilege(error)) throw error;
  }
  return found;
}

function isInsufficientPrivilege(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42501"
  );
}

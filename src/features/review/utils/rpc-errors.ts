/** The part of a PostgREST error we decide on. */
export interface RpcError {
  code?: string;
}

/**
 * MF-0007: map a review RPC error to what the screen says. SQLSTATEs are raised by the
 * private.* functions in supabase/migrations/20261103160000_mf0007_reviews.sql:
 * 42501 = not allowed (not a member, own item, not a maintainer, analogy too early),
 * 55000 = the item's state forbids it (rejected, nothing to dismiss), P0002 = unknown item.
 */
export function reviewRpcError(error: RpcError): string {
  switch (error.code) {
    case "42501":
      return "You can't do this for this item.";
    case "55000":
      return "This item changed since you opened it. Reload the page.";
    case "P0002":
      return "This item no longer exists. Reload the page.";
    default:
      return "Could not save your review. Try again.";
  }
}

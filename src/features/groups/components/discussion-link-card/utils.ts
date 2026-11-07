import type { DiscussionLinkView } from "./types";

/**
 * MF-0063: what the card shows for the group's link: the link and the host it opens (the DB CHECK
 * forbids user-info, so this host is the real one). Null when there is no link, or when a stored
 * value can't be parsed, so the card never renders a broken link.
 */
export function discussionLinkView(
  url: string | null,
): DiscussionLinkView | null {
  if (url === null || !URL.canParse(url)) return null;
  return { href: url, host: new URL(url).host };
}

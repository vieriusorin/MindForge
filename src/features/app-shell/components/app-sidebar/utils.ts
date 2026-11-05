/** A nav item is current on its own path and on any sub-path ("/groups" covers "/groups/abc"). */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * MF-0013: the Storm item covers its whole section (Full and Boss start pages, which share the
 * parent of `stormHref`) and every storm page under /storms.
 */
export function isStormActive(pathname: string, stormHref: string): boolean {
  const section = stormHref.slice(0, stormHref.lastIndexOf("/"));
  return isActivePath(pathname, section) || isActivePath(pathname, "/storms");
}

/** The sidebar pins at most this many groups; the rest are one click away on /groups. */
export const MAX_PINNED_GROUPS = 3;

export function pinnedGroups<T>(groups: readonly T[]): T[] {
  return groups.slice(0, MAX_PINNED_GROUPS);
}

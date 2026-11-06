/** A nav item is current on its own path and on any sub-path ("/groups" covers "/groups/abc"). */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * MF-0013: the Storm item covers its whole section (Full and Boss start pages, which share the
 * parent of `stormHref`) and every storm page under /storms.
 * MF-0052 SC-2: a pack without an exam has no Storm item (`stormHref` null), so nothing is active.
 */
export function isStormActive(
  pathname: string,
  stormHref: string | null,
): boolean {
  if (stormHref === null) return false;
  const section = stormHref.slice(0, stormHref.lastIndexOf("/"));
  return isActivePath(pathname, section) || isActivePath(pathname, "/storms");
}

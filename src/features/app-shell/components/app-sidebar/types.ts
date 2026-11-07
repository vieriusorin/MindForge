export interface SidebarGroupLink {
  id: string;
  name: string;
}

export interface AppSidebarProps {
  displayName: string;
  packName: string;
  groups: SidebarGroupLink[];
  /** MF-0054: the section title over `groups` (the layout picks it); omitted = "Pinned". */
  groupsLabel?: "Pinned" | "Recent";
  /**
   * MF-0062: the course map of the learner's primary pack: /play/<packSlug>. Optional so the frozen
   * sidebar tests keep their props; omitted = no Course map item.
   */
  mapHref?: string;
  /** Scenario Duel for the learner's primary pack: /play/<packSlug>/duel. */
  duelHref: string;
  /** MF-0009: Daily Walk for the same pack: /play/<packSlug>/walk. */
  walkHref: string;
  /** MF-0016: Spot the Cuckoo. */
  cuckooHref: string;
  /**
   * MF-0013: the Full Storm start page for the same pack: /play/<packSlug>/storm/full.
   * MF-0052 SC-2: null when the pack has no `exam:` block (no Storm item).
   */
  stormHref: string | null;
  /** MF-0007: the review queue for the learner's primary pack: /review/<packSlug>. */
  reviewHref: string;
  signOutAction: () => Promise<void>;
}

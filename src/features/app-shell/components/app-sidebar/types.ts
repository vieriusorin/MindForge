export interface SidebarGroupLink {
  id: string;
  name: string;
}

export interface AppSidebarProps {
  displayName: string;
  packName: string;
  groups: SidebarGroupLink[];
  /** Scenario Duel for the learner's primary pack: /play/<packSlug>/duel. */
  duelHref: string;
  /** MF-0009: Daily Walk for the same pack: /play/<packSlug>/walk. */
  walkHref: string;
  /** MF-0016: Spot the Cuckoo. */
  cuckooHref: string;
  /** MF-0007: the review queue for the learner's primary pack: /review/<packSlug>. */
  reviewHref: string;
  signOutAction: () => Promise<void>;
}

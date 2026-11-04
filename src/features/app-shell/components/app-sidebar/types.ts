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
  /** MF-0007: the review queue for the learner's primary pack: /review/<packSlug>. */
  reviewHref: string;
  signOutAction: () => Promise<void>;
}

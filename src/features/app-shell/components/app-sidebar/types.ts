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
  signOutAction: () => Promise<void>;
}

export interface SiteHeaderProps {
  signedIn: boolean;
  signOutAction: () => Promise<void>;
}

export interface PathMenuProps {
  pathSlug: string;
}

export interface UsePathMenuReturn {
  leave: () => void;
  isPending: boolean;
  /** Why Leave failed, or null. */
  errorMessage: string | null;
}

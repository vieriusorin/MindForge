export interface StartPathButtonProps {
  pathSlug: string;
}

export interface UseStartPathButtonReturn {
  start: () => void;
  isPending: boolean;
  /** Why Start failed, or null. */
  errorMessage: string | null;
}

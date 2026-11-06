export interface EndExpeditionButtonProps {
  groupId: string;
}

export interface UseEndExpeditionButtonReturn {
  end: () => void;
  /** True while ending and through the refresh after success, so nobody ends twice. */
  isPending: boolean;
  errorMessage: string | null;
}

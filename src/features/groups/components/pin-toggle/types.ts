export interface PinToggleProps {
  groupId: string;
  groupName: string;
  isPinned: boolean;
}

export interface UsePinTogglePinnedGroup {
  id: string;
  name: string;
}

export interface UsePinToggleReturn {
  toggle: () => void;
  isPending: boolean;
  /** Says which pin a pin replaced (the cap of 3), or null. */
  statusMessage: string | null;
  /** Why the last change failed, or null. */
  errorMessage: string | null;
}

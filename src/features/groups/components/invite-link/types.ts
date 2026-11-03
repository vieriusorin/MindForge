import type { RotateInviteResult } from "../../types";

export interface InviteLinkProps {
  inviteUrl: string;
  canRotate: boolean;
  /** The bound `rotateInviteCode` Server Action (MF-0004: returns why it failed). */
  rotateAction: () => Promise<RotateInviteResult>;
}

export type ResetLinkProps = Pick<InviteLinkProps, "rotateAction">;

export interface InviteLinkProps {
  inviteUrl: string;
  canRotate: boolean;
  rotateAction: () => Promise<void>;
}

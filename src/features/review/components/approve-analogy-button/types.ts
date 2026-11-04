export interface ApproveAnalogyButtonProps {
  itemId: string;
  /** The deployed version of the card; refused if the registry holds another. */
  contentHash: string;
  /** The database's answer: analogy owner, or a maintainer once 48 h have passed (C-3). */
  canApprove: boolean;
}

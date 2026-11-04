export interface ReviewActionsProps {
  /** The item on screen. Key the component by it so a new item starts with a fresh form. */
  itemId: string;
  /** The version on screen; the verdict is refused if the registry holds another. */
  contentHash: string;
}

export interface ResolveFlagFormProps {
  itemId: string;
  /** The deployed version; the decision is refused if the registry holds another. */
  contentHash: string;
}

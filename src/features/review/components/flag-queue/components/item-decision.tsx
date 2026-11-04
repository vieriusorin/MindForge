import { ResolveFlagForm } from "../../resolve-flag-form";
import type { ItemDecisionProps } from "../types";

/** The decision form, or why there is none: a decision needs the version the deployment shows. */
export function ItemDecision({ itemId, contentHash }: ItemDecisionProps) {
  if (!contentHash)
    return (
      <p className="text-muted-foreground">
        This item is not in the deployed files yet. Decide once the deploy that
        adds it is live.
      </p>
    );
  return <ResolveFlagForm itemId={itemId} contentHash={contentHash} />;
}

import { Badge } from "@/components/ui/badge";
import type { OrderBodyProps } from "../types";

/**
 * MF-0066 SC-9: reviewers see the key order with node ids, the page sentences that order it, why, the
 * diagram it is drawn from and the page it cites: everything the item asserts.
 */
export function OrderBody({ order }: OrderBodyProps) {
  return (
    <div className="grid gap-4">
      <ol aria-label="Steps in order" className="grid gap-2">
        {order.steps.map((step, i) => (
          <li
            key={step.node}
            className="flex items-start gap-3 rounded-lg border px-3 py-2"
          >
            <Badge variant="secondary" className="tabular-nums">
              {i + 1}
            </Badge>
            <span className="font-mono text-sm font-semibold">{step.node}</span>
            <span className="min-w-0 flex-1">{step.label}</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-1">
        <h3 className="text-sm font-medium text-muted-foreground">
          Ordered by (quoted from the source)
        </h3>
        <ul aria-label="Ordered by" className="grid gap-1 text-sm">
          {order.orderedBy.map((quote) => (
            <li key={quote}>
              <blockquote className="border-l-2 pl-3">{quote}</blockquote>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm">{order.explanation}</p>
      <p className="text-sm text-muted-foreground">
        Drawn from diagram{" "}
        <span className="font-mono break-all">{order.diagram}</span>
      </p>
      <a
        href={order.source.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {order.source.title}
        <span className="sr-only"> (opens the source page)</span>
      </a>
    </div>
  );
}

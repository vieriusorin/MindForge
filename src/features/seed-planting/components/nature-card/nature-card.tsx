import { Leaf, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { NatureCardViewProps } from "./types";

/**
 * MF-0010 SC-1: a nature card. "Where it breaks" is a plain, always-open list: an analogy is only
 * safe to learn with its limits in view (accuracy over entertainment).
 */
export function NatureCardView({ card }: NatureCardViewProps) {
  const headingId = `${card.id}-concept`;
  return (
    <Card aria-labelledby={headingId} role="region">
      <CardHeader>
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Nature card
        </p>
        <CardTitle className="text-xl">
          <h2 id={headingId}>{card.concept}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section>
          <h3 className="mb-1 font-semibold">Simply</h3>
          <p>{card.simply}</p>
        </section>
        <section>
          <h3 className="mb-1 flex items-center gap-2 font-semibold">
            <Leaf aria-hidden className="size-4 text-primary" />
            In nature
          </h3>
          <p>{card.inNature}</p>
        </section>
        <section>
          <h3 className="mb-1 flex items-center gap-2 font-semibold">
            <TriangleAlert aria-hidden className="size-4 text-destructive" />
            Where it breaks
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            {card.whereItBreaks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        {card.contrast && (
          <section>
            <h3 className="mb-1 font-semibold">Contrast</h3>
            <p>{card.contrast}</p>
          </section>
        )}
        {card.whyTheName && (
          <section>
            <h3 className="mb-1 font-semibold">Why the name</h3>
            <p>{card.whyTheName}</p>
          </section>
        )}
        <Separator />
        <section>
          <h3 className="mb-1 text-sm font-semibold">Sources</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {card.sources.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono break-all text-primary underline-offset-4 hover:underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

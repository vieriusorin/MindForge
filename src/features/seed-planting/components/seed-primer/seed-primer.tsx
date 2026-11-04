import { DiagramFigure } from "@/components/diagram-figure";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NatureCardView } from "../nature-card";
import type { SeedPrimerProps } from "./types";

/** MF-0010: "associate before you memorise" — the card, then the diagram. Either may be absent. */
export function SeedPrimer({ card, diagram }: SeedPrimerProps) {
  if (!card && !diagram) return null;
  return (
    <div className="flex flex-col gap-6">
      {card && <NatureCardView card={card} />}
      {diagram && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Diagram
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DiagramFigure
              id={diagram.id}
              title={diagram.title}
              direction={diagram.direction}
              nodes={diagram.nodes}
              edges={diagram.edges}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

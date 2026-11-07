import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { MapDomainProps } from "../types";
import { domainHeaderLine, stepMarker } from "../utils";
import { MapCheckpoint } from "./map-checkpoint";
import { MapNode } from "./map-node";

/** One domain: its skills in pack order, then its Boss Storm checkpoint (exam packs). */
export function MapDomain({ packSlug, domain, next }: MapDomainProps) {
  const headingId = `domain-${domain.domainCode}`;
  const headerLine = domainHeaderLine(domain);
  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>
            <h2 id={headingId} className="text-xl">
              {domain.name}
            </h2>
          </CardTitle>
          {headerLine && (
            <Badge variant="secondary" className="tabular-nums">
              {headerLine}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <ol>
            {domain.nodes.map((node, index) => (
              <li key={node.skillCode}>
                {index > 0 && <Separator />}
                <MapNode
                  packSlug={packSlug}
                  node={node}
                  marker={stepMarker(next, node.skillCode)}
                />
              </li>
            ))}
            {domain.checkpoint && (
              <li>
                <Separator />
                <MapCheckpoint
                  packSlug={packSlug}
                  domain={domain}
                  checkpoint={domain.checkpoint}
                />
              </li>
            )}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}

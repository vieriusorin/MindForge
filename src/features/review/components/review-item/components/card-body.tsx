import type { CardBodyProps } from "../types";
import { Sources } from "./sources";

export function CardBody({ card }: CardBodyProps) {
  return (
    <dl className="grid gap-4">
      <div>
        <dt className="font-semibold">Simply</dt>
        <dd className="text-muted-foreground">{card.simply}</dd>
      </div>
      <div>
        <dt className="font-semibold">In nature</dt>
        <dd className="text-muted-foreground">{card.inNature}</dd>
      </div>
      <div>
        <dt className="font-semibold">Where the analogy breaks</dt>
        <dd>
          <ul className="list-disc pl-5 text-muted-foreground">
            {card.whereItBreaks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </dd>
      </div>
      {card.contrast && (
        <div>
          <dt className="font-semibold">Contrast</dt>
          <dd className="text-muted-foreground">{card.contrast}</dd>
        </div>
      )}
      {card.whyTheName && (
        <div>
          <dt className="font-semibold">Why the name</dt>
          <dd className="text-muted-foreground">{card.whyTheName}</dd>
        </div>
      )}
      <Sources urls={card.sources} />
    </dl>
  );
}

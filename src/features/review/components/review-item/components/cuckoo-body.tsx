import { Badge } from "@/components/ui/badge";
import { CUCKOO_FLAW_KIND_LABEL } from "@/lib/cuckoo-labels";
import type { CuckooBodyProps } from "../types";
import { Sources } from "./sources";

/** MF-0016 SC-9: reviewers see every line, which one is the cuckoo, its kind and why. */
export function CuckooBody({ cuckoo }: CuckooBodyProps) {
  return (
    <div className="grid gap-4">
      <p className="font-medium">{cuckoo.title}</p>
      <ol
        aria-label="Snippet lines"
        className="grid gap-0 rounded-xl border bg-muted p-2 font-mono text-sm"
      >
        {cuckoo.lines.map((text, i) => {
          const line = i + 1;
          const isFlaw = line === cuckoo.flawLine;
          return (
            <li
              // Lines are positional: the index is the line's identity.
              key={line}
              className={`flex items-start gap-2 rounded-lg border px-2 py-1 ${isFlaw ? "border-primary bg-secondary" : "border-transparent"}`}
            >
              <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">
                {line}
              </span>
              <code className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                {text}
              </code>
              {isFlaw && <Badge>Cuckoo</Badge>}
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">
          {CUCKOO_FLAW_KIND_LABEL[cuckoo.flawKind]}
        </Badge>
        <span className="text-muted-foreground tabular-nums">
          on line {cuckoo.flawLine}
        </span>
      </p>
      <p className="text-sm">{cuckoo.explanation}</p>
      <Sources urls={cuckoo.sources} />
    </div>
  );
}

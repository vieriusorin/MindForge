import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { WhyPanelProps } from "../types";

/** D-L14: every option's rationale and the citation, closed until the learner asks why. */
export function WhyPanel({ step, feedback }: WhyPanelProps) {
  const { question } = step;
  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="group min-h-10">
          Why?
          <ChevronDown
            aria-hidden
            className="transition-transform group-data-[state=open]:rotate-180"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 flex flex-col gap-3 rounded-xl bg-muted p-4 text-sm">
        <ul className="flex flex-col gap-2">
          {question.options.map((o) => (
            <li key={o.id}>
              <span className="font-semibold">{o.id}.</span>{" "}
              {feedback.rationales[o.id]}
            </li>
          ))}
        </ul>
        <p>
          Source:{" "}
          <a
            href={question.source.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {question.source.title}
          </a>
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

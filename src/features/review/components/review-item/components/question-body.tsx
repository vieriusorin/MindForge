import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { QuestionBodyProps } from "../types";
import { Sources } from "./sources";

export function QuestionBody({ question }: QuestionBodyProps) {
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Choose <span className="tabular-nums">{question.select}</span>
      </p>
      <ol className="grid gap-3">
        {question.options.map((option, index) => (
          <li key={option.id}>
            {index > 0 && <Separator className="mb-3" />}
            <div className="flex items-start gap-3">
              <span className="font-semibold">{option.id}</span>
              <div className="grid gap-1">
                <p>{option.text}</p>
                <p className="text-muted-foreground">{option.rationale}</p>
              </div>
              <Badge
                variant={option.correct ? "default" : "outline"}
                className="ml-auto shrink-0"
              >
                {option.correct ? "Correct" : "Wrong"}
              </Badge>
            </div>
          </li>
        ))}
      </ol>
      <Sources urls={[question.source.url]} />
    </div>
  );
}

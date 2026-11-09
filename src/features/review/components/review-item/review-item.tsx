import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { itemTitle } from "@/engine/content";
import { ItemBody } from "./components/item-body";
import type { OriginLabels, ReviewItemProps } from "./types";

const KIND_LABEL = {
  question: "Question",
  card: "Nature card",
  diagram: "Diagram",
  cuckoo: "Spot the Cuckoo",
  order: "Order the steps",
} as const satisfies Record<ReviewItemProps["packItem"]["kind"], string>;

const ORIGIN_LABEL = {
  official: "Official",
  human: "Human-written",
  ai: "AI-written",
} as const satisfies OriginLabels;

/** MF-0007 SC-9: the full item a reviewer judges, key and rationales included. */
export function ReviewItem({ packItem, skillName }: ReviewItemProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span>{KIND_LABEL[packItem.kind]}</span>
          <span aria-hidden>·</span>
          <span>{skillName}</span>
          <Badge variant="secondary">
            {ORIGIN_LABEL[packItem.item.origin]}
          </Badge>
        </CardDescription>
        <CardTitle className="text-lg leading-snug">
          {itemTitle(packItem)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ItemBody packItem={packItem} />
      </CardContent>
    </Card>
  );
}

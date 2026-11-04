import type { ItemBodyProps } from "../types";
import { CardBody } from "./card-body";
import { DiagramBody } from "./diagram-body";
import { QuestionBody } from "./question-body";

export function ItemBody({ packItem }: ItemBodyProps) {
  if (packItem.kind === "question")
    return <QuestionBody question={packItem.item} />;
  if (packItem.kind === "card") return <CardBody card={packItem.item} />;
  return <DiagramBody diagram={packItem.item} />;
}

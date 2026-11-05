import type { ItemBodyProps } from "../types";
import { CardBody } from "./card-body";
import { CuckooBody } from "./cuckoo-body";
import { DiagramBody } from "./diagram-body";
import { QuestionBody } from "./question-body";

export function ItemBody({ packItem }: ItemBodyProps) {
  if (packItem.kind === "question")
    return <QuestionBody question={packItem.item} />;
  if (packItem.kind === "card") return <CardBody card={packItem.item} />;
  if (packItem.kind === "diagram")
    return <DiagramBody diagram={packItem.item} />;
  return <CuckooBody cuckoo={packItem.item} />;
}

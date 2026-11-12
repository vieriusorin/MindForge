import type {
  Cuckoo,
  Diagram,
  NatureCard,
  OrderItem,
  Origin,
  PackItem,
} from "@/engine/content";
import type { Question } from "@/engine/questions";

export interface ReviewItemProps {
  packItem: PackItem;
  /** The skill's name from the pack, shown as context. */
  skillName: string;
}

export interface ItemBodyProps {
  packItem: PackItem;
}

export interface QuestionBodyProps {
  question: Question;
}

export interface CardBodyProps {
  card: NatureCard;
}

export interface DiagramBodyProps {
  diagram: Diagram;
}

export interface CuckooBodyProps {
  cuckoo: Cuckoo;
}

export interface OrderBodyProps {
  order: OrderItem;
}

export interface SourcesProps {
  urls: readonly string[];
}

export type OriginLabels = Record<Origin, string>;

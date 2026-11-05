import type { PackDomain } from "@/engine/pack";

export interface StartExpeditionFormProps {
  groupId: string;
  domains: readonly Pick<PackDomain, "code" | "name">[];
}

import { z } from "zod";
import type { DuelBackLink } from "../types";

const GroupId = z.uuid();

/** MF-0012: where "back" goes after a duel: the source group when `from` is a group id, else Today. */
export function duelBackLink(from: string | null): DuelBackLink {
  if (from !== null && GroupId.safeParse(from).success) {
    return { href: `/groups/${from}`, label: "Back to the group" };
  }
  return { href: "/today", label: "Back to your forest" };
}

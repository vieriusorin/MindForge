import { createLoader, createSerializer, parseAsString } from "nuqs/server";

/**
 * MF-0012: the group a duel was opened from. Read by the RSC page only (no client writes);
 * `duelBackLink` decides whether it is a usable group id.
 */
export const duelParsers = {
  from: parseAsString,
};

export const loadDuelParams = createLoader(duelParsers);
export const serializeDuel = createSerializer(duelParsers);

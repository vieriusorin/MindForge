export interface SeatEntry {
  readonly key: string;
  readonly weight: number;
  /** The most seats this entry can hold; `Infinity` when unbounded. */
  readonly capacity: number;
}

// Weights are decimals (4.5, 33.1): two remainders that are equal on paper may differ in the last bits.
const TIE_EPSILON = 1e-9;

/** One Hamilton round over entries that can still take seats; ignores capacity. */
function hamilton(seats: number, entries: readonly SeatEntry[]): number[] {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const quotas = entries.map((entry) => (seats * entry.weight) / total);
  const counts = quotas.map(Math.floor);
  const left = seats - counts.reduce((sum, n) => sum + n, 0);
  const order = quotas
    .map((quota, index) => ({ index, remainder: quota - Math.floor(quota) }))
    .sort((a, b) =>
      Math.abs(a.remainder - b.remainder) < TIE_EPSILON
        ? a.index - b.index
        : b.remainder - a.remainder,
    );
  for (const { index } of order.slice(0, left)) {
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

/**
 * MF-0013: largest-remainder (Hamilton) split of `seats` by weight. A remainder tie goes to the
 * earlier entry. No entry exceeds its capacity: what it cannot hold is split again among entries
 * with spare capacity, so fewer seats are placed only when no capacity is left. Every key is in the
 * result, zero-weight entries get 0.
 */
export function allocateSeats(
  seats: number,
  entries: readonly SeatEntry[],
): Map<string, number> {
  const placed = new Map<string, number>(entries.map((e) => [e.key, 0]));
  let remaining = seats;
  while (remaining > 0) {
    const open = entries.filter(
      (e) => e.weight > 0 && (placed.get(e.key) ?? 0) < e.capacity,
    );
    if (open.length === 0) break;
    const counts = hamilton(remaining, open);
    open.forEach((entry, index) => {
      const have = placed.get(entry.key) ?? 0;
      const take = Math.min(counts[index] ?? 0, entry.capacity - have);
      placed.set(entry.key, have + take);
      remaining -= take;
    });
  }
  return placed;
}

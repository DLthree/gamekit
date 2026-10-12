/**
 * A generational id: a slot index (low 20 bits) and a counter bumped on each reuse of the slot
 * (12 bits). A stale id held by an event or a view fails to resolve instead of pointing at the
 * slot's next occupant.
 */
export type Id = number;

const INDEX_SPAN = 1 << 20;
const GENERATIONS = 1 << 12;

export function packId(index: number, generation: number): Id {
  if (index < 0 || index >= INDEX_SPAN) throw new Error(`id index ${index} out of range`);
  if (generation < 0 || generation >= GENERATIONS) {
    throw new Error(`id generation ${generation} out of range`);
  }
  return generation * INDEX_SPAN + index;
}

export function idIndex(id: Id): number {
  return id % INDEX_SPAN;
}

export function idGeneration(id: Id): number {
  return Math.floor(id / INDEX_SPAN);
}

/** The generation a slot gets on its next reuse (wraps after 4096 reuses). */
export function nextGeneration(generation: number): number {
  return (generation + 1) % GENERATIONS;
}

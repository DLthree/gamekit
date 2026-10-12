/**
 * The run record: the build a run was played on, its seed, and the player's choices in order.
 * With the same build it replays the run exactly (the sim is seeded and deterministic); which
 * choices there are, and how they become a replay address, is the game's (src/game/record.ts).
 * Its text form, `rr1;<build>;<seed>;<choice>;…` (each choice URI-encoded), travels in telemetry.
 */
export interface RunRecord {
  /** The build's `git describe --always --dirty` (vite.config.ts `__COMMIT__`). */
  build: string;
  seed: number;
  choices: string[];
}

/** A record text that can't be read; the message says why. */
export class RecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordError";
  }
}

const HEAD = "rr1";

export function recordText(r: RunRecord): string {
  if (!/^[^;\s]+$/.test(r.build)) throw new RecordError(`build ${r.build}: no ; or spaces`);
  return [HEAD, r.build, String(r.seed), ...r.choices.map(encodeURIComponent)].join(";");
}

export function parseRecord(text: string): RunRecord {
  const [head, build, seed, ...choices] = text.trim().split(";");
  if (head !== HEAD) throw new RecordError(`not a run record (expected ${HEAD};…): ${text}`);
  if (build === undefined || build === "") throw new RecordError(`${text}: no build`);
  if (seed === undefined || !/^\d+$/.test(seed)) throw new RecordError(`${text}: no seed`);
  try {
    return { build, seed: Number(seed), choices: choices.map(decodeURIComponent) };
  } catch {
    throw new RecordError(`${text}: a choice is not URI-encoded`);
  }
}

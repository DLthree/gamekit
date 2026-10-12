import { rmSync } from "node:fs";
import { PARTS_DIR, SHOTS_DIR } from "@deck/pad";

/** Clears an earlier run's leftover parts and shots, so they hold this run's tests only. */
export default function setup(): void {
  rmSync(PARTS_DIR, { recursive: true, force: true });
  rmSync(SHOTS_DIR, { recursive: true, force: true });
}

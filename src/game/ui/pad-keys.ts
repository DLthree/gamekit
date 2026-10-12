import type { PadKeyMap } from "@/ui/pad-keys";

/**
 * The example's pad shortcuts per screen (src/ui/pad-keys.ts): Retry on A and the grid on B
 * after a wave, Resume on B in the pause, the grid on B from an error. The picker has none: the
 * pad moves focus over its cells and A picks one.
 */
export const PAD_KEYS: PadKeyMap = {
  result: [
    ["retry", "a"],
    ["grid", "b"],
  ],
  pause: [
    ["resume", "b"],
    ["grid", "y"],
  ],
  error: [["grid", "b"]],
};

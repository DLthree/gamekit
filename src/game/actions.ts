import { z } from "zod";
import type { Command } from "@/realtime/sim/command";

/**
 * The example's scripted action (`window.__game.act`, a tool's `--actions`): the player's command
 * held for `frames` frames of the kit clock, or until the wave ends. `move` is the stick
 * ([-1, 1] per axis, +y down); `cast` aims the cast slot once ([x, y] or "auto"), on the next
 * playing tick. With `bot=` in the address the bot plays instead: then an action is only frames.
 */
const Action = z.strictObject({
  frames: z.number().int().min(1),
  move: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional(),
  cast: z.union([z.tuple([z.number(), z.number()]), z.literal("auto")]).optional(),
});
export type Action = z.infer<typeof Action>;

/** An action as the sim's command and its frame count; throws on anything else (fail fast). */
export function actionCommand(raw: unknown): { command: Command; frames: number } {
  const r = Action.safeParse(raw);
  if (!r.success)
    throw new Error(
      `action ${JSON.stringify(raw)}: ${r.error.issues.map((i) => `${i.path.join(".") || "action"}: ${i.message}`).join("; ")}`,
    );
  const { frames, move = [0, 0], cast } = r.data;
  const aim = cast === undefined ? null : cast === "auto" ? "auto" : { x: cast[0], y: cast[1] };
  return {
    frames,
    command: { moveX: move[0], moveY: move[1], cast: aim === null ? null : { slot: "cast", aim } },
  };
}

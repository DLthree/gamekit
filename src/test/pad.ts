import { PAD, type PadButton } from "@/input/gamepad";

/** A fake standard pad as `navigator.getGamepads()` lists it: 17 buttons and 4 axes. */
export function fakePad(
  down: readonly PadButton[] = [],
  axes: number[] = [0, 0, 0, 0],
  id = "Xbox 360 Controller (STANDARD GAMEPAD)",
) {
  const pressed = new Set<number>(down.map((b) => PAD[b]));
  return {
    id,
    connected: true,
    mapping: "standard",
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.has(i),
      value: pressed.has(i) ? 1 : 0,
    })),
  };
}

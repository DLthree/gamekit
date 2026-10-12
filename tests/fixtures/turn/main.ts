/**
 * A turn-based page in miniature, for the kit's own tests (tests/e2e/turn-clock.spec.ts): the
 * action "move" moves the piece one square at once, and the piece slides there over 30 frames
 * of the kit clock. No game code: only core.
 */
import { clockHandle, type Handle } from "@/agent/handle";
import { FrameClock } from "@/core/frames";

const SQUARE_PX = 120;
const SLIDE_FRAMES = 30;

const clock = new FrameClock(new URLSearchParams(location.search).get("manual") === "1");
const piece = document.getElementById("piece");
if (piece === null) throw new Error("no #piece");

let square = 0;
let slide: { fromPx: number; startFrame: number } | null = null;
let shownPx = 0;

clock.onFrame((f) => {
  const toPx = square * SQUARE_PX;
  if (slide === null) shownPx = toPx;
  else {
    const t = Math.min(1, (f.index - slide.startFrame) / SLIDE_FRAMES);
    shownPx = slide.fromPx + (toPx - slide.fromPx) * t;
    if (t === 1) slide = null;
  }
  piece.style.transform = `translateX(${shownPx}px)`;
});

const handle = {
  flow: () => ({ screen: "board" }),
  state: () => ({ square, shownPx, sliding: slide !== null }),
  on: () => [],
  telemetryFailures: () => 0,
  ...clockHandle(clock),
  act: (action: unknown) => {
    if (action !== "move") throw new Error(`action ${JSON.stringify(action)}: expected "move"`);
    slide = { fromPx: shownPx, startFrame: clock.index };
    square += 1;
  },
};
window.__game = handle as unknown as Handle;
clock.start();

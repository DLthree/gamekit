import { glyph, type HintButton } from "@/input/gamepad";

/**
 * A game's pad shortcuts: per DOM screen (its root's id), which button each pad button presses,
 * in priority order. A pad button goes to the first listed button that's there and enabled, so
 * one screen can give A to whichever of two actions it shows. A on a screen with nothing focused
 * presses its primary action; B is its way back.
 */
export type PadKeyMap = Readonly<
  Record<string, readonly (readonly [id: string, pad: HintButton])[]>
>;

/**
 * The shortcuts on `screen` as it stands: button id → the pad button that presses it. `enabled`
 * says whether a button is on the screen and enabled (false for one missing or disabled).
 */
export function padKeys(
  map: PadKeyMap,
  screen: string,
  enabled: (id: string) => boolean,
): Map<string, HintButton> {
  const out = new Map<string, HintButton>();
  const taken = new Set<HintButton>();
  for (const [id, pad] of map[screen] ?? []) {
    if (taken.has(pad) || !enabled(id)) continue;
    taken.add(pad);
    out.set(id, pad);
  }
  return out;
}

/**
 * A pad button's hint: a small badge naming it, Xbox letters or PlayStation shapes as the body's
 * `data-glyphs` says (CSS picks the attribute), shown only while the pad was the last input
 * (`data-input="pad"`). It is laid over its button and takes no room, so nothing moves when it
 * shows.
 */
function padHint(b: HintButton): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = "pad-hint";
  s.dataset.hint = b;
  s.dataset.xbox = glyph("xbox", b);
  s.dataset.playstation = glyph("playstation", b);
  s.setAttribute("aria-hidden", "true");
  return s;
}

/**
 * Marks `root`'s shortcut buttons for the pad (`data-pad`, which pad-nav presses) and gives each
 * its hint; a button no longer one loses both. Call it after each render of a screen.
 */
export function markPadKeys(map: PadKeyMap, root: HTMLElement): void {
  const byId = (id: string): HTMLButtonElement | null => {
    const e = root.querySelector(`#${CSS.escape(id)}`);
    return e instanceof HTMLButtonElement ? e : null;
  };
  const keys = padKeys(map, root.id, (id) => {
    const b = byId(id);
    return b !== null && !b.disabled;
  });
  for (const b of root.querySelectorAll<HTMLElement>("[data-pad]")) {
    if (keys.get(b.id) === b.dataset.pad) continue;
    delete b.dataset.pad;
    b.querySelector(":scope > .pad-hint")?.remove();
  }
  for (const [id, pad] of keys) {
    const b = byId(id);
    if (b === null || b.dataset.pad === pad) continue;
    b.dataset.pad = pad;
    b.prepend(padHint(pad));
  }
}

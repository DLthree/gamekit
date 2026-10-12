import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { PAD, type PadButton } from "@/input/gamepad";

/**
 * The Steam Deck check's tools (`pnpm deck:check`): a scripted standard pad, a recorder of real
 * mouse/keyboard/touch input that must stay empty, a walker that maps every control the pad can
 * focus on a screen, and text measurements (font and capital height in screen px, mouse and
 * keyboard words). Findings go to shots/deck-check/parts/ per test; teardown.ts merges them.
 */

declare global {
  interface Window {
    __pad: { axes: number[]; down: number[] };
    /** Trusted (real) mouse, keyboard and touch events since load: a pad-only walk needs none. */
    __deckInputs: string[];
  }
}

export const OUT_DIR = "shots/deck-check";
export const PARTS_DIR = `${OUT_DIR}/parts`;
/** A Deck-size shot of each screen the walk looks at, for a person to check by eye. */
export const SHOTS_DIR = `${OUT_DIR}/shots`;

export type Direction = "up" | "down" | "left" | "right";
const DIRS: readonly Direction[] = ["up", "down", "left", "right"];

/** One text run on screen: its rendered font size and glyph heights in screen px. */
export interface TextEntry {
  screen: string;
  text: string;
  /** Where it sits: the nearest id'd ancestor and the element's tag/class. */
  where: string;
  fontPx: number;
  /** Rendered height of a capital (font px × the font's cap-height ratio). */
  capPx: number;
}

export interface Finding {
  screen: string;
  kind: string;
  detail: string;
}

/** What one test found; teardown.ts merges every test's into the report. */
export class Report {
  readonly texts: TextEntry[] = [];
  readonly findings: Finding[] = [];
  readonly reached: { screen: string; acts: number }[] = [];
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  find(screen: string, kind: string, detail: string): void {
    this.findings.push({ screen, kind, detail });
  }

  write(): void {
    mkdirSync(PARTS_DIR, { recursive: true });
    const { name, reached, findings, texts } = this;
    writeFileSync(
      `${PARTS_DIR}/${name.replace(/[^a-z0-9]+/gi, "-")}.json`,
      JSON.stringify({ name, reached, findings, texts }, null, 2),
    );
  }
}

/** Plugs the scripted pad and the real-input recorder in before the page loads. */
export async function plugPad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__pad = { axes: [0, 0, 0, 0], down: [] };
    window.__deckInputs = [];
    const pad = () => ({
      id: "fake standard pad",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: performance.now(),
      axes: window.__pad.axes,
      buttons: Array.from({ length: 17 }, (_, i) => {
        const on = window.__pad.down.includes(i);
        return { pressed: on, touched: on, value: on ? 1 : 0 };
      }),
    });
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad()] });
    const kinds = ["keydown", "pointerdown", "mousedown", "click", "wheel", "touchstart"];
    for (const k of kinds)
      window.addEventListener(
        k,
        (e) => {
          if (e.isTrusted) window.__deckInputs.push(k);
        },
        { capture: true },
      );
  });
}

/** Holds `down` and `axes` for a few polled frames, then lets go for a couple. */
async function hold(page: Page, down: number[], axes: number[]): Promise<void> {
  await page.evaluate(
    async ({ down, axes }) => {
      const frames = (n: number) =>
        new Promise<void>((done) => {
          const step = (k: number) => (k === 0 ? done() : requestAnimationFrame(() => step(k - 1)));
          step(n);
        });
      window.__pad = { axes, down };
      await frames(3);
      window.__pad = { axes: [0, 0, 0, 0], down: [] };
      await frames(2);
    },
    { down, axes },
  );
}

export function press(page: Page, b: PadButton, axes = [0, 0, 0, 0]): Promise<void> {
  return hold(page, [PAD[b]], axes);
}

/** Sets the sticks (and no buttons) until the next call: for moving and aiming in a fight. */
export async function sticks(page: Page, axes: number[]): Promise<void> {
  await page.evaluate((axes) => {
    window.__pad = { axes, down: [] };
  }, axes);
}

/** The real mouse/keyboard/touch events the page has seen. */
export function realInputs(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__deckInputs.slice());
}

/**
 * The shown controls a mouse could press (buttons, links, inputs) in the open panel (or the page
 * when none is), keyed by a stable path, and the one with focus. Broader than the pad's own list
 * on purpose.
 */
function listTargets(): { acts: [string, string][]; focus: string | null } {
  const keyOf = (e: Element): string => {
    const parts: string[] = [];
    let n: Element | null = e;
    while (n !== null && n !== document.body && n.id === "") {
      const p: Element | null = n.parentElement;
      if (p === null) break;
      parts.unshift(`${n.tagName.toLowerCase()}:${[...p.children].indexOf(n)}`);
      n = p;
    }
    const head = n !== null && n.id !== "" ? `#${n.id}` : "body";
    return parts.length === 0 ? head : `${head}>${parts.join(">")}`;
  };
  const label = (e: Element): string =>
    (e.getAttribute("aria-label") ?? e.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40) || e.tagName.toLowerCase();
  const shown = (e: Element): boolean =>
    e instanceof HTMLElement &&
    e.getClientRects().length > 0 &&
    e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const ACT = "button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex='-1'])";
  // An open panel (.panel, src/ui/page.css) is all the pad has; else the whole page.
  const panel = [...document.querySelectorAll(".panel")].find((p) => shown(p));
  const acts: [string, string][] = [];
  for (const e of (panel ?? document).querySelectorAll(ACT))
    if (shown(e) && !(e as HTMLButtonElement).disabled) acts.push([keyOf(e), label(e)]);
  const a = document.activeElement;
  const focus = a instanceof HTMLElement && a !== document.body ? keyOf(a) : null;
  return { acts, focus };
}

const targetsNow = (page: Page) => page.evaluate(listTargets);
const focusKey = async (page: Page) => (await targetsNow(page)).focus;

/** The pad's focus graph on the current screen, as walked with the D-pad. */
export class FocusMap {
  readonly edges = new Map<string, Partial<Record<Direction, string>>>();
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Path of moves from `from` to `to` over the edges walked so far, or null. */
  path(from: string, to: string): Direction[] | null {
    const prev = new Map<string, [string, Direction] | null>([[from, null]]);
    const queue = [from];
    while (queue.length > 0) {
      const at = queue.shift() as string;
      if (at === to) break;
      for (const [d, next] of Object.entries(this.edges.get(at) ?? {}) as [Direction, string][])
        if (!prev.has(next)) {
          prev.set(next, [at, d]);
          queue.push(next);
        }
    }
    if (!prev.has(to)) return null;
    const out: Direction[] = [];
    for (let at = to; prev.get(at) != null; ) {
      const [p, d] = prev.get(at) as [string, Direction];
      out.unshift(d);
      at = p;
    }
    return out;
  }

  /**
   * Walks every direction from every element reached, until none has a direction left to try
   * (or `maxPresses`): the set of elements the pad can focus on this screen.
   */
  async walk(maxPresses = 160): Promise<Set<string>> {
    const { page } = this;
    let at = await focusKey(page);
    if (at === null) {
      await press(page, "down");
      at = await focusKey(page);
    }
    if (at === null) return new Set();
    this.edges.set(at, this.edges.get(at) ?? {});
    let presses = 0;
    while (presses < maxPresses) {
      let goal: { node: string; dir: Direction; path: Direction[] } | null = null;
      for (const [node, e] of this.edges) {
        const dir = DIRS.find((d) => e[d] === undefined);
        if (dir === undefined) continue;
        const p = this.path(at, node);
        if (p !== null && (goal === null || p.length < goal.path.length))
          goal = { node, dir, path: p };
      }
      if (goal === null) break;
      for (const d of goal.path) {
        await press(page, d);
        presses++;
      }
      const there = await focusKey(page);
      if (there !== goal.node) {
        // The page moved under the walk: carry on from where it is.
        if (there === null) break;
        at = there;
        this.edges.set(there, this.edges.get(there) ?? {});
        continue;
      }
      await press(page, goal.dir);
      presses++;
      const next = (await focusKey(page)) ?? goal.node;
      (this.edges.get(goal.node) as Partial<Record<Direction, string>>)[goal.dir] = next;
      this.edges.set(next, this.edges.get(next) ?? {});
      at = next;
    }
    return new Set(this.edges.keys());
  }

  /** Moves pad focus to `key` over walked edges: null once there, else why not. */
  async goTo(key: string): Promise<string | null> {
    const at = await focusKey(this.page);
    if (at === key) return null;
    const p = at === null ? null : this.path(at, key);
    if (p === null) return `no walked path from ${at ?? "no focus"}`;
    for (const d of p) await press(this.page, d);
    const got = await focusKey(this.page);
    return got === key ? null : `path ${p.join(",")} from ${at} ended on ${got ?? "no focus"}`;
  }
}

/** Maps the screen's controls by D-pad, records what the pad can't reach, returns the map. */
export async function mapScreen(page: Page, r: Report, screen: string): Promise<FocusMap> {
  const before = await targetsNow(page);
  const map = new FocusMap(page);
  const reached = await map.walk();
  for (const [k, l] of before.acts)
    if (!reached.has(k)) r.find(screen, "unreachable control", `${l} (${k})`);
  r.reached.push({ screen, acts: reached.size });
  return map;
}

/** The stable key of the element `selector` picks, as the walker names it. */
function keyFor(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (e === null) return null;
    const parts: string[] = [];
    let n: Element | null = e;
    while (n !== null && n !== document.body && n.id === "") {
      const p: Element | null = n.parentElement;
      if (p === null) break;
      parts.unshift(`${n.tagName.toLowerCase()}:${[...p.children].indexOf(n)}`);
      n = p;
    }
    const head = n !== null && n.id !== "" ? `#${n.id}` : "body";
    return parts.length === 0 ? head : `${head}>${parts.join(">")}`;
  }, selector);
}

/**
 * Presses `selector` with A after walking pad focus to it. A control the pad can't reach is a
 * finding, and the walk goes on with a script click (never a mouse event).
 */
export async function activate(
  page: Page,
  map: FocusMap,
  r: Report,
  screen: string,
  selector: string,
): Promise<void> {
  const key = await keyFor(page, selector);
  if (key === null) throw new Error(`${screen}: no ${selector} on the page`);
  const why = await map.goTo(key);
  if (why === null) return press(page, "a");
  r.find(screen, "pad can't press", `${selector} (${why}): pressed by script instead`);
  await page.evaluate((sel) => (document.querySelector(sel) as HTMLElement).click(), selector);
}

/** Mouse and keyboard words a pad player must not read. "tap", "hold", "press" are fine. */
const INPUT_WORDS: readonly [string, RegExp][] = [
  ["click", /\bclick/i],
  ["mouse", /\bmouse\b/i],
  ["keyboard", /\bkeyboard\b/i],
  ["Esc", /\bEsc(ape)?\b/],
  ["Space", /\bSpace(bar)?\b/],
  ["key hint", /\((?:[A-Z]|Esc|Tab|Enter|Shift|Ctrl)\)/],
];

/**
 * Every visible text run on the page, sized from its real line boxes; input words are findings.
 * Text under an `ignore` selector (a dev-only line the release build leaves out) isn't measured.
 */
export async function measure(
  page: Page,
  r: Report,
  screen: string,
  ignore: readonly string[] = [],
): Promise<void> {
  const found = await page.evaluate((ignore) => {
    const caps = new Map<string, number>();
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx === null) throw new Error("no 2d context");
    const capRatio = (cs: CSSStyleDeclaration) => {
      const font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`;
      let got = caps.get(font);
      if (got === undefined) {
        ctx.font = font;
        got = ctx.measureText("H").actualBoundingBoxAscent / 100;
        caps.set(font, got);
      }
      return got;
    };
    const out: { text: string; where: string; fontPx: number; capPx: number }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const text = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      const p = n.parentElement;
      if (text === "" || p === null || p.closest("script, style, [hidden]") !== null) continue;
      if (ignore.some((sel) => p.closest(sel) !== null)) continue;
      if (!p.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      if (![...range.getClientRects()].some((q) => q.width > 0.5 && q.height > 0.5)) continue;
      const cs = getComputedStyle(p);
      const fontPx = Number.parseFloat(cs.fontSize);
      let at: Element | null = p;
      while (at !== null && at.id === "") at = at.parentElement;
      const cls =
        typeof p.className === "string" && p.className ? `.${p.className.split(" ")[0]}` : "";
      out.push({
        text: text.slice(0, 80),
        where: `${at === null ? "body" : `#${at.id}`} ${p.tagName.toLowerCase()}${cls}`,
        fontPx,
        capPx: Math.round(fontPx * capRatio(cs) * 10) / 10,
      });
    }
    return out;
  }, ignore);
  for (const t of found) {
    r.texts.push({ screen, ...t });
    for (const [word, re] of INPUT_WORDS)
      if (re.test(t.text)) r.find(screen, "input word", `"${word}" in "${t.text}" (${t.where})`);
  }
}

/** Maps and measures the screen in front, and saves its Deck-size shot. */
export async function look(
  page: Page,
  r: Report,
  screen: string,
  ignore: readonly string[] = [],
): Promise<FocusMap> {
  const map = await mapScreen(page, r, screen);
  await measure(page, r, screen, ignore);
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOTS_DIR}/${screen.replace(/[^a-z0-9]+/gi, "-")}.png` });
  return map;
}

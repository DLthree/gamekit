/**
 * Script-side iOS Safari guards, paired with the CSS in ui/page.css (touch-action, overscroll,
 * callout, selection). CSS can't stop Safari's `gesture*` pinch events, and a non-passive
 * touchmove preventDefault is the reliable stop for rubber-band scrolling.
 */
/** Panels whose content can outgrow the screen and need real scrolling. */
const SCROLLABLE_PANELS = ["#error", "#result", "#picker"];

function inScrollablePanel(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return SCROLLABLE_PANELS.some((sel) => target.closest(sel) !== null);
}

export function installIosGuards(): void {
  const block = (e: Event) => e.preventDefault();
  for (const type of ["gesturestart", "gesturechange", "gestureend", "dblclick", "contextmenu"]) {
    document.addEventListener(type, block);
  }
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!inScrollablePanel(e.target)) e.preventDefault();
    },
    { passive: false },
  );
}

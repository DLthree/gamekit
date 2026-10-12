import { GRID, type PickerGrid } from "@/flow/picker";

/** The cell last played, if any; the grid highlights it so a return trip finds it at a glance. */
export interface LastCell {
  character: string;
  buildTier: number;
  threatTier: number;
}

/**
 * The grid: per character, build tiers down the rows and threat tiers across the columns (spec
 * 05, ruling P8), with a "threat N" head per column and a "build N" label per row. Cells the
 * content can't play are shown disabled, so the grid's shape stays the same as tiers get
 * authored. There is one character in M2, so no character tabs; the last-played cell gets a
 * highlight.
 */
export function showPicker(
  root: HTMLElement,
  grids: readonly PickerGrid[],
  onPick: (character: string, buildTier: number, threatTier: number) => void,
  last: LastCell | null = null,
): void {
  const box = document.createElement("div");
  for (const g of grids) {
    const h = document.createElement("h1");
    h.textContent = g.character;
    const cells = document.createElement("div");
    cells.className = "grid";
    cells.append(document.createElement("div")); // the corner above the row labels
    for (let threatTier = 1; threatTier <= GRID; threatTier++) {
      const head = document.createElement("div");
      head.className = "col-head";
      head.textContent = `threat ${threatTier}`;
      cells.append(head);
    }
    for (let row = 0; row < g.cells.length; row += GRID) {
      const rowCells = g.cells.slice(row, row + GRID);
      const label = document.createElement("div");
      label.className = "row-head";
      label.textContent = `build ${rowCells[0].buildTier}`;
      cells.append(label);
      for (const c of rowCells) {
        const b = document.createElement("button");
        b.dataset.character = g.character;
        b.dataset.build = String(c.buildTier);
        b.dataset.threat = String(c.threatTier);
        b.setAttribute("aria-label", `build ${c.buildTier}, threat ${c.threatTier}`);
        b.disabled = !c.enabled;
        if (
          last !== null &&
          last.character === g.character &&
          last.buildTier === c.buildTier &&
          last.threatTier === c.threatTier
        ) {
          b.classList.add("last");
        }
        b.addEventListener("click", () => onPick(g.character, c.buildTier, c.threatTier));
        cells.append(b);
      }
    }
    box.append(h, cells);
  }
  root.replaceChildren(box);
  root.hidden = false;
}

export function hidePicker(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}

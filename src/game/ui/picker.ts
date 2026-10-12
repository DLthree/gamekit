import { GRID, type PickerGrid } from "@/game/picker";

/** The cell last played, if any; the grid highlights it so a return trip finds it at a glance. */
export interface LastCell {
  character: string;
  buildTier: number;
  threatTier: number;
}

/** A deed as the grid lists it: earned or still to do. */
export interface DeedRow {
  id: string;
  name: string;
  text: string;
  earned: boolean;
}

/**
 * The grid: per character, build tiers down the rows and threat tiers across the columns, with a "threat N" head per column and a "build N" label per row. Cells the
 * content can't play are shown disabled, so the grid's shape stays the same as tiers get
 * authored. With one character there are no character tabs; the last-played cell gets a
 * highlight. Under it, every deed with its mark: earned or not, the row's box is the same.
 */
export function showPicker(
  root: HTMLElement,
  grids: readonly PickerGrid[],
  onPick: (character: string, buildTier: number, threatTier: number) => void,
  last: LastCell | null,
  deeds: readonly DeedRow[],
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
  if (deeds.length > 0) {
    const h = document.createElement("h2");
    h.textContent = "Deeds";
    const list = document.createElement("ul");
    list.className = "deeds";
    for (const d of deeds) {
      const li = document.createElement("li");
      li.dataset.deed = d.id;
      li.classList.toggle("earned", d.earned);
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = d.earned ? "★" : "☆";
      mark.setAttribute("aria-label", d.earned ? "earned" : "not yet");
      const name = document.createElement("b");
      name.textContent = d.name;
      li.append(mark, name, ` ${d.text}`);
      list.append(li);
    }
    box.append(h, list);
  }
  root.replaceChildren(box);
  root.hidden = false;
}

export function hidePicker(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}

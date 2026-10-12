/**
 * A menu page in miniature, for the kit's own tests (tests/e2e/menu-page.spec.ts): the page shell
 * with a body taller than a short window, a button at the body's end and one in the button row.
 * Each press is counted in `data-pressed`. No game code: only core.
 */
import "@/ui/page.css";
import { actionButton } from "@/ui/button";
import { showPage } from "@/ui/page";

const root = document.getElementById("menu");
if (root === null) throw new Error("no #menu");
const pressed: string[] = [];
const press = (id: string) => () => {
  pressed.push(id);
  root.dataset.pressed = pressed.join(",");
};
const lines = Array.from({ length: 30 }, (_, i) => {
  const p = document.createElement("p");
  p.textContent = `Line ${i + 1}`;
  return p;
});
showPage(root, {
  title: "Menu",
  body: [...lines, actionButton("deep", "Deep", press("deep"))],
  buttons: [actionButton("done", "Done", press("done"))],
});

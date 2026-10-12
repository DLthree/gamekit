import { expect, fingerTap, mouseClick, test } from "@e2e/fixtures";

// The kit's menu page shell (src/ui/page.ts) on a page of its own (tests/fixtures/menu): in a
// short window the button row stays in view and the body scrolls to what's below.
const MENU = "/tests/fixtures/menu/index.html";

test("in a short window the shell keeps its buttons in view and the wheel reaches the body's end", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(MENU);
  const done = await page.locator("#done").boundingBox();
  expect(done !== null && done.y + done.height <= 360).toBe(true);
  await mouseClick(page, "#deep");
  await mouseClick(page, "#done");
  await expect(page.locator("#menu")).toHaveAttribute("data-pressed", "deep,done");
});

test("@touch a finger swipes the shell's body to its end and taps", async ({ page }) => {
  await page.goto(MENU);
  await fingerTap(page, "#deep");
  await fingerTap(page, "#done");
  await expect(page.locator("#menu")).toHaveAttribute("data-pressed", "deep,done");
});

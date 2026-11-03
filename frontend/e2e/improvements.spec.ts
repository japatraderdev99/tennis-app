import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/"); await page.evaluate(() => localStorage.clear()); await page.reload();
});

test("all gallery choices have reachable, unobscured pointer and keyboard targets", async ({ page }) => {
  await page.goto("#/escolher");
  const options = page.locator(".video-opcao");
  for (let i = 0; i < await options.count(); i++) {
    const choice = options.nth(i);
    await choice.scrollIntoViewIfNeeded(); await choice.focus();
    await expect(choice).toBeFocused();
    expect(await choice.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width >= 44 && r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2));
    })).toBe(true);
    await choice.press("Space"); await expect(choice).toHaveAttribute("aria-pressed", "true");
  }
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations).toEqual([]);
});

test("opening motion is under user control", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Ver o movimento simulado" })).toBeVisible();
  await page.getByRole("button", { name: "Ver o movimento simulado" }).click();
  await page.getByRole("button", { name: "Pausar demonstração" }).click();
  await expect(page.getByRole("button", { name: "Ver o movimento simulado" })).toBeVisible();
});

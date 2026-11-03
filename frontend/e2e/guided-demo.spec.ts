import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ENTRY = "/?demo=1&velocidade=rapida#/estados";

test("guided entry reaches a review only after explicit player selection and returns to the guide", async ({ page }) => {
  // Each test uses Playwright's isolated context, never the user's browser storage.
  await page.goto(ENTRY);
  await expect(page.getByRole("heading", { name: "Veja como funciona a análise", exact: true })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("dados simulados");
  await expect(page.getByRole("link", { name: "Revisar meus vídeos reais", exact: true })).toHaveAttribute("href", "/");
  await page.getByRole("button", { name: "Começar demonstração", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Toque em você", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toque em você para continuar", exact: true })).toBeDisabled();
  await expect(page.locator('.caixa[aria-pressed="true"]')).toHaveCount(0);
  // The synthetic candidate is selected by a user action, not an automatic default.
  await page.getByRole("button", { name: "Pessoa 1 de 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pessoa 1 de 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Sou eu: continuar", exact: true }).click();

  const play = page.getByRole("button", { name: "Reproduzir", exact: true });
  await expect(play).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("note")).toContainText("dados simulados");
  const position = page.getByRole("slider", { name: "Posição no vídeo", exact: true });
  await expect(position).toHaveValue("0");
  await page.getByRole("button", { name: "Próximo quadro", exact: true }).click();
  await expect(position).toHaveValue("1");
  await page.getByRole("button", { name: "Esqueleto ligado", exact: true }).click();
  await expect(page.getByRole("button", { name: "Esqueleto desligado", exact: true })).toHaveAttribute("aria-pressed", "false");
  await play.click();
  await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(play).toBeVisible();

  await page.getByRole("link", { name: "Voltar ao guia da demonstração", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Veja como funciona a análise", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Começar demonstração", exact: true })).toBeEnabled();
});

test("narrow guided entry keeps optional scenarios accessible by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(ENTRY);
  const scenario = page.getByRole("button", { name: "Revisão sem problema encontrado", exact: true });
  await expect(scenario).toBeHidden();

  const checkLayout = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations).toEqual([]);
  };
  await checkLayout();

  const scenarios = page.locator("summary").filter({ hasText: /^Outros cenários de teste$/ });
  await scenarios.focus();
  await expect(scenarios).toBeFocused();
  await scenarios.press("Enter");
  await expect(scenario).toBeVisible();
  await scenario.scrollIntoViewIfNeeded();
  await scenario.focus();
  await expect(scenario).toBeFocused();
  expect(await scenario.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  await checkLayout();
  await scenario.press("Enter");
  await expect(page.getByRole("button", { name: "Reproduzir", exact: true })).toBeVisible({ timeout: 15_000 });
});

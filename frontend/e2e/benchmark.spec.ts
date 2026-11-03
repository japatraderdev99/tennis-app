import { expect, test, type Page, type Browser, type TestInfo } from "@playwright/test";
import catalog from "../benchmarks/tasks.json";

type Outcome = "passed" | "failed" | "not_evaluated";
type Observation = {
  catalog_version: string; task_id: string; execution_kind: "deterministic_playwright";
  workflow: Outcome; scientific_invariants: Outcome;
  browser: { name: string; version: string }; viewport: { width: number; height: number } | null;
};

/** The actions below are scripted. They never represent autonomous agent ability. */
async function observe(id: string, page: Page, browser: Browser, info: TestInfo,
  workflow: () => Promise<void>, invariantPage?: () => Promise<void>) {
  const result: Observation = {
    catalog_version: catalog.catalog_version, task_id: id, execution_kind: "deterministic_playwright",
    workflow: "not_evaluated", scientific_invariants: "not_evaluated",
    browser: { name: browser.browserType().name(), version: browser.version() },
    viewport: page.viewportSize(),
  };
  try {
    try { await test.step("observable workflow", workflow); result.workflow = "passed"; }
    catch (error) { result.workflow = "failed"; throw error; }
    try {
      await test.step("scientific display invariants", async () => {
        if (invariantPage) await invariantPage();
        await expect(page.getByRole("note")).toContainText("dados simulados");
        const text = await page.locator("main").innerText();
        expect(text).not.toMatch(/\d+\s*(%|°|\/10)/);
        // Numeric claims are forbidden; an explanation that no score exists is allowed.
        expect(text).not.toMatch(/(?:score|acurácia|precisão|confiança)\s*[:=]?\s*\d/i);
      });
      result.scientific_invariants = "passed";
    } catch (error) { result.scientific_invariants = "failed"; throw error; }
  } finally {
    await info.attach("benchmark-observation", { body: Buffer.from(JSON.stringify(result)), contentType: "application/json" });
    await info.attach("terminal-view", { body: await page.screenshot(), contentType: "image/png" });
  }
}

async function pick(page: Page, title: string) {
  await page.goto("#/escolher");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Enviar vídeo", exact: true }).click();
}

async function selectNearPlayer(page: Page) {
  await expect(page.getByRole("heading", { name: /Toque em você/ })).toBeVisible();
  // This is an explicit scripted action against a known synthetic fixture.
  // Production and autonomous agents must identify the requested person themselves.
  await page.getByRole("button", { name: /^Pessoa 1 de/ }).click();
  await page.getByRole("button", { name: "Sou eu: continuar", exact: true }).click();
}

async function reviewVisible(page: Page) {
  await expect(page.getByRole("button", { name: "Reproduzir", exact: true })).toBeVisible({ timeout: 15_000 });
}

async function noMeasurement(page: Page) {
  await page.getByText("Medidas do movimento", { exact: true }).click();
  await expect(page.getByText(/Nenhum valor|não mostra medidas/).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("@benchmark UI-01 first use to review", async ({ page, browser }, info) => {
  await observe("UI-01", page, browser, info, async () => {
    await page.getByRole("button", { name: "Começar", exact: true }).click();
    await page.getByRole("button", { name: "Já gravei: escolher vídeo", exact: true }).click();
    await page.getByRole("button", { name: /Saque na quadra 2/ }).click();
    await page.getByRole("button", { name: "Enviar vídeo", exact: true }).click();
    await expect(page.locator('.caixa[aria-pressed="true"]')).toHaveCount(0);
    await selectNearPlayer(page);
    await reviewVisible(page);
  }, () => noMeasurement(page));
});

test("@benchmark UI-02 explicit reselection preserves the gap", async ({ page, browser }, info) => {
  await observe("UI-02", page, browser, info, async () => {
    await pick(page, "Saque e busca da bola");
    await selectNearPlayer(page);
    await expect(page.getByRole("heading", { name: "Perdi você neste ponto" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Escolher você de novo", exact: true }).click();
    await expect(page.locator('.caixa[aria-pressed="true"]')).toHaveCount(0);
    await selectNearPlayer(page);
    await expect(page.getByRole("heading", { name: "Um trecho ficou sem esqueleto" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.trilho-seg[data-com="nao"]')).toHaveCount(1);
  }, () => noMeasurement(page));
});

test("@benchmark UI-03 failed analysis retains media-only replay", async ({ page, browser }, info) => {
  await observe("UI-03", page, browser, info, async () => {
    await pick(page, "Saque durante uma falha");
    await selectNearPlayer(page);
    await expect(page.getByRole("heading", { name: "O processamento falhou" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Rever o vídeo sem esqueleto", exact: true }).click();
    await reviewVisible(page);
    await expect(page.getByRole("button", { name: /^Esqueleto/ })).toHaveCount(0);
  }, () => noMeasurement(page));
});

test("@benchmark UI-04 cancelled analysis retains media-only replay", async ({ page, browser }, info) => {
  await observe("UI-04", page, browser, info, async () => {
    await pick(page, "Saque na quadra 2");
    await selectNearPlayer(page);
    await page.getByRole("button", { name: "Cancelar análise", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Análise cancelada" })).toBeVisible();
    await page.getByRole("button", { name: "Rever o vídeo sem esqueleto", exact: true }).click();
    await reviewVisible(page);
    await expect(page.getByRole("button", { name: /^Esqueleto/ })).toHaveCount(0);
  }, () => noMeasurement(page));
});

test("@benchmark UI-05 history and deletion", async ({ page, browser }, info) => {
  await observe("UI-05", page, browser, info, async () => {
    await pick(page, "Saque na quadra 2");
    await selectNearPlayer(page);
    await reviewVisible(page);
    await page.getByRole("button", { name: "Seus saques", exact: true }).click();
    await page.getByRole("button", { name: /Saque na quadra 2/ }).click();
    await page.getByRole("button", { name: "Excluir vídeo e dados", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir vídeo e dados", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vídeo e dados excluídos" })).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: "Ir para Seus saques", exact: true }).click();
    await expect(page.getByText("Nenhum vídeo guardado", { exact: false })).toBeVisible();
  });
});

test("@benchmark UI-06 keyboard-only explicit player choice", async ({ page, browser }, info) => {
  await observe("UI-06", page, browser, info, async () => {
    await pick(page, "Saque na quadra 2");
    await expect(page.getByRole("heading", { name: "Toque em você", exact: true })).toBeVisible();
    await expect(page.locator('.caixa[aria-pressed="true"]')).toHaveCount(0);
    // Walk the actual tab order; no locator.focus() bypass of keyboard accessibility.
    let reached = false;
    for (let attempts = 0; attempts < 20; attempts++) {
      await page.keyboard.press("Tab");
      if (await page.getByRole("button", { name: /^Pessoa 1 de/ }).evaluate(el => el === document.activeElement)) {
        reached = true;
        const visibleHit = await page.getByRole("button", { name: /^Pessoa 1 de/ }).evaluate(el => {
          const b = el.getBoundingClientRect();
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return b.width >= 44 && b.height >= 44 && !!hit && (el === hit || el.contains(hit));
        });
        expect(visibleHit).toBe(true);
        await page.keyboard.press("Enter");
        break;
      }
    }
    expect(reached).toBe(true);
    await expect(page.locator('.caixa[aria-pressed="true"]')).toHaveCount(1);
    let continued = false;
    for (let attempts = 0; attempts < 20; attempts++) {
      await page.keyboard.press("Tab");
      if (await page.getByRole("button", { name: "Sou eu: continuar", exact: true }).evaluate(el => el === document.activeElement)) {
        await page.keyboard.press("Enter"); continued = true; break;
      }
    }
    expect(continued).toBe(true);
    await reviewVisible(page);
  }, () => noMeasurement(page));
});

/** Private local smoke. Output includes source IDs; keep it outside Git. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.LOCAL_REVIEW_URL || "http://127.0.0.1:5185";
const url = new URL(base);
if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Local loopback origin required");
const output = process.argv[2];
if (!output) throw new Error("Pass a new private output directory");
await mkdir(output, { recursive: false });
const browser = await chromium.launch();
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const unexpectedRequests = [];
  page.on("request", r => { if (!r.url().startsWith(url.origin) && !r.url().startsWith("blob:") && !r.url().startsWith("data:")) unexpectedRequests.push(r.url()); });
  await page.goto(base);
  const catalog = await page.evaluate(async () => (await fetch("/__local_media/catalog")).json());
  if (catalog.version !== 1 || !catalog.videos.length) throw new Error("No prepared local videos");
  for (const item of catalog.videos) {
    await page.goto(base);
    await page.getByRole("heading", { name: item.title, exact: true }).click();
    const video = page.locator("video");
    await expect.poll(() => video.evaluate(v => v.readyState)).toBeGreaterThanOrEqual(2);
    const metadata = await video.evaluate(v => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, error: v.error?.code ?? null }));
    expect(metadata.error).toBeNull();
    expect(metadata.duration).toBeCloseTo(item.duration_seconds, 1);
    expect(metadata.width).toBe(item.width); expect(metadata.height).toBe(item.height);
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.getByRole("slider", { name: "Posição no vídeo real" }).fill("8");
    await expect.poll(() => video.evaluate(v => Math.abs(v.currentTime - 8))).toBeLessThan(.15);
    await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
    await expect.poll(() => video.evaluate(v => v.currentTime)).toBeGreaterThan(8.4);
    await page.getByRole("button", { name: "Pausar", exact: true }).click();
    await page.getByLabel("Velocidade de reprodução").selectOption("0.5");
    expect(await video.evaluate(v => v.playbackRate)).toBe(.5);
    await page.getByRole("button", { name: "Marcar momento", exact: true }).click();
    await page.getByLabel("Sua observação", { exact: true }).fill("Anotação de teste de software, não avaliação do jogador.");
    await page.getByRole("button", { name: "Salvar observação", exact: true }).click();
    await expect(page.getByText("Anotação de teste de software, não avaliação do jogador.", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, `${item.id}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(output, `${item.id}-mobile.png`), fullPage: true });
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Fresh context belongs to this test only; never alters the user's browser notes.
    await page.getByRole("button", { name: /^Remover momento em/ }).click();
    results.push({ id: item.id, ...metadata, playback: "passed", seek: "passed", rate: "passed", manual_note: "passed", no_synthetic_overlay: true, mobile_overflow: false, biomechanical_analysis: "not_run" });
  }
  expect(unexpectedRequests).toEqual([]);
  await writeFile(path.join(output, "result.json"), JSON.stringify({ generated_at: new Date().toISOString(), kind: "private_local_media_smoke", results, external_requests: unexpectedRequests, physical_device_tested: false }, null, 2), { flag: "wx" });
  console.log(`${results.length}/${catalog.videos.length} real local videos passed playback/seek/rate/manual-note checks. No biomechanical analysis.`);
} finally { await browser.close(); }

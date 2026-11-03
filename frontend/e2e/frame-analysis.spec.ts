import { createHash } from "node:crypto";
import { COCO_NAMES } from "../src/local/framePoseValidation";
import type { Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROOT = "http://127.0.0.1:5185/";
let syntheticVideo: Buffer;

/** MediaRecorder streams omit duration. Finalize only this generated test fixture. */
function finalizedWebm(bytes: Buffer, durationMs: number): Buffer {
  const info = bytes.indexOf(Buffer.from([0x15, 0x49, 0xa9, 0x66]));
  if (info < 0) throw new Error("Generated WebM has no Info element");
  const sizeAt = info + 4;
  let width = 1;
  while (width <= 8 && !(bytes[sizeAt]! & (1 << (8 - width)))) width++;
  if (width > 4) throw new Error("Unexpected Info size in generated WebM");
  let size = bytes[sizeAt]! & ((1 << (8 - width)) - 1);
  for (let i = 1; i < width; i++) size = size * 256 + bytes[sizeAt + i]!;
  const duration = Buffer.alloc(11);
  duration[0] = 0x44; duration[1] = 0x89; duration[2] = 0x88;
  duration.writeDoubleBE(durationMs, 3); // Canvas WebM uses the default 1 ms timecode scale.
  const expanded = size + duration.length;
  if (expanded >= 2 ** (7 * width) - 1) throw new Error("Info size overflow in generated fixture");
  const prefix = Buffer.from(bytes.subarray(0, sizeAt + width));
  let remaining = expanded;
  for (let i = width - 1; i >= 0; i--) { prefix[sizeAt + i] = remaining % 256; remaining = Math.floor(remaining / 256); }
  prefix[sizeAt] = prefix[sizeAt]! | (1 << (8 - width));
  const infoEnd = sizeAt + width + size;
  return Buffer.concat([prefix, bytes.subarray(sizeAt + width, infoEnd), duration, bytes.subarray(infoEnd)]);
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(20);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
      const chunks: BlobPart[] = [];
      const finished = new Promise<void>((resolve, reject) => {
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.onerror = () => reject(new Error("Synthetic fixture recording failed"));
        recorder.onstop = () => resolve();
      });
      let frame = 0;
      const draw = () => {
        ctx.fillStyle = "#14408f"; ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = "#ffffff"; ctx.font = "32px sans-serif"; ctx.fillText("TESTE SINTÉTICO", 35, 80);
        ctx.fillStyle = "#e4f222"; ctx.beginPath(); ctx.arc(70 + (frame++ % 30) * 16, 220, 15, 0, Math.PI * 2); ctx.fill();
      };
      draw(); recorder.start();
      const interval = window.setInterval(draw, 50);
      await new Promise(resolve => window.setTimeout(resolve, 1800));
      window.clearInterval(interval); recorder.stop(); await finished;
      stream.getTracks().forEach(track => track.stop());
      return Array.from(new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer()));
    });
    syntheticVideo = finalizedWebm(Buffer.from(bytes), 1800);
  } finally { await page.close(); }
});


test.beforeEach(async ({ page }) => {
  await page.route("**/__local_media/**", route => route.fulfill({ json: { version: 1, videos: [] } }));
  await page.route("**/__local_pose/capabilities", route => route.fulfill({ json: { available: true, max_edge: 1280, max_bytes: 4194304, token: "test-token" } }));
  await page.goto(ROOT);
  await page.locator('input[type="file"]').setInputFiles({ name: "quadro-sintetico.webm", mimeType: "video/webm", buffer: syntheticVideo });
  await expect(page.locator("video")).toHaveJSProperty("readyState", 4);
  await expect(page.getByRole("button", { name: "Analisar este quadro", exact: true })).toBeEnabled();
});

function responseFor(route: Route, mode: "success" | "none" | "mismatch" = "success") {
  const image = route.request().postDataBuffer()!;
  expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(route.request().headers()["x-pose-token"]).toBe("test-token");
  const width = image.readUInt32BE(16), height = image.readUInt32BE(20);
  return { schema_version: "single-frame-pose/1", scope: "single_image", status: mode === "none" ? "no_person" : "estimated",
    image_sha256: mode === "mismatch" ? "0".repeat(64) : createHash("sha256").update(image).digest("hex"), width, height,
    model: { name: "synthetic-test", sha256: "b".repeat(64), runtime: "fixture" }, drawing_policy: "mediapipe-visible-v1", validation: "not_validated",
    people: mode === "none" ? [] : [0, 1].map(index => ({ id: `person-${index}`, bbox: { x1: width * (0.1 + index * 0.5), y1: height * 0.1, x2: width * (0.4 + index * 0.5), y2: height * 0.9 },
      keypoints: COCO_NAMES.map((name, i) => ({ name, x: width * (0.2 + index * 0.5 + i % 2 * 0.05), y: height * (0.2 + i * 0.035) })) })) };
}

async function analyze(page: Page) {
  await page.getByRole("button", { name: "Analisar este quadro", exact: true }).click();
}

test("real frame is bound to PNG and requires explicit selection before drawing", async ({ page }) => {
  await page.route("**/__local_pose/frame", route => route.fulfill({ json: responseFor(route) }));
  await analyze(page);
  await expect(page.getByRole("heading", { name: "Escolha o jogador nesta imagem" })).toBeVisible();
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  await expect(page.getByTestId("real-pose-overlay")).toHaveCount(0);
  await expect(page.locator('.r-analysis-people [aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Pessoa 1", exact: true }).click();
  await expect(page.getByTestId("real-pose-overlay")).toBeVisible();
  await expect(page.getByText("17 de 17 pontos disponíveis para desenhar.", { exact: true })).toBeVisible();
  const image = page.locator(".r-analysis-image img");
  const captured = await image.getAttribute("src");
  await page.getByRole("slider", { name: "Posição no vídeo real" }).fill("0.8");
  await expect(image).toHaveAttribute("src", captured!);
  await expect(page.locator(".r-player svg[aria-label='Pontos estimados do jogador escolhido']")).toHaveCount(0);
  await page.getByRole("button", { name: "Ocultar esqueleto", exact: true }).click();
  await expect(page.getByTestId("real-pose-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar esqueleto", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations).toEqual([]);
  await page.getByRole("button", { name: "Escolher outro momento", exact: true }).click();
  await expect(page.getByTestId("real-pose-overlay")).toHaveCount(0);
  await expect(page.locator(".r-analysis-image")).toHaveCount(0);
});

test("empty result and network failure preserve video and explain next action", async ({ page }) => {
  let fail = true;
  await page.route("**/__local_pose/frame", route => fail ? route.fulfill({ status: 503, json: { code: "runtime_unavailable" } }) : route.fulfill({ json: responseFor(route, "none") }));
  await analyze(page);
  await expect(page.getByRole("alert")).toContainText("Não foi possível analisar");
  await expect(page.locator("video")).toBeVisible();
  fail = false; await analyze(page);
  await expect(page.getByRole("heading", { name: "Não foi possível marcar uma pessoa neste quadro" })).toBeVisible();
  await expect(page.getByTestId("real-pose-overlay")).toHaveCount(0);
  await expect(page.getByText(/Escolha outro momento em que o jogador/)).toBeVisible();
});

test("mismatched image evidence is rejected without an overlay", async ({ page }) => {
  await page.route("**/__local_pose/frame", route => route.fulfill({ json: responseFor(route, "mismatch") }));
  await analyze(page);
  await expect(page.getByRole("alert")).toContainText("O resultado não corresponde a esta imagem");
  await expect(page.getByTestId("real-pose-overlay")).toHaveCount(0);
  await expect(page.locator(".r-analysis-people")).toHaveCount(0);
});

test("analysis waits for a decoded image after seeking has finished", async ({ page }) => {
  await page.route("**/__local_pose/frame", route => route.fulfill({ json: responseFor(route) }));
  await page.getByRole("slider", { name: "Posição no vídeo real" }).fill("1.1");
  // Reproduce a real browser state: seeking=false but only metadata is ready.
  // The override is confined to this generated fixture in an isolated context.
  await page.locator("video").evaluate(el => {
    const video = el as HTMLVideoElement;
    Object.defineProperty(video, "readyState", { configurable: true, get: () => 1 });
    window.setTimeout(() => {
      Reflect.deleteProperty(video, "readyState");
      video.dispatchEvent(new Event("loadeddata"));
    }, 700);
  });
  await analyze(page);
  await expect(page.getByRole("status")).toContainText("Preparando a imagem exibida no vídeo");
  await expect(page.getByRole("heading", { name: "Escolha o jogador nesta imagem" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
});

test("cancelled pending result never reappears", async ({ page }) => {
  let release: () => void = () => {};
  const wait = new Promise<void>(resolve => { release = resolve; });
  let received = false;
  await page.route("**/__local_pose/frame", async route => {
    received = true;
    const json = responseFor(route);
    await wait;
    await route.fulfill({ json }).catch(() => {});
  });
  await analyze(page);
  await expect.poll(() => received).toBe(true);
  await page.getByRole("button", { name: "Cancelar análise do quadro", exact: true }).click();
  release();
  await expect(page.getByRole("status")).toContainText("Análise cancelada");
  await expect(page.getByRole("button", { name: "Analisar este quadro", exact: true })).toBeEnabled();
  await expect(page.getByTestId("real-pose-overlay")).toHaveCount(0);
  await expect(page.locator(".r-analysis-image")).toHaveCount(0);
});

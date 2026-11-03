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
  // Every local-media request is intercepted. No private library or video is read.
  await page.route("**/__local_media/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/__local_media/catalog") {
      await route.fulfill({ json: { version: 1, videos: ["a", "b"].map(id => ({
        id: `synthetic-content-${id}`, title: `Treino sintético ${id.toUpperCase()}`,
        duration_seconds: 1.8, width: 640, height: 360, size_bytes: syntheticVideo.length,
        edited: true, media_url: `/__local_media/test-${id}.webm`, poster_url: null,
      })) } }); return;
    }
    if (!/^\/__local_media\/test-[ab]\.webm$/.test(path)) { await route.abort("blockedbyclient"); return; }
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = Math.min(range?.[2] ? Number(range[2]) : syntheticVideo.length - 1, syntheticVideo.length - 1);
    if (start >= syntheticVideo.length || end < start) {
      await route.fulfill({ status: 416, headers: { "Content-Range": `bytes */${syntheticVideo.length}` } }); return;
    }
    await route.fulfill({ status: range ? 206 : 200, contentType: "video/webm",
      headers: { "Accept-Ranges": "bytes", ...(range ? { "Content-Range": `bytes ${start}-${end}/${syntheticVideo.length}` } : {}) },
      body: syntheticVideo.subarray(start, end + 1) });
  });
  await page.goto(ROOT);
});

async function openCatalog(page: Page, letter = "A") {
  await page.getByRole("button", { name: new RegExp(`Treino sintético ${letter}`) }).click();
  await expect(page.getByRole("button", { name: "Reproduzir", exact: true })).toBeEnabled();
  await expect(page.locator("video")).toHaveJSProperty("readyState", 4);
}

async function goHome(page: Page) {
  await page.getByRole("main").getByRole("button", { name: "Seus vídeos", exact: true }).click();
}

async function seek(page: Page, seconds: number) {
  await page.getByRole("slider", { name: "Posição no vídeo real" }).fill(String(seconds));
  await expect.poll(async () => Math.abs(await page.locator("video").evaluate(v => (v as HTMLVideoElement).currentTime) - seconds)).toBeLessThan(0.15);
}

async function saveObservation(page: Page, note: string) {
  await page.getByRole("button", { name: "Marcar momento", exact: true }).click();
  await page.getByRole("textbox", { name: "Sua observação" }).fill(note);
  await page.getByRole("button", { name: "Salvar observação", exact: true }).click();
  await expect(page.getByText("Observação registrada.", { exact: true })).toBeVisible();
}

test("catalog playback controls and manual observations survive reopen and removal", async ({ page }) => {
  await openCatalog(page);
  await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
  await expect.poll(() => page.locator("video").evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(0.05);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  await page.getByRole("combobox", { name: "Velocidade de reprodução" }).selectOption("0.5");
  await expect(page.locator("video")).toHaveJSProperty("playbackRate", 0.5);
  await seek(page, 0.7);
  const note = "<b>TESTE SINTÉTICO</b>: rever minha preparação";
  await saveObservation(page, note);
  await expect(page.locator(".r-note-text")).toHaveText(note);
  await expect(page.locator(".r-note-text b")).toHaveCount(0);
  await goHome(page); await openCatalog(page);
  await expect(page.locator(".r-note-text")).toHaveText(note);
  await page.reload(); await openCatalog(page);
  await expect(page.locator(".r-note-text")).toHaveText(note);
  await page.getByRole("button", { name: /^Rever momento em/ }).click();
  await expect.poll(() => page.locator("video").evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(0.55);
  await page.getByRole("button", { name: /^Remover momento em/ }).click();
  await expect(page.getByText("O que chamou sua atenção?", { exact: true })).toBeVisible();
  await page.reload(); await openCatalog(page);
  await expect(page.locator(".r-moment-list li")).toHaveCount(0);
});

test("file-picker playback uses a blob without upload, synthetic pose or persistent notes", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", request => { if (!["GET", "HEAD"].includes(request.method())) sent.push(request.method()); });
  await page.getByLabel("Escolher vídeo do dispositivo").setInputFiles({ name: "meu-teste-sintetico.webm", mimeType: "video/webm", buffer: syntheticVideo });
  await expect(page.getByRole("button", { name: "Reproduzir", exact: true })).toBeEnabled();
  await expect(page.locator("video")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator(".r-player canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Esqueleto/ })).toHaveCount(0);
  await expect(page.getByText("Sem análise biomecânica vinculada.", { exact: false })).toBeVisible();
  await seek(page, 0.4); await saveObservation(page, "Somente nesta aba");
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("quadro.local.moments.")))).toEqual([]);
  await goHome(page); await openCatalog(page, "B");
  await expect(page.getByRole("heading", { name: "Treino sintético B", exact: true })).toBeVisible();
  await expect(page.locator(".r-moment-list li")).toHaveCount(0);
  await expect(page.locator("video")).toHaveJSProperty("playbackRate", 1);
  await expect(page.locator("video")).toHaveAttribute("src", "/__local_media/test-b.webm");
  expect(sent).toEqual([]);
});

test("file rejection and decode failure recover when a playable file is chosen", async ({ page }) => {
  const input = page.getByLabel("Escolher vídeo do dispositivo");
  await input.setInputFiles({ name: "nao-e-video.txt", mimeType: "text/plain", buffer: Buffer.from("TESTE SINTÉTICO") });
  await expect(page.getByRole("alert")).toContainText("Escolha um vídeo MP4, MOV ou WebM");
  await expect(page.locator("video")).toHaveCount(0);
  await input.setInputFiles({ name: "corrompido.webm", mimeType: "video/webm", buffer: Buffer.from("NOT A VIDEO") });
  await expect(page.getByRole("heading", { name: "Este vídeo não abriu", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar momento", exact: true })).toBeDisabled();
  await input.setInputFiles({ name: "recuperado.webm", mimeType: "video/webm", buffer: syntheticVideo });
  await expect(page.getByRole("button", { name: "Reproduzir", exact: true })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "recuperado", exact: true })).toBeVisible();
});

test("blocked browser storage keeps the observation in the tab with an export warning", async ({ page }) => {
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem"]) {
      Object.defineProperty(Storage.prototype, method, { configurable: true, value() { throw new DOMException("Storage blocked by test", "SecurityError"); } });
    }
  });
  await page.reload(); await openCatalog(page);
  await expect(page.locator(".r-storage-copy")).toContainText("nesta aba");
  await expect(page.locator(".r-storage-copy")).not.toContainText("ficam guardadas neste navegador");
  await page.getByRole("button", { name: "Marcar momento", exact: true }).click();
  await page.getByRole("textbox", { name: "Sua observação" }).fill("Observação preservada na aba");
  await page.getByRole("button", { name: "Salvar observação", exact: true }).click();
  await expect(page.locator(".r-note-text")).toHaveText("Observação preservada na aba");
  await expect(page.getByRole("status")).toContainText(/Exporte/);
  await expect(page.getByText("Observação registrada.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exportar meus momentos", exact: true })).toBeEnabled();
});

test("A/B repeats the selected interval and an outside seek stops repetition", async ({ page }) => {
  await openCatalog(page);
  await page.locator("summary").filter({ hasText: "Repetir um trecho" }).click();
  await seek(page, 0.2); await page.getByRole("button", { name: /^Marcar início/ }).click();
  await seek(page, 0.8); await page.getByRole("button", { name: /^Marcar fim/ }).click();
  await page.getByRole("button", { name: "Repetir trecho", exact: true }).click();
  await expect(page.getByRole("button", { name: "Parar repetição", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.locator("video").evaluate(v => (v as HTMLVideoElement).seeking)).toBe(false);
  await page.locator("video").evaluate(v => {
    v.setAttribute("data-observed-loop-seeks", "0");
    v.addEventListener("seeking", () => {
      if (Math.abs((v as HTMLVideoElement).currentTime - 0.2) < 0.12) v.setAttribute("data-observed-loop-seeks", String(Number(v.getAttribute("data-observed-loop-seeks")) + 1));
    });
  });
  await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
  await expect.poll(() => page.locator("video").getAttribute("data-observed-loop-seeks"), { timeout: 7000 }).not.toBe("0");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await seek(page, 1.2);
  await expect(page.getByRole("button", { name: "Repetir trecho", exact: true })).toHaveAttribute("aria-pressed", "false");
});

for (const width of [320, 390]) {
  test(`local library and review remain accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const state of ["library", "review"]) {
      if (state === "review") await openCatalog(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target), summary: v.nodes.map(n => n.failureSummary) }))).toEqual([]);
    }
  });
}

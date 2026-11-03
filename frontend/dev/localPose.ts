import { spawn } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, readFile, mkdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import type { FramePose } from "../src/local/poseTypes";
import { isLocalRequest } from "./localMedia";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 1280;
const TIMEOUT = 90_000;
const OUTPUT_LIMIT = 128 * 1024;
const CONFIG = fileURLToPath(new URL("../artifacts/local-pose.json", import.meta.url));
const SCRIPT = fileURLToPath(new URL("../../scripts/analyze_frame.py", import.meta.url));
const CACHE = fileURLToPath(new URL("../artifacts/pose-runtime-cache", import.meta.url));
const HASH = /^[a-f0-9]{64}$/;
const NAMES = ["nose", "left_eye", "right_eye", "left_ear", "right_ear", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"];

interface RuntimeConfig { python_path: string; model_path: string; model_sha256: string }
export interface PoseRuntime {
  available(): Promise<boolean>;
  infer(png: Buffer, signal: AbortSignal): Promise<FramePose>;
}

async function config(filename: string): Promise<RuntimeConfig> {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384) throw new Error("unavailable");
  const value = JSON.parse(await readFile(filename, "utf8")) as RuntimeConfig;
  if (!value || typeof value.python_path !== "string" || !path.isAbsolute(value.python_path)
    || typeof value.model_path !== "string" || !path.isAbsolute(value.model_path)
    || typeof value.model_sha256 !== "string" || !HASH.test(value.model_sha256)) throw new Error("unavailable");
  // venv Python normally is a symlink; only the fixed config may name an executable.
  await access(value.python_path, constants.X_OK);
  const modelStat = await lstat(value.model_path);
  if (!modelStat.isFile() || modelStat.isSymbolicLink() || modelStat.size > 100 * 1024 * 1024) throw new Error("unavailable");
  return value;
}

export function pngDimensions(png: Buffer): { width: number; height: number } {
  if (png.length > MAX_BYTES) throw new Error("image_too_large");
  if (png.length < 33 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    || png.readUInt32BE(8) !== 13 || png.subarray(12, 16).toString("ascii") !== "IHDR") throw new Error("invalid_png");
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE) throw new Error("invalid_dimensions");
  return { width, height };
}

/** Native output must remain bound to exactly the submitted image and safe drawing space. */
export function validateFramePose(value: unknown, png: Buffer): FramePose {
  const pose = value as FramePose;
  const { width, height } = pngDimensions(png);
  if (!pose || pose.schema_version !== "single-frame-pose/1" || pose.scope !== "single_image"
    || pose.validation !== "not_validated" || pose.drawing_policy !== "mediapipe-visible-v1"
    || pose.width !== width || pose.height !== height || pose.image_sha256 !== createHash("sha256").update(png).digest("hex")
    || !pose.model || typeof pose.model.name !== "string" || pose.model.name.length > 100
    || typeof pose.model.runtime !== "string" || pose.model.runtime.length > 160 || !HASH.test(pose.model.sha256)
    || !Array.isArray(pose.people) || pose.people.length > 4
    || pose.status !== (pose.people.length ? "estimated" : "no_person")) throw new Error("invalid_result");
  const ids = new Set<string>();
  for (const p of pose.people) {
    if (!p || typeof p.id !== "string" || !/^person-[1-4]$/.test(p.id) || ids.has(p.id) || !p.bbox
      || ![p.bbox.x1, p.bbox.x2, p.bbox.y1, p.bbox.y2].every(Number.isFinite)
      || p.bbox.x1 < 0 || p.bbox.x2 >= width || p.bbox.y1 < 0 || p.bbox.y2 >= height
      || p.bbox.x1 >= p.bbox.x2 || p.bbox.y1 >= p.bbox.y2
      || !Array.isArray(p.keypoints) || p.keypoints.length !== 17) throw new Error("invalid_result");
    ids.add(p.id);
    p.keypoints.forEach((point, i) => {
      if (!point || point.name !== NAMES[i] || !(point.x === null && point.y === null
        || typeof point.x === "number" && typeof point.y === "number" && Number.isFinite(point.x) && Number.isFinite(point.y)
        && point.x >= 0 && point.x < width && point.y >= 0 && point.y < height)) throw new Error("invalid_result");
    });
  }
  // Return a whitelist, not untrusted extra fields from a subprocess.
  return { schema_version: pose.schema_version, scope: pose.scope, status: pose.status,
    image_sha256: pose.image_sha256, width, height,
    model: { name: pose.model.name, sha256: pose.model.sha256, runtime: pose.model.runtime },
    drawing_policy: pose.drawing_policy, validation: pose.validation,
    people: pose.people.map(p => ({ id: p.id, bbox: { x1: p.bbox.x1, y1: p.bbox.y1, x2: p.bbox.x2, y2: p.bbox.y2 }, keypoints: p.keypoints.map(k => ({ name: k.name, x: k.x, y: k.y })) })) };
}

function nativeRuntime(configPath: string): PoseRuntime {
  return {
    async available() { try { await config(configPath); return true; } catch { return false; } },
    async infer(png, signal) {
      const settings = await config(configPath);
      await mkdir(CACHE, { recursive: true, mode: 0o700 });
      if (signal.aborted) throw new Error("aborted");
      return new Promise<FramePose>((resolve, reject) => {
        const child = spawn(settings.python_path, [SCRIPT, "--model", settings.model_path, "--expected-sha256", settings.model_sha256], {
          shell: false, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, MPLCONFIGDIR: CACHE, PYTHONDONTWRITEBYTECODE: "1" },
        });
        const chunks: Buffer[] = [];
        let length = 0, stderrLength = 0, settled = false;
        const finish = (error?: Error, result?: FramePose) => {
          if (settled) return;
          settled = true; clearTimeout(timer); signal.removeEventListener("abort", abort);
          if (error) { child.kill("SIGKILL"); reject(error); } else resolve(result!);
        };
        const abort = () => finish(new Error("aborted"));
        const timer = setTimeout(() => finish(new Error("analysis_timeout")), TIMEOUT);
        signal.addEventListener("abort", abort, { once: true });
        child.stdout.on("data", (data: Buffer) => {
          length += data.length;
          if (length > OUTPUT_LIMIT) finish(new Error("invalid_result")); else chunks.push(data);
        });
        child.stderr.on("data", (data: Buffer) => {
          stderrLength += data.length; if (stderrLength > OUTPUT_LIMIT) finish(new Error("analysis_failed"));
        });
        child.on("error", () => finish(new Error("analysis_failed")));
        child.stdin.on("error", () => finish(new Error("analysis_failed")));
        child.on("close", code => {
          if (settled) return;
          if (code !== 0) { finish(new Error("analysis_failed")); return; }
          try {
            const result = validateFramePose(JSON.parse(Buffer.concat(chunks).toString("utf8")), png);
            if (result.model.sha256 !== settings.model_sha256) throw new Error("model_changed");
            finish(undefined, result);
          } catch { finish(new Error("analysis_failed")); }
        });
        child.stdin.end(png);
      });
    },
  };
}

export function createLocalPoseMiddleware(options: { runtime?: PoseRuntime; configPath?: string; timeoutMs?: number } = {}) {
  const runtime = options.runtime ?? nativeRuntime(options.configPath ?? CONFIG);
  const token = randomBytes(32).toString("hex");
  let active: AbortController | null = null;
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const route = (req.url ?? "").split("?")[0];
    if (!route?.startsWith("/__local_pose/")) { next(); return; }
    res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    const json = (status: number, value: unknown) => {
      if (res.destroyed || res.writableEnded) return;
      const payload = JSON.stringify(value); res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(payload);
    };
    if (!isLocalRequest(req)) { json(403, { code: "local_access_only" }); return; }
    if (route === "/__local_pose/capabilities" && req.method === "GET") {
      void runtime.available().then(available => json(200, { available, max_edge: MAX_EDGE, max_bytes: MAX_BYTES, token }), () => json(200, { available: false, max_edge: MAX_EDGE, max_bytes: MAX_BYTES, token })); return;
    }
    if (route !== "/__local_pose/frame") { json(404, { code: "not_found" }); return; }
    if (req.method !== "POST") { json(405, { code: "method_not_allowed" }); return; }
    const provided = req.headers["x-pose-token"];
    if (req.headers.origin !== `http://${req.headers.host}` || typeof provided !== "string" || !HASH.test(provided)
      || !timingSafeEqual(Buffer.from(provided), Buffer.from(token))) { json(403, { code: "request_not_allowed" }); return; }
    if (req.headers["content-type"] !== "image/png") { json(415, { code: "png_required" }); return; }
    const declared = req.headers["content-length"];
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) { json(413, { code: "image_too_large" }); return; }
    if (active) { json(409, { code: "analysis_busy" }); return; }
    const controller = new AbortController(); active = controller;
    const buffers: Buffer[] = []; let length = 0, receiving = true;
    const timeout = setTimeout(() => { controller.abort(); json(504, { code: "analysis_timeout" }); }, options.timeoutMs ?? TIMEOUT);
    const stop = () => { controller.abort(); clearTimeout(timeout); if (active === controller) active = null; };
    req.once("aborted", stop);
    res.once("close", stop);
    req.on("error", stop);
    req.on("data", (data: Buffer) => {
      if (!receiving || controller.signal.aborted) return;
      length += data.length;
      if (length > MAX_BYTES) { receiving = false; controller.abort(); json(413, { code: "image_too_large" }); return; }
      buffers.push(data);
    });
    req.once("end", () => {
      receiving = false;
      if (controller.signal.aborted) { stop(); return; }
      const png = Buffer.concat(buffers);
      try { pngDimensions(png); } catch { json(422, { code: "invalid_image" }); stop(); return; }
      void (async () => {
        if (!await runtime.available()) { json(503, { code: "analysis_unavailable" }); return; }
        if (controller.signal.aborted) return;
        const result = validateFramePose(await runtime.infer(png, controller.signal), png);
        if (!controller.signal.aborted) json(200, result);
      })().catch(() => { if (!controller.signal.aborted) json(500, { code: "analysis_failed" }); }).finally(stop);
    });
  };
  middleware.dispose = () => { active?.abort(); active = null; };
  return middleware;
}

/** Development only; no remote service, user filename or full-video upload. */
export function localPosePlugin(): Plugin {
  return {
    name: "tennis-local-frame-pose",
    configureServer(server) {
      const middleware = createLocalPoseMiddleware(); server.middlewares.use(middleware);
      server.httpServer?.once("close", middleware.dispose);
    },
  };
}

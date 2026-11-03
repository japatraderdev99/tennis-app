import { createHash } from "node:crypto";
import { IncomingMessage, type ServerResponse } from "node:http";
import { Socket } from "node:net";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLocalPoseMiddleware, pngDimensions, validateFramePose, type PoseRuntime } from "../dev/localPose";
import type { FramePose } from "../src/local/poseTypes";

// IHDR-only synthetic data exercises transport boundaries; native decoding is tested separately.
function png(width = 64, height = 48) {
  const data = Buffer.alloc(33); Buffer.from("89504e470d0a1a0a", "hex").copy(data);
  data.writeUInt32BE(13, 8); data.write("IHDR", 12); data.writeUInt32BE(width, 16); data.writeUInt32BE(height, 20);
  return data;
}
function result(data: Buffer): FramePose {
  return { schema_version: "single-frame-pose/1", scope: "single_image", status: "no_person",
    image_sha256: createHash("sha256").update(data).digest("hex"), ...pngDimensions(data),
    model: { name: "Synthetic test fixture", sha256: "a".repeat(64), runtime: "fixture" },
    drawing_policy: "mediapipe-visible-v1", validation: "not_validated", people: [] };
}
class Response extends Writable {
  statusCode = 200;
  headers = new Map<string, string>();
  chunks: Buffer[] = [];
  setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); }
  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void) { this.chunks.push(Buffer.from(chunk)); callback(); }
  get body() { return JSON.parse(Buffer.concat(this.chunks).toString() || "null"); }
}
type Middleware = ReturnType<typeof createLocalPoseMiddleware>;
function request(middleware: Middleware, url: string, options: {
  method?: string; headers?: Record<string, string | undefined>; peer?: string; body?: Buffer; hold?: boolean;
} = {}) {
  const socket = new Socket(); Object.defineProperty(socket, "remoteAddress", { value: options.peer ?? "127.0.0.1" });
  const req = new IncomingMessage(socket); req.url = url; req.method = options.method ?? "GET";
  req.headers = { host: "127.0.0.1:5185", ...options.headers };
  const res = new Response();
  const done = new Promise<Response>((resolve, reject) => { res.once("finish", () => resolve(res)); res.once("error", reject); });
  middleware(req, res as unknown as ServerResponse, () => { res.statusCode = 418; res.end(); });
  if (!options.hold) { if (options.body) req.emit("data", options.body); req.emit("end"); }
  return { req, res, done };
}
async function fixture(runtime: PoseRuntime = { available: async () => true, infer: async image => result(image) }, timeoutMs?: number) {
  const middleware = createLocalPoseMiddleware({ runtime, timeoutMs });
  const capability = await request(middleware, "/__local_pose/capabilities").done;
  const headers = { origin: "http://127.0.0.1:5185", "content-type": "image/png", "x-pose-token": capability.body.token };
  const post = (overrides: Parameters<typeof request>[2] = {}) => request(middleware, "/__local_pose/frame", { method: "POST", body: png(), ...overrides, headers: { ...headers, ...overrides.headers } });
  return { middleware, capability, post };
}

describe("local frame inference boundary", () => {
  it("returns only capabilities and an ephemeral token, and binds result to the PNG", async () => {
    const f = await fixture(); expect(f.capability.body.available).toBe(true);
    expect(f.capability.body.token).toMatch(/^[a-f0-9]{64}$/);
    expect(f.capability.headers.get("cache-control")).toBe("no-store");
    expect(f.capability.headers.has("access-control-allow-origin")).toBe(false);
    const r = await f.post().done; expect(r.statusCode).toBe(200); expect(r.body).toEqual(result(png()));
  });
  it.each([
    { origin: "https://outside.invalid" }, { origin: undefined }, { origin: "null" },
    { host: "outside.invalid" }, { "x-pose-token": "bad" }, { "x-pose-token": "é".repeat(64) },
    { "sec-fetch-site": "cross-site" }, { referer: "https://outside.invalid" },
  ])("rejects cross-site, invalid host and token requests %s", async headers => {
    const f = await fixture(); expect((await f.post({ headers }).done).statusCode).toBe(403);
  });
  it("rejects nonloopback clients, wrong methods and non-PNG bodies", async () => {
    const f = await fixture();
    expect((await f.post({ peer: "192.168.0.1" }).done).statusCode).toBe(403);
    expect((await f.post({ method: "GET" }).done).statusCode).toBe(405);
    expect((await f.post({ headers: { "content-type": "image/jpeg" } }).done).statusCode).toBe(415);
    expect((await f.post({ body: Buffer.from("not png") }).done).statusCode).toBe(422);
    expect((await f.post({ body: png(1281) }).done).statusCode).toBe(422);
  });
  it("bounds declared and streaming request bytes before inference", async () => {
    let calls = 0; const f = await fixture({ available: async () => true, infer: async image => { calls++; return result(image); } });
    expect((await f.post({ headers: { "content-length": "4194305" } }).done).statusCode).toBe(413);
    expect((await f.post({ body: Buffer.alloc(4 * 1024 * 1024 + 1) }).done).statusCode).toBe(413);
    expect(calls).toBe(0);
  });
  it("fails closed on unavailable runtimes and sanitizes internal failures", async () => {
    const missing = await fixture({ available: async () => false, infer: async image => result(image) });
    expect((await missing.post().done).statusCode).toBe(503);
    const broken = await fixture({ available: async () => true, infer: async () => { throw new Error("/private/source/model.task"); } });
    const r = await broken.post().done; expect(r.statusCode).toBe(500); expect(JSON.stringify(r.body)).not.toContain("private");
  });
  it("refuses output bound to another image", async () => {
    const f = await fixture({ available: async () => true, infer: async () => result(png(65)) });
    expect((await f.post().done).statusCode).toBe(500);
  });
  it("allows only one pending request and disposal aborts work", async () => {
    const f = await fixture(); const pending = f.post({ hold: true });
    expect((await f.post().done).statusCode).toBe(409);
    f.middleware.dispose(); pending.req.emit("end"); pending.res.end();
    expect((await f.post().done).statusCode).toBe(200);
  });
  it("aborts native work on client disconnect", async () => {
    let started!: () => void; const entered = new Promise<void>(resolve => { started = resolve; });
    let aborted = false;
    const f = await fixture({ available: async () => true, infer: async (_image, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }); started();
    }) });
    const pending = f.post(); await entered; pending.req.emit("aborted");
    await Promise.resolve(); expect(aborted).toBe(true); pending.res.end();
  });
  it("times out a stalled body and releases the slot", async () => {
    const f = await fixture(undefined, 10); const pending = f.post({ hold: true });
    expect((await pending.done).statusCode).toBe(504);
    expect((await f.post().done).statusCode).toBe(200);
  });
  it("removes unspecified fields and rejects invalid coordinates", () => {
    const value = { ...result(png()), secret_path: "/private/path" };
    expect(validateFramePose(value, png())).not.toHaveProperty("secret_path");
    expect(() => validateFramePose({ ...value, width: Infinity }, png())).toThrow();
    expect(() => validateFramePose({ ...value, image_sha256: "f".repeat(64) }, png())).toThrow();
  });
});

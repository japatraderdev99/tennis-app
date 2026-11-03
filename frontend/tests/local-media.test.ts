import { createHash } from "node:crypto";
import { mkdtemp, writeFile, stat, symlink, rm } from "node:fs/promises";
import { IncomingMessage, type ServerResponse } from "node:http";
import { Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalMediaMiddleware, parseByteRange } from "../dev/localMedia";

/** Bytes here are artificial transport fixtures, never usable athlete media. */
const bytes = Buffer.from("0123456789");
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

async function identity(filename: string) {
  const s = await stat(filename, { bigint: true });
  return { size_bytes: Number(s.size), mtime_ns: String(s.mtimeNs), ctime_ns: String(s.ctimeNs),
    dev: String(s.dev), ino: String(s.ino), sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tennis-local-media-")); directories.push(directory);
  const video = path.join(directory, "private-input.mp4"); const poster = path.join(directory, "private-poster.jpg");
  const manifest = path.join(directory, "local-library.json");
  await writeFile(video, bytes); await writeFile(poster, bytes);
  const item = { id: "a".repeat(24), title: "Synthetic transport fixture", path: video, poster_path: poster,
    duration_seconds: 1, width: 64, height: 64, size_bytes: bytes.length, edited: true,
    identity: await identity(video), poster_identity: await identity(poster) };
  await writeFile(manifest, JSON.stringify({ version: 1, videos: [item] }));
  return { directory, video, poster, manifest, item };
}

class Response extends Writable {
  statusCode = 200;
  headersSent = false;
  headers = new Map<string, string | number>();
  chunks: Buffer[] = [];
  setHeader(name: string, value: string | number) { this.headers.set(name.toLowerCase(), value); return this; }
  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.headersSent = true; this.chunks.push(Buffer.from(chunk)); callback();
  }
  get body() { return Buffer.concat(this.chunks).toString(); }
}

async function request(manifest: string, url: string, options: {
  method?: string; headers?: Record<string, string | undefined>; peer?: string;
} = {}) {
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: options.peer ?? "127.0.0.1" });
  const req = new IncomingMessage(socket);
  req.method = options.method ?? "GET"; req.url = url;
  req.headers = { host: "127.0.0.1:5185", ...options.headers };
  const res = new Response();
  const done = new Promise<void>((resolve, reject) => { res.on("finish", resolve); res.on("error", reject); });
  createLocalMediaMiddleware(manifest)(req, res as unknown as ServerResponse, () => { res.statusCode = 418; res.end(); });
  await done;
  return res;
}

describe("private local catalog", () => {
  it("returns an empty catalog when no private manifest exists", async () => {
    const f = await fixture();
    const res = await request(path.join(f.directory, "missing.json"), "/__local_media/catalog");
    expect(res.statusCode).toBe(200); expect(JSON.parse(res.body)).toEqual({ version: 1, videos: [] });
  });
  it("publishes only presentation data and opaque media URLs", async () => {
    const f = await fixture(); const res = await request(f.manifest, "/__local_media/catalog");
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.videos[0].media_url).toBe(`/__local_media/${f.item.id}/video`);
    expect(data.videos[0].poster_url).toBe(`/__local_media/${f.item.id}/poster`);
    expect(res.body).not.toContain(f.directory); expect(res.body).not.toContain("identity");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(res.headers.has("access-control-allow-origin")).toBe(false);
  });
  it("does not intercept unrelated Vite requests", async () => {
    const f = await fixture(); expect((await request(f.manifest, "/src/main.tsx")).statusCode).toBe(418);
  });
  it.each([
    "/artifacts/local-library.json", "/artifacts/local-library.json?raw", "/src/../artifacts/local-library.json",
    "/artifacts%2Flocal-library.json", "/artifacts%252Flocal-library.json", "/ARTIFACTS/local-library.json",
    "/@fs/private/local-library.json", "/%40fs/private/local-library.json",
  ])("blocks private Vite/static escape %s", async url => {
    const f = await fixture(); const res = await request(f.manifest, url);
    expect(res.statusCode).toBe(403); expect(res.body).not.toContain(f.directory);
  });
  it("protects a custom manifest inside Vite root and its prepared poster directory", async () => {
    const configured = fileURLToPath(new URL("../private/library.json", import.meta.url));
    expect((await request(configured, "/private/library.json?raw")).statusCode).toBe(403);
    expect((await request(configured, "/private/library-posters/frame.jpg")).statusCode).toBe(403);
  });
  it.each([
    { headers: { host: "attacker.invalid:5185" } },
    { headers: { origin: "https://attacker.invalid" } },
    { headers: { origin: "null" } },
    { headers: { referer: "https://attacker.invalid/embed" } },
    { headers: { "sec-fetch-site": "cross-site" } },
    { peer: "192.168.1.40" },
  ])("rejects an unauthorized requester %#", async options => {
    const f = await fixture(); const res = await request(f.manifest, "/__local_media/catalog", options);
    expect(res.statusCode).toBe(403); expect(res.body).not.toContain(f.directory);
  });
  it("allows loopback requests from the exact same origin", async () => {
    const f = await fixture();
    expect((await request(f.manifest, "/__local_media/catalog", { headers: { origin: "http://127.0.0.1:5185" } })).statusCode).toBe(200);
  });
  it.each(["/../private-input.mp4", "/%2e%2e/private-input.mp4", "/%2fetc%2fpasswd", `/${"a".repeat(24)}/video/extra`])(
    "does not accept paths or traversal: %s", async suffix => {
      const f = await fixture(); expect((await request(f.manifest, `/__local_media${suffix}`)).statusCode).toBe(404);
    },
  );
  it("rejects mutation methods", async () => {
    const f = await fixture(); const res = await request(f.manifest, "/__local_media/catalog", { method: "POST" });
    expect(res.statusCode).toBe(405); expect(res.headers.get("allow")).toBe("GET, HEAD");
  });
  it("refuses changed media, including catalog readback, without leaking a path", async () => {
    const f = await fixture(); await writeFile(f.video, "changed bytes");
    for (const url of ["/__local_media/catalog", `/__local_media/${f.item.id}/video`]) {
      const res = await request(f.manifest, url);
      expect(res.statusCode).toBe(409); expect(res.body).not.toContain(f.directory);
    }
  });
  it("does not follow a media symlink even with otherwise matching metadata", async () => {
    const f = await fixture(); const alias = path.join(f.directory, "alias.mp4"); await symlink(f.video, alias);
    await writeFile(f.manifest, JSON.stringify({ version: 1, videos: [{ ...f.item, path: alias }] }));
    expect((await request(f.manifest, `/__local_media/${f.item.id}/video`)).statusCode).toBe(409);
  });
  it("fails closed on corrupt manifest and rejects symlink manifest", async () => {
    const f = await fixture(); await writeFile(f.manifest, "broken JSON");
    expect((await request(f.manifest, "/__local_media/catalog")).statusCode).toBe(409);
    const alias = path.join(f.directory, "alias.json"); await symlink(f.manifest, alias);
    expect((await request(alias, "/__local_media/catalog")).statusCode).toBe(409);
  });
});

describe("byte streaming", () => {
  it("serves full bytes without loading the whole source into memory", async () => {
    const f = await fixture(); const res = await request(f.manifest, `/__local_media/${f.item.id}/video`);
    expect(res.statusCode).toBe(200); expect(res.body).toBe(bytes.toString());
    expect(res.headers.get("content-length")).toBe(10); expect(res.headers.get("content-type")).toBe("video/mp4");
  });
  it.each([
    ["bytes=2-4", "234", "bytes 2-4/10"], ["bytes=8-", "89", "bytes 8-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"], ["bytes=7-999", "789", "bytes 7-9/10"],
  ])("honors %s", async (range, expected, contentRange) => {
    const f = await fixture(); const res = await request(f.manifest, `/__local_media/${f.item.id}/video`, { headers: { range } });
    expect(res.statusCode).toBe(206); expect(res.body).toBe(expected); expect(res.headers.get("content-range")).toBe(contentRange);
    expect(res.headers.get("content-length")).toBe(expected.length);
  });
  it.each(["bytes=10-", "bytes=8-2", "bytes=-0", "bytes=0-1,4-5", "items=0-1", "bytes=", "bytes=9007199254740992-"])(
    "rejects invalid/unsupported range %s", async range => {
      const f = await fixture(); const res = await request(f.manifest, `/__local_media/${f.item.id}/video`, { headers: { range } });
      expect(res.statusCode).toBe(416); expect(res.headers.get("content-range")).toBe("bytes */10");
    },
  );
  it("HEAD returns equivalent headers without a body", async () => {
    const f = await fixture(); const url = `/__local_media/${f.item.id}/video`;
    const full = await request(f.manifest, url, { method: "HEAD" });
    expect(full.statusCode).toBe(200); expect(full.body).toBe(""); expect(full.headers.get("content-length")).toBe(10);
    const partial = await request(f.manifest, url, { method: "HEAD", headers: { range: "bytes=1-3" } });
    expect(partial.statusCode).toBe(206); expect(partial.body).toBe(""); expect(partial.headers.get("content-length")).toBe(3);
  });
  it("serves posters and rejects a poster changed since preparation", async () => {
    const f = await fixture(); const url = `/__local_media/${f.item.id}/poster`;
    const res = await request(f.manifest, url);
    expect(res.statusCode).toBe(200); expect(res.headers.get("content-type")).toBe("image/jpeg");
    await writeFile(f.poster, "modified"); expect((await request(f.manifest, url)).statusCode).toBe(409);
  });
  it("a missing Range means a full response", () => { expect(parseByteRange(undefined, 10)).toBeNull(); });
});

import { constants } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import type { CatalogVideo, LocalCatalog } from "../src/local/types";

const PREFIX = "/__local_media/";
const FRONTEND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_MANIFEST = fileURLToPath(new URL("../artifacts/local-library.json", import.meta.url));
const ID = /^[a-f0-9]{24}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const DECIMAL = /^\d+$/;
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finitePositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

interface Identity {
  size_bytes: number; mtime_ns: string; ctime_ns: string; dev: string; ino: string; sha256: string;
}
interface PrivateVideo {
  id: string; title: string; path: string; poster_path: string | null;
  duration_seconds: number; width: number; height: number; size_bytes: number; edited: boolean;
  identity: Identity; poster_identity: Identity | null;
}
interface PrivateCatalog { version: 1; videos: PrivateVideo[] }

function identity(value: unknown): value is Identity {
  if (!plain(value)) return false;
  return Number.isSafeInteger(value.size_bytes) && (value.size_bytes as number) > 0
    && ["mtime_ns", "ctime_ns", "dev", "ino"].every(k => typeof value[k] === "string" && DECIMAL.test(value[k]))
    && typeof value.sha256 === "string" && DIGEST.test(value.sha256);
}

function validateManifest(value: unknown): PrivateCatalog {
  if (!plain(value) || value.version !== 1 || !Array.isArray(value.videos) || value.videos.length > 256) throw new Error("invalid_manifest");
  const ids = new Set<string>();
  for (const v of value.videos) {
    if (!plain(v) || typeof v.id !== "string" || !ID.test(v.id) || ids.has(v.id)
      || typeof v.title !== "string" || !v.title.trim() || v.title.length > 180 || /[\x00-\x1f]/.test(v.title)
      || typeof v.path !== "string" || !path.isAbsolute(v.path) || !/\.(mp4|mov)$/i.test(v.path)
      || !finitePositive(v.duration_seconds) || !Number.isSafeInteger(v.width) || (v.width as number) <= 0
      || !Number.isSafeInteger(v.height) || (v.height as number) <= 0 || typeof v.edited !== "boolean"
      || !identity(v.identity) || v.size_bytes !== v.identity.size_bytes
      || !(v.poster_path === null && v.poster_identity === null
        || typeof v.poster_path === "string" && path.isAbsolute(v.poster_path) && /\.jpg$/i.test(v.poster_path) && identity(v.poster_identity))) {
      throw new Error("invalid_manifest");
    }
    ids.add(v.id);
  }
  return value as unknown as PrivateCatalog;
}

async function readManifest(filename: string): Promise<PrivateCatalog> {
  let file: FileHandle;
  try { file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, videos: [] }; throw error; }
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 1_048_576) throw new Error("invalid_manifest");
    return validateManifest(JSON.parse(await file.readFile("utf8")));
  } finally { await file.close(); }
}

/** Prepared identities are checked on an opened descriptor, not merely a path. */
async function openVerified(filename: string, expected: Identity): Promise<FileHandle> {
  const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = await file.stat({ bigint: true });
    if (!s.isFile() || s.size.toString() !== String(expected.size_bytes)
      || s.mtimeNs.toString() !== expected.mtime_ns || s.ctimeNs.toString() !== expected.ctime_ns
      || s.dev.toString() !== expected.dev || s.ino.toString() !== expected.ino) throw new Error("file_changed");
    return file;
  } catch (error) { await file.close(); throw error; }
}

export function parseByteRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size <= 0) throw new Error("invalid_range");
  let start: number; let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new Error("invalid_range");
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) throw new Error("invalid_range");
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

/** Reject LAN peers, DNS rebinding hosts and cross-origin embedding/fetches. */
export function isLocalRequest(req: IncomingMessage): boolean {
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "")) return false;
  const host = req.headers.host;
  if (!host || !/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(host)) return false;
  let origin: string;
  try { origin = new URL(`http://${host}`).origin; } catch { return false; }
  const originHeader = req.headers.origin;
  if (originHeader !== undefined && originHeader !== origin) return false;
  const referer = req.headers.referer;
  if (referer) { try { if (new URL(referer).origin !== origin) return false; } catch { return false; } }
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  return true;
}

function publicVideo(v: PrivateVideo): CatalogVideo {
  return { id: v.id, title: v.title, duration_seconds: v.duration_seconds, width: v.width,
    height: v.height, size_bytes: v.size_bytes, edited: v.edited,
    media_url: `${PREFIX}${v.id}/video`, poster_url: v.poster_path ? `${PREFIX}${v.id}/poster` : null };
}

export function createLocalMediaMiddleware(manifestPath = process.env.TENNIS_LOCAL_LIBRARY || DEFAULT_MANIFEST) {
  const relativeManifest = path.relative(FRONTEND_ROOT, path.resolve(manifestPath)).replaceAll(path.sep, "/");
  const manifestUrl = relativeManifest.startsWith("../") ? null : `/${relativeManifest}`.toLowerCase();
  const posterPrefix = manifestUrl?.replace(/\.[^/.]+$/, "-posters/");
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const rawPath = (req.url ?? "").split("?")[0]!;
    // Vite serves files under its root, including untracked artifacts. Keep this
    // private store unavailable through static URLs, raw imports and /@fs aliases.
    let decoded = rawPath;
    try {
      decoded = decodeURIComponent(decodeURIComponent(decoded));
      decoded = new URL(decoded, "http://127.0.0.1").pathname.toLowerCase();
    } catch { decoded = "/artifacts/invalid-path"; }
    const privatePath = /^\/+artifacts(?:\/|$)/.test(decoded) || /^\/+@fs(?:\/|$)/.test(decoded)
      || decoded === manifestUrl || !!posterPrefix && decoded.startsWith(posterPrefix);
    if (!rawPath.startsWith(PREFIX) && !privatePath) { next(); return; }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    const json = (status: number, value: unknown) => {
      if (res.destroyed) return;
      const body = JSON.stringify(value);
      res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Length", Buffer.byteLength(body)); res.end(req.method === "HEAD" ? undefined : body);
    };
    if (privatePath) { json(403, { code: "private_files_unavailable" }); return; }
    if (!isLocalRequest(req)) { json(403, { code: "local_access_only" }); return; }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD"); json(405, { code: "read_only" }); return;
    }
    const serve = async () => {
      const catalog = await readManifest(manifestPath);
      if (rawPath === `${PREFIX}catalog`) {
        for (const item of catalog.videos) { const file = await openVerified(item.path, item.identity); await file.close(); }
        const publicCatalog: LocalCatalog = { version: 1, videos: catalog.videos.map(publicVideo) };
        json(200, publicCatalog); return;
      }
      const match = /^\/__local_media\/([a-f0-9]{24})\/(video|poster)$/.exec(rawPath);
      const item = match && catalog.videos.find(v => v.id === match[1]);
      if (!match || !item) { json(404, { code: "not_found" }); return; }
      const poster = match[2] === "poster";
      const filename = poster ? item.poster_path : item.path;
      const expected = poster ? item.poster_identity : item.identity;
      if (!filename || !expected) { json(404, { code: "not_found" }); return; }
      const file = await openVerified(filename, expected);
      if (req.aborted || res.destroyed) { await file.close(); return; }
      let range: ReturnType<typeof parseByteRange>;
      try { range = parseByteRange(req.headers.range, expected.size_bytes); }
      catch {
        await file.close(); res.setHeader("Content-Range", `bytes */${expected.size_bytes}`);
        json(416, { code: "invalid_range" }); return;
      }
      res.statusCode = range ? 206 : 200;
      res.setHeader("Content-Type", poster ? "image/jpeg" : /\.mov$/i.test(filename) ? "video/quicktime" : "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", range ? range.end - range.start + 1 : expected.size_bytes);
      if (range) res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${expected.size_bytes}`);
      if (req.method === "HEAD") { await file.close(); res.end(); return; }
      const stream = file.createReadStream(range ? { start: range.start, end: range.end } : {});
      stream.on("error", () => { res.destroy(); });
      req.once("aborted", () => stream.destroy());
      res.once("close", () => stream.destroy());
      stream.pipe(res);
    };
    void serve().catch(() => { if (!res.headersSent) json(409, { code: "local_library_unavailable" }); else res.destroy(); });
  };
}

/** Development/preview only: the production build never embeds a private catalog. */
export function localMediaPlugin(): Plugin {
  return {
    name: "tennis-private-local-media",
    configureServer(server) { server.middlewares.use(createLocalMediaMiddleware()); },
    configurePreviewServer(server) { server.middlewares.use(createLocalMediaMiddleware()); },
  };
}

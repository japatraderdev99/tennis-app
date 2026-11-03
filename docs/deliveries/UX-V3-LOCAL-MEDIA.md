# UX V3 — private local media bridge

Scope: read-only development/preview bridge and preparation script. No scientific
API, upload, model inference or production storage was added. Original files are
opened read-only. Only synthetic transport fixtures are used in automated tests.

## Head integration

In `frontend/vite.config.ts`, import `localMediaPlugin` from `./dev/localMedia` and
append `localMediaPlugin()` to `plugins`. Keep Vite bound to `127.0.0.1`.

From `frontend/`, prepare a new ignored private manifest:

```sh
python3 scripts/prepare-local-library.py --output artifacts/local-library.json \
  --video /absolute/path/to/first.mp4 --video /absolute/path/to/second.mp4
```

The output path must not exist. To use another manifest, set environment variable
`TENNIS_LOCAL_LIBRARY` **before starting Vite**. Default is
`frontend/artifacts/local-library.json`. No frontend `.env` variable or `VITE_*`
variable is needed; private filesystem paths must never enter client bundles.

The preparer accepts regular non-symlink MP4/MOV files, checks exactly one video
stream, hashes bytes, and generates a JPEG from each file. It stores exact file
identity (size, nanosecond mtime/ctime, device and inode) and SHA-256 alongside the
private paths. The manifest is written last, exclusively; a failed preparation
does not offer a partial catalog. Partial posters are left for inspection rather
than deleting output silently. Source bytes are not changed or copied into Git.

## Public endpoints

- `GET /__local_media/catalog`: presentation metadata plus opaque media/poster URLs.
  A missing private manifest returns `{ "version": 1, "videos": [] }`.
- `GET/HEAD /__local_media/<id>/video` and `/poster`: full or single-range bytes,
  `Accept-Ranges`, correct Content-Length/Content-Range and 416 for invalid ranges.
- Changes since preparation yield a generic 409. Unknown IDs and traversal yield
  404, non-read methods 405, unauthorized origins/peers 403. No path enters errors.

Requests must come from a loopback peer and host. Origin/Referer, when present,
must exactly match the local origin; cross-site requests are refused. No CORS
allow header is emitted. Responses use no-store, nosniff and same-origin resource
policy. Video descriptors are streamed; the bridge does not buffer full videos.

The bridge blocks `/artifacts/**`, the configured in-root manifest/poster directory,
and `/@fs/**` aliases so Vite's static-file fallback cannot disclose the private
manifest. Keep originals outside the frontend's public/source folders. This app
does not need `/@fs` imports; future external source modules would need a reviewed
allowlist rather than removing this guard. The production build embeds no library.

## Validation

- 42 Vitest transport tests: normal/suffix/open-ended ranges, HEAD, malformed and
  multi-ranges, missing/corrupt/symlink manifests, cross-origin and LAN requests,
  changed media/posters, traversal, static escapes and public-field redaction.
- Python smoke with a generated one-second H.264 clip: manifest/JPEG created,
  source hash preserved, overwrite and source symlink refused.
- Python syntax compilation and full TypeScript check passed. Head runs final
  application integration/build and real-media browser checks.

The fixture bytes in transport tests are artificial and do not establish browser
codec support. The head must exercise actual local exports in the browser. This
bridge is a local pilot, not an isolation boundary for hostile uploads or an
authentication service. Playback duration does not establish original source PTS.

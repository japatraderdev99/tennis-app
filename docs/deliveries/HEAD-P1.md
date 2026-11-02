# Head acceptance — local foundation, 2026-11-01

## Accepted builder deliveries

| Front | Final builder commit | Scope |
|---|---|---|
| BE-01 | aa401de8ddb3b2eb6fc6ec243e0c485f32551d1c | Strict contracts, schemas, examples, states |
| BE-02 | b8623db768dcc6c7da55b4f59087fd985d0327b1 | Bounded local media inspection and actual PTS |
| DS-01 | 9d48df7126a9b770eec08b8982eea30fd8d50ddf | Deterministic M01 on supplied annotations |

Merged in that order into `integrate/p1-foundation`, retaining each branch/commit.
Head added the pipeline, local CLI, synthetic demonstration and integration tests.
Independent reviews inspected the geometry, native process limitations and
contract boundaries; targeted adversarial checks found no outstanding blocker
in those reviewed paths. This is scoped review, not a production security audit.

## Integration decisions and fixes

- A one-frame phase remains representable input but returns insufficient evidence.
  At least two usable frames are required for a computed result. Updated the
  contract model, schema and fixture to agree with DS-01; documented this
  clarification in the frozen addendum. This is a technical policy, not calibration.
- Validate the complete annotation timeline against the actual media manifest,
  then check result asset, side, phase, provenance, phase series and evidence.
- Internal numerical result and product-facing report remain separate. The latter
  keeps its metric value null for both research-only and inadequate evidence.
- Each invocation gets a fresh run/report ID; repeated numerical output is stable.
- Read annotation JSON through a regular-file descriptor with a 16 MiB bound.
- Write only new bundle directories. Include the optional source copy's hash in
  the checksum manifest and write the completion marker last; a failed copy
  cannot leave a complete marker. Existing output is never overwritten.

## Acceptance evidence

```text
uv run --frozen --offline --cache-dir /private/tmp/tennis-uv-cache pytest -q
674 passed in 3.58s

uv run --frozen --offline --cache-dir /private/tmp/tennis-uv-cache \
  python scripts/demo_synthetic.py artifacts/p1-synthetic-2026-11-01
PASS — actual FFprobe timeline, supplied synthetic 90-degree geometry,
internal research result, null public value, retained synthetic video.

git diff --check
PASS
```

Integration checks cover mismatched assets/time bases, altered/shortened timelines,
forged but individually valid research provenance, absent peak evidence,
one-frame phase, fresh execution identities, public numeric leakage, CLI behavior,
FIFO/oversize annotation files, checksums, failed source copy and no overwrites.
No media test was skipped in this environment. Source videos in the parent
workspace were not used or modified by this implementation.

The demo is a solid-color video and explicitly supplied points. There is no tennis
player, pose estimator, automatic phase detection, athlete benchmark or valid
personalized metric. The experimental 90 degrees verifies known arithmetic only.

## Limits and next gate

Local POSIX Python library/CLI only; FFmpeg/FFprobe 8.1.1 in the test environment.
No HTTP API, durable job queue, database, auth, mobile app, cloud deployment,
model weights or real-user data. Native process limits are not an OS sandbox.
Output directories can be partial on local I/O failure; absence of checksums
means incomplete. Exported bundles are internal lab files, not public endpoints.

Next planned wave is API/persistence design plus a licensed pose-adapter experiment
with a pre-registered validation protocol. Frontend handoff waits for that service
contract and uses only approved display states. Claude owns UX/UI/frontend.
All user-facing biomechanical measurements remain unreleased.

Find the head implementation commit with:
`git log -1 --format=%H -- docs/deliveries/HEAD-P1.md`.
The Obsidian operational board records the final main/tag/archive checkpoint.

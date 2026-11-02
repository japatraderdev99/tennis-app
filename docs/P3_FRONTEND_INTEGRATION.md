# P3 — boundary between the UX prototype and the real backend

Date: 2026-11-02. Owner: Codex, backend/data science. This is the head's integration
design following review of Claude's `feat/ux-ui-v1`, commit `b84fa3a`, based on
`88ffd73`. It specifies new work; no endpoints in this document are implemented.
Existing P1/P2 scientific contracts remain unchanged. Claude owns UX/UI/frontend.

## Acceptance and evidence

The frontend is accepted as a local simulated navigation prototype, with review
items below. It is not accepted as a real-media client, accessible production app,
validated measurement system or completed practitioner study.

Independent head/team checks reproduced 36 unit tests, production build, 11
Chromium/Pixel-viewport journeys, and all 6 exported seedable scenarios against
Python `select_target`, `PublicReport` and `PoseArtifact`. The 1,077-test backend
suite was reported by Claude; this review did not rerun that unchanged suite.
Manual inspection preserved portrait-video proportions at 393x851 and 844x390.
No physical phone, Safari/iOS, real screen reader, sunlight or practitioner test.

## Required changes to the proposed boundary

### 1. Upload precedes verified asset identity

Reserve `session_id` and `upload_id` first. Before received bytes are inspected,
the confirmed `asset_id`, duration and dimensions are null. Client-provided name,
size or duration are declarations, not server-verified metadata. `ready` means
inspection succeeded, not merely that an upload progress bar reached its end.
Track bytes transmitted and bytes acknowledged separately when resuming.

### 2. Bind selection to immutable candidate evidence

An ID such as `detection_id: "0"` is local to a frame in one inference artifact.
It cannot identify a person across a fresh detector run.

Introduce a bounded preview job and an immutable `candidate_set_id`/revision.
An accepted candidate set binds:

- Session, owner, verified asset hash/object generation and source stream.
- Model/configuration and source detection-artifact revision.
- Original frame index, integer PTS/time_base and detection ID.
- Display dimensions, orientation/scale/crop transform and the exact preview image.

The analysis request references that candidate set and the chosen candidate.
Reject stale, cross-asset, missing or mismatched candidates; do not interpret an
old index in a new inference result. The worker must reuse the selected detection
evidence or establish explicit, unambiguous correspondence to a versioned analysis
artifact. For temporal models, the initialization/cache strategy is part of this
gate; matching model filenames alone does not establish identical detections.

Preview generation is a job mutation. Reading `seed-options` is a read of cached
state, not an unbounded trigger to rerun inference. Return pending/ready/failed
explicitly. Begin with a small configurable frame budget; benchmark candidate
availability, model cold start, decode cost and repeated requests before choosing
the pilot default. No cheap/instant preview performance claim exists yet.

### 3. Version runs and make retries explicit

Mutations identify the observed `run_id` or expected session revision, not an
implicit latest run. Use operation-specific idempotency keys. A retry/reselection
creates a new run and references its parent. Cancellation targets one run;
deletion targets the session and all its associated attempts/artifacts.

Compose reselections on the backend as disjoint, ordered source-frame segments.
The newest applicable explicit seed owns its interval, including `lost` and
`ambiguous` states. It must not fall back to an older selected identity. Keep the
unobserved gap and each seed/run provenance. Do not copy the mock's generalized
`mergeSelections` rule into the service.

### 4. Real playback needs a media interface

The mock's synchronous `FramePainter.paint(frameIndex)` and independent animation
clock do not confirm that a real video frame has decoded or been presented.
Separate `ApiClient` from a media playback adapter with asynchronous readiness,
seek completion, presented-frame information, failure and disposal. HTTP changes
alone will not satisfy this integration.

A versioned replay/media manifest binds the derivative to its source and records
source frame_index/PTS/time_base, presentation mapping and display transformations.
Scientific time remains source evidence. Playback time is only the player's
timeline. A sparse array position is not a source frame index.

For web experiments, `requestVideoFrameCallback` exposes the presented frame's
media timestamp; it offers best-effort scheduling, not guaranteed delivery of
every source frame. See the [WICG specification](https://wicg.github.io/video-rvfc/).
Hide the overlay when the presented frame cannot be matched reliably. Test VFR,
nonzero source start, rotation, resizing, seek and delayed presentation using a
synthetic encoded clip with known frame marks. Evaluate all-intra or explicit
frame images only if measured seeking behavior requires them.

Without a trustworthy source mapping, allow ordinary media-only playback where
decodable, with no inferred overlay or biomechanical time metric. Never fabricate
source PTS from FPS. Valid PTS alone does not establish physical capture speed;
slow motion/retiming and unknown capture rate remain separate states.

### 5. Observability is not a capture-quality verdict

Add `not_assessed` and evidence scope to capture assessment. Record which checks
actually ran and the frames they covered. An empty issues list is insufficient
to conclude that the whole video has no filming problems.

Existing outputs support statements about detection absence in processed frames,
association loss/ambiguity/gaps and missing/nonmonotonic PTS. They do not support
automatic `feet_out_of_frame` as a verified cause from a weak/missing/outlying
estimated ankle alone. Unknown is explicit. Avoid implying a universal evaluation
of filming quality when only these checks ran.

Public drawing policy belongs to the backend, with a version per adapter/profile.
Keep raw research points internally; return paired nulls when a point is not
drawable. No clipping or interpolation to invent evidence. Native scores and
visibility/presence are not public accuracy. The mock threshold 0.5 is not adopted
as a validated threshold. Define coverage using drawable points/edges rather than
only a non-null keypoint array.

### 6. Deletion must cover outstanding access

Use durable cancellation/deletion state and publication fencing so stale workers
cannot republish data. `access_blocked` must identify the scope actually revoked;
`deleted` must state whether it concerns active storage or also retention copies.

An already issued GCS signed URL can be used by its holder during its validity;
an API flag alone does not revoke it. See [GCS signed URLs](https://docs.cloud.google.com/storage/docs/access-control/signed-urls).
Choose and test the media-access/revocation strategy, object generations, caches
and in-flight requests before promising immediate revocation. Already downloaded
copies cannot be recalled. Backup removal times remain an explicit product policy
decision, not a fabricated countdown.

## Frontend follow-up for Claude

1. Make `verify_against_backend.py` reject missing/empty/incomplete fixture sets;
   require the current six named seedable scenarios and print checked counts.
2. Offer media-only replay directly after failed/cancelled analysis and from history.
3. Give a later seed authority after its start even when it is lost. Add an overlap
   regression; existing six parity cases exercise individual selection only.
4. Restore meaningful hit-target/occlusion/focus checks instead of using element
   height as a replacement for the disabled `target-size` audit.
5. Prepare async errors/loading/stale responses and the media interface above.
6. Keep demo labels and synthetic media; do not enable real imports by attaching
   mock landmarks. Restrict generic capture/error copy to evidence-supported claims.

These are review requests, not changes made to Claude's code by this document.
No frontend merge or push occurred in this review.

## Operational sequence

| Step | Owner | Deliverable | Acceptance gate |
|---|---|---|---|
| P3-A | Codex | Strict versioned upload, preview/seed, run, replay and deletion envelopes | Synthetic valid/invalid cases; binding and identity invariants; PublicReport unchanged |
| P3-B | Codex | Local API and durable job/session lifecycle | Ownership, idempotency, crash recovery, run-specific cancel, delete fencing; no cloud dependency |
| P3-C | Codex | Bounded real-media preview and processing worker, replay mapping | Cached candidate consistency; known-frame sync fixture; limits and failure paths |
| UX follow-up | Claude | Corrections above and media-adapter seam | Existing journeys plus regression cases, no mock/real mixing |
| Integration | Both heads | Real local API + frontend | Full route with synthetic fixtures, then authorized private clips |
| Usability/capture | User + Claude, protocol reviewed by both heads | Physical phone and unassisted practitioner sessions | Observed comprehension, mistaken interpretations and failures recorded |
| Provider pilot | Codex after local gate | Linux/container and Supabase/GCP | Accounts, budget, retention, recovery and operational evidence defined |

No platform migration, new model training or scientific metric promotion is
required to start P3-A/B. The capture hypothesis for M01 remains lateral per the
existing metric definition. Posterior/oblique videos are useful for pose/replay
experiments, not evidence of lateral-M01 eligibility. EXP-001 must keep these
objectives separate and record capture conditions without a universal-angle claim.

The browser prototype can support a formative comprehension study before real
uploads. That study does not validate camera feasibility or measurement accuracy.
Sample size and success thresholds remain protocol choices; a small formative
round cannot establish population-level product effectiveness.

# Executable scope 0.1.0 — frozen interface, 2026-11-01

This addendum closes implementation ambiguities in the approved Obsidian v0.1.
It authorizes only a local technical foundation. Human validation, a pose model,
HTTP service, authentication, durable jobs, storage service and UI are later gates.
All mappings below are JSON-compatible dicts; validate with strict Pydantic models
at boundaries. `schema_version` is the literal `0.1.0`; unknown fields are forbidden.
Integer means a JSON integer (not bool); finite numbers only. IDs are nonempty
strings. SHA256 is 64 lowercase hex characters. Fields listed are required even
when nullable. Lists of reasons have stable, nonempty snake_case codes.

## 1. States and errors

Asset lifecycle: `importing -> ready | rejected`. These describe local import,
not a simulated upload endpoint. Analysis lifecycle: `queued -> running ->
succeeded | failed | cancelled`; queued may also cancel. Terminals cannot restart;
a retry gets a new run ID. `running -> cancelled` is allowed. Scientific eligibility
is independent of execution state: a successful run may have no usable metric.
Deletion states are reserved for a future service and are not pretended in v0.1.
Pure `can_transition(resource, from_state, to_state) -> bool`; unknowns return false.

Error dict: `{schema_version, code, message, retryable, details}`. `details` is a
JSON object; message is nonempty; no absolute private paths or command stderr dump.
Media raises `MediaError` with `.code` and `.to_dict()` matching this envelope.
Invalid research input may raise `ValueError`; valid but inadequate observations
return `insufficient_evidence`. No generic catch-and-return-success.

## 2. Media interface (BE-02)

Module `tennis_backend.media`; export `inspect_media(path, *, limits=None) -> dict`,
`MediaLimits`, `MediaError`. Local regular video file only, read-only inspection.
Do not copy, transcode, mutate or hash unrelated workspace files.

MediaManifest shape:

```
{
 schema_version, asset_id, sha256, byte_size, source_name,
 stream_index, codec_name, coded_width, coded_height,
 sample_aspect_ratio, rotation_degrees, time_base,
 duration_seconds, nominal_fps, average_fps,
 frames: [{frame_index, pts, time_seconds}],
 quality_reasons, timing_basis: "original_pts",
 temporal_resolution: "not_established",
 tool: {name: "ffprobe", version}
}
```

`asset_id = "sha256:" + sha256`; source_name is basename only. stream_index>=0;
dimensions/byte_size positive integers. Select first video stream (exclude attached
pictures); document selection. Ratios use exact rational strings `num/den` with
nonzero denominator; time_base must be positive. sample_aspect_ratio nullable if
unknown. rotation_degrees finite or null if unavailable/ambiguous; do not guess
that absent metadata proves physical orientation. fps and duration nullable finite
nonnegative numbers (FPS >0 when known), descriptive only. codec_name nonempty.

Frame index is presentation order starting at zero; pts integer or null if absent;
time_seconds = pts * rational time_base or null. Use original frame `pts`, not
best_effort_timestamp silently. Keep nonzero starting PTS. Missing/nonmonotonic
PTS produces a quality reason and remains inspectable; downstream metric refuses
that timeline. Do not invent timestamps. Duplicate image content is not detected
by this module; nominal FPS never claims unique information per frame.

No coordinate conversion is implied by this manifest. Encoded pixels and corrected
display pixels are distinct. Rotation/SAR metadata are recorded; metric input is
explicitly annotated in an already corrected display plane.

Limits are technical resource ceilings, not scientific thresholds: max_bytes,
max_duration_seconds, max_frames, timeout_seconds, max_output_bytes; choose and
document conservative defaults. Bound FFprobe output while reading (not only
after unbounded capture), process lifetime, local protocols and demuxers. Reject
URLs, playlists and unsupported indirect formats; permit common self-contained
MOV/MP4/Matroska/AVI containers with no external tracks/references. Whitelist
demuxers and protocols, reject external data references; explain residual limits
of native decoder inspection. Reject files changed during inspection. Handle spaces
in filenames. Exceeding a limit must not yield a silently truncated success.

## 3. Research input (DS-01)

Module `tennis_backend.metrics`; export `compute_m01(payload: dict) -> dict` and
`normalized_to_display_pixels(x, y, width, height) -> tuple[float,float]`.
No imports from BE-01 or BE-02 during parallel build. Integration later validates
dicts using the contract models. Standalone metrics still checks its own preconditions.

```
{
 schema_version, asset_id, time_base,
 display_width, display_height, coordinate_space: "display_pixels",
 transforms: [nonempty strings],
 body_side: "left" | "right", phase_id: "serve_preparation",
 phase_window: {start_pts, end_pts},
 timeline: [{frame_index, pts}],
 observations: [{frame_index, pts, hip, knee, ankle}],
 provenance: {kind: "synthetic" | "manual", protocol_id, annotation_ref}
}
```

Each point is `{x,y}` finite pixels or null. Coordinates may be outside the image
but must be finite; do not clamp landmarks into frame. Width/height positive ints.
`transforms` may be empty only when annotation already uses the explicitly declared
display plane; no implicit camera calibration or inferred anatomical 3D.
The body side explicitly labels the front leg, not playing handedness. It is a
manual/synthetic annotation assertion, not an automatic classification.

Timeline is the complete selected stream, exactly as supplied by media integration:
consecutive frame_index from 0 and strictly increasing integer PTS. No missing PTS.
No duplicate frame indices/observations, no observation outside the timeline;
observation PTS must match its timeline frame. Phase endpoints are inclusive,
must coincide with timeline entries, start<=end; require at least 2 frames in phase.
Every timeline frame in the phase needs all 3 points. A missing/degenerate point
or missing observation invalidates the whole attempt, but preserve partial series.
This conservative coverage rule is a technical research policy, not a validated
camera/accuracy cutoff. Irregular intervals are allowed and preserved; no resampling.

Geometry: theta = acos(clamp(dot(H-K,A-K)/(norm(H-K)*norm(A-K)),-1,1));
flexion = 180 - degrees(theta). Degenerate norm <=1e-12 display pixels rejects
the observation. Normalized helper multiplies x by width and y by height; input
must refer to the same already corrected display plane. Do not scale both by width.
No filter/interpolation in v0; preserve the raw computed series. Peak ties choose
earliest PTS. No temporal interval is inferred from index/FPS.

## 4. Internal research result (DS-01, schema by BE-01)

```
{
 schema_version,
 metric_id: "front_knee_projected_flexion_peak", definition_version: "0.1.0",
 asset_id, status: "computed" | "insufficient_evidence",
 value, unit: "deg", body_side, phase_id: "serve_preparation",
 evidence: {frame_index, pts} | null,
 series: [{frame_index, pts, value, quality_reasons}],
 quality_reasons, method_version: "m01_unfiltered_complete_window_v0",
 filter: "none", validation_ref: null,
 uncertainty: {status: "not_established"},
 provenance: {kind, protocol_id, annotation_ref}
}
```

Computed value finite in [0,180] with evidence and no global quality reason.
Insufficient result has null value/evidence and >=1 reason. Series values are
finite [0,180] or null with >=1 reason; successful series points have no reason.
The result is a separate INTERNAL artifact and cannot be returned as a public
metric. It remains unvalidated even when synthetic arithmetic passes tests.

## 5. Product-facing report contract (BE-01)

```
{
 schema_version, report_id, session_id, run_id, asset_id, is_demo,
 execution: {state: "succeeded" | "failed" | "cancelled"},
 metrics: [{
   metric_id: "front_knee_projected_flexion_peak", definition_version: "0.1.0",
   status: "research_only" | "insufficient_evidence" | "unsupported",
   value: null, unit: "deg", measurement_space: "image_2d_projected",
   body_side: "left" | "right" | null, phase_id: "serve_preparation",
   validation_ref: null, uncertainty: {status: "not_established"},
   quality_reasons, evidence: [{asset_id, frame_index, pts}],
   attempts: {total, valid, rejected}, pipeline_ref
 }],
 comparison: {state: "not_evaluated", delta: null, reason},
 message, error: ErrorEnvelope | null
}
```

Metric public value ALWAYS null; `reportable` deliberately absent. Valid attempt
means computationally usable, not scientifically validated. Counts integer>=0,
valid+rejected=total. Evidence frame_index>=0, pts integer; asset must match report.
`research_only` requires >=1 valid attempt and >=1 evidence. `insufficient_evidence`
requires a reason and valid=0. No metrics on failed/cancelled execution; failed
requires error, succeeded/cancelled error is null. Success may have an empty metrics
list. All messages nonempty, pipeline_ref nonempty. `is_demo=true` for synthetic
fixtures. `reason` explains why comparison was not evaluated; no fake history.

BE-01 exports Pydantic classes `MediaManifest`, `ResearchInput`, `ResearchResult`,
`PublicReport`, `ErrorEnvelope`, and `can_transition` from `tennis_backend.contracts`.
Generate and commit JSON Schemas for these 5 models in `schemas/` and meaningful
positive/negative fixtures in `tests/contracts/fixtures/`. These examples replace
the incomplete discussion fixtures only for code; do not edit historical vault files.

## 6. Acceptance and scope boundaries

Head joins media timeline + clearly synthetic/manual annotations, computes M01,
validates internal result and builds a report with null public value. Evidence
must resolve to the same asset and PTS. Tests demonstrate the joins and rejection
of mismatched/missing evidence. The integrated demo must explicitly say landmarks
are synthetic; no inference from video is implemented yet.

M02 timing, M03 session dispersion, H01 progression and R01 outcomes are NOT
implemented in this wave. No calibrated thresholds copied from simulations.
Same-sign repeated confirmation is a future invariant, not an implemented detector.
No participant data, trained model, biomechanical validity, production API,
multiuser security or durable queue is claimed by this foundation.

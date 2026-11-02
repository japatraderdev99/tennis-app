# P2 — integrated local pose laboratory

Technical acceptance: 2026-11-02. Scientific validation and cloud deployment are
not established. UX/UI/frontend remain assigned to Claude in a later wave.

## Delivered and reviewed

| Front | Implementation | Independent module check |
|---|---|---|
| CV-02 | Strict COCO17 research artifact; optional MediaPipe/RTMPose adapters | 152 tests; APIs inspected against installed libraries |
| BE-03 | Explicit seed and conservative box association; stop on gaps/loss/ambiguity | 112 tests; numeric and identity boundaries reviewed |
| DS-02 | Blank independent annotations, protocol, error/coverage evaluator | 110 tests; absent-reference and absent-prediction semantics reviewed |
| Head | Source timeline join, review bundle writer, optional locked runtime, cloud ADR | 22 integration tests plus full-suite checks |

Builders used isolated branches/worktrees with gpt-6.1-sol/high. Local commits:
CV code `e3afb4c`, delivery `19a20e4`; BE code `646d597`, delivery `044c49a`;
DS code `3b13c4e`, delivery `9fcaff5`. Integration preserves their history.

The base suite passes **1,077 tests** without CV extras. P1 generated schemas
remain unchanged. P2 does not introduce an automatic pose-to-M01 bridge.

## Real-runtime integration evidence

A separate `.venv-pose` installed the optional versions in `uv.lock`. Real local
weights were read; no athlete media or weights were uploaded or added to Git.
Tested on macOS arm64, Python 3.12.1, FFmpeg 8.1.1, CPU execution.

One source video prefix was checked through the new implementation:

- MediaPipe VIDEO: 32 consecutive source frames; detections in all 32.
- RTMPose + YOLOX HumanArt: 12 consecutive source frames; detections in all 12.
- Explicit seed at source frame 0, detection `0`, confirmed by the head's visual
  inspection of the near-side player's box. Both selections remained selected
  within these short windows; this does not validate identity tracking generally.
- Original frame PTS/time_base matched the preserved extraction exactly. Display
  transform was recorded; source SHA-256 was unchanged after execution.
- Both annotation templates remained blank/unreviewed. Both evaluations returned
  `not_evaluated`, with null errors/coverage. Review-bundle checksums were verified.

Detection frequency is not accuracy. These overlapping short windows are an
adapter compatibility check, not a benchmark or an independent athlete dataset.
Private evidence lives in the workspace experiment `p2-integration-2026-11-02`:
archived script, model provenance, source/frame hashes, pose JSON, selection,
blank labels and evaluation. Original videos and prior experiments are preserved.

The real source exposed a P1 MOV false positive: QuickTime permits an empty `alis`
self-reference. Fix `d0a73b8` accepts only version 0, flags 1 and 12-byte entries
inside `dref`. External/payload-bearing references remain rejected and FFprobe
external references stay disabled. Seven synthetic regression cases cover this
change. [Apple specification](https://developer.apple.com/documentation/quicktime-file-format/media_data_reference_atom/data_references).

## Limits and next gate

- RTMPose detector must be person-only YOLOX. The installed RTMLib path does not
  filter multi-class COCO detections; arbitrary YOLOX weights are unsupported.
- MediaPipe boxes derive from landmarks; native scores are uncalibrated. There is
  no 3D anatomical validity, ideal angle, technique score or improvement claim.
- Model weights are existing local cache files identified by hash, not checked
  against independently published upstream digests. Pin/licensing review and a
  durable weight distribution path remain needed before deployment.
- Optional CV runtime includes both OpenCV package variants required by RTMLib;
  they are pinned to the same version. Linux native inference remains unverified.
- Decode orchestration is caller-owned. The laboratory functions are not a
  production upload service, hard process sandbox or complete HTTP worker.
- Independent landmark annotation, repeatability and camera protocols are pending.

Next backend wave: local HTTP contracts/persistence, upload/job lifecycle and
provider boundaries; then Linux and cloud integration. Infrastructure target:
[ADR-0001](../architecture/ADR-0001-pilot-cloud.md). Provider accounts, region,
spending ceiling, retention and recovery objectives precede paid provisioning.

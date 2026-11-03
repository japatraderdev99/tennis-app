# Operating agreement — P1 foundation

## Current wave: real local video UX V3

The user now explicitly authorizes improving UX/UI and testing recently edited
tennis videos on their computer. Work only in `backend-worktrees/ux-real-video-v3`,
branch `feat/ux-real-video-v3`. This supersedes V2's synthetic-only restriction for
local playback and inspection. Preserve V1/V2 and original media. Local files,
posters, filenames, paths and detailed private metadata stay outside Git; no upload
to an external service, deployment, paid API or invented pose/biomechanics.
Head owns visual design, app integration, docs and Git publication. Collaborators
edit only assigned files. Keep the synthetic demo visibly separate from real media.
Use video playback time for user bookmarks, never claim original PTS or exact frame
stepping from HTMLVideoElement alone. Real analysis needs separately bound evidence.

## Current authorized wave: Codex UX V2 and evaluation lab

On 2026-11-02 the user explicitly asked Codex to implement its own improvements
while Claude is unavailable, reusing or improving existing components, and to
research/build an evaluation approach for reverse-engineering UI agents/tools.
This supersedes the earlier frontend ownership restriction for this isolated
branch only. Preserve Claude's `feat/ux-ui-v1` worktree and original commit.
Work in `backend-worktrees/ux-codex-v2`, branch `feat/ux-codex-v2`.
Head owns UI, dependencies, CI, docs and integration. Assigned collaborators own
only the files in their task. No cloud provisioning, real upload, paid agent runs,
new biomechanical claims or publication of real media is included in this wave.
Benchmarks must distinguish deterministic tests from actual agent evaluations;
unrun tools have no invented score or ranking. Head retains authorized Git push.

## Active wave: P2 pose laboratory

Gabriel authorized new parallel operational chats, gpt-6.1-sol/high, with head
orchestration and review. For CV-02, BE-03 and DS-02, read
`docs/P2_POSE_LAB.md` and `docs/P2_OPERATIONS.md` before implementation.
Their P2 assignments extend this historical P1 scope. They may implement pose
inference, conservative target association and annotation/evaluation tooling in
their assigned modules. Head may provision a separate local runtime and use the
existing local model weights for private tests on the user-provided videos.
No cloud provisioning, automatic training, frontend, biomechanical scoring or
publication of videos/landmarks is authorized by this wave. P1 public scientific
gates remain unchanged. Worker commits are local; head owns integration/push.

Read `docs/CONTRACTS_V0.md` and your assignment in `docs/OPERATIONS.md` first.
This is a local research backend. Gabriel authorized implementation and parallel
branches on 2026-11-01. UX/UI/frontend belong to Claude in a later wave.

Gabriel also authorized commit/push to `japatraderdev99/tennis-app` on 2026-11-01.
The head owns publication. The builder restrictions below still apply to assigned
implementation chats. Do not interpret them as blocking the head's authorized push.
`docs/planning/` is a generated portable mirror of selected approved vault notes;
edit the canonical vault and regenerate it via `scripts/export_planning.py`.

## Isolation and ownership

- Work only in the assigned checkout and branch. Use explicit command workdir.
- Main checkout belongs to the head. Never switch, reset, clean, merge, rebase,
  push, or change files in another checkout. Never edit the shared Obsidian vault.
- Each builder owns only its module, corresponding tests, and delivery note.
- `pyproject.toml`, `uv.lock`, root package, shared docs, integration and README
  belong to the head. Request dependency/interface changes in your delivery note.
- Do not amend another agent's commit. Make a normal commit of your own paths.
- Preserve original videos and Claude's research. No downloads of model weights,
  collection of human data, cloud provisioning, external publication or deployment.
- A narrower owner assignment is coordination, not a need for extra user approval.
  Resolve routine implementation details within your assignment autonomously.

## Scientific invariants

- Projected 2D is not anatomical 3D. No posture quality score, injury claims,
  ideal-angle threshold, improvement claim or personalized coaching.
- Public metric `value` is null for every non-reportable status. This foundation
  has no reportable status. Numeric research output lives in a separate artifact.
- Pose confidence is not measurement uncertainty. `validation_ref` stays null.
- PTS/time_base determine time. Never substitute frame_index / nominal FPS.
- Unknown, invalid, missing and unsupported are explicit; never zero-fill them.
- Missing evidence that could hide a peak invalidates the attempt. No interpolation.
- Synthetic fixtures prove implementation properties, not validity on athletes.

## Engineering

- Python 3.12+, minimal dependencies. `uv sync --frozen` if available; use an
  isolated checkout venv. Shared immutable uv cache is okay. Do not share venvs.
- Reproducible tests must cover meaningful failure and boundary cases.
- No network in tests; FFmpeg/FFprobe tests generate tiny synthetic files in tmp.
- External commands use argument arrays, no shell, local files and bounded resources.
- JSON must reject NaN/Infinity and undocumented fields. Avoid silent coercion.
- Finish with a committed `docs/deliveries/<assignment>.md`: commit, files, tests,
  known limitations and interface deviations (none preferred). The head reads the
  result directly; do not send messages to other user-owned chats yourself.

# Operating agreement — P1 foundation

Read `docs/CONTRACTS_V0.md` and your assignment in `docs/OPERATIONS.md` first.
This is a local research backend. Gabriel authorized implementation and parallel
branches on 2026-11-01. UX/UI/frontend belong to Claude in a later wave.

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

# Tennis research backend

Local P1 foundation, implementation started 2026-11-01. The planning source is the
Obsidian vault `../app-mec-data-tennis-sci`. This repository contains code and
synthetic technical fixtures only. Original reference videos remain outside Git.

Read [the frozen scope](docs/CONTRACTS_V0.md) and [ownership](docs/OPERATIONS.md).

Python 3.12+ and uv:

```sh
uv sync --frozen
uv run --frozen pytest
```

FFprobe/FFmpeg are system tools for media tests; exact version is recorded in
generated manifests. Runtime/test dependencies are pinned in `uv.lock` by the head.

## Local research commands

```sh
# Real media metadata/PTS only; no pose inference or video modification.
uv run --frozen python -m tennis_backend inspect /absolute/path/video.mp4

# Inspect the video and join an explicit ResearchInput annotation file to it.
uv run --frozen python -m tennis_backend research /absolute/path/video.mp4 \
  --annotations /absolute/path/annotation.json --output-dir artifacts/new-run

# Fully synthetic acceptance example: blue video, supplied 90-degree geometry.
uv run --frozen python scripts/demo_synthetic.py artifacts/synthetic-demo
```

Each output directory must be new. The bundle contains the media manifest,
annotation input, INTERNAL research result, public report and SHA256 checksums.
The demonstration also preserves its synthetic source video in the bundle.
`checksums.json` is written last; without it a directory is incomplete. A local
disk failure can leave a partial directory; this is not a transactional service.

The research artifact contains the experimental number. The public report keeps
`value: null`; unavailable evidence never becomes zero. A repeated calculation
has the same numerical result but gets a new execution/report ID.

Media inspection supports a restricted set of self-contained local containers.
It checks references, byte/time/frame/output budgets and source changes, but it
does not sandbox a native decoder for hostile public uploads. This is a local
lab tool. Production isolation, authentication, retention and access control
remain future requirements. No user video is included in the repository.

See [the frontend handoff gate](docs/FRONTEND_HANDOFF_GATE.md). Claude retains
UX/UI/frontend ownership; this repository introduces no visual application.

This is not a deployed service, a pose estimator, or a validated sports assessment.
No metric is currently released to end users. Internal research numbers and
product-facing report fields have separate contracts.

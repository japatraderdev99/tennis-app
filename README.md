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
generated manifests. Dependencies are pinned in `uv.lock` by the head. Code
modules and an integrated demonstration will be added by the assigned branches.

This is not a deployed service, a pose estimator, or a validated sports assessment.
No metric is currently released to end users. Internal research numbers and
product-facing report fields have separate contracts.

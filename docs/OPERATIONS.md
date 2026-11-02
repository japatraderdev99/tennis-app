# Ownership and delivery order

Head: Codex in the original App Tennis chat. All three builders use gpt-6.1-sol,
reasoning high, per Gabriel's instruction. Each chat works in a separate local
Git checkout on its branch. The workspace root is not the code repository.

| ID | Branch | Own paths | Required result |
|---|---|---|---|
| BE-01 | feat/contracts-v0 | src/tennis_backend/contracts/, schemas/, tests/contracts/, docs/deliveries/BE-01.md | Strict models, invariants, state transitions, schemas and fixtures |
| BE-02 | feat/media-ingest-v0 | src/tennis_backend/media/, tests/media/, docs/deliveries/BE-02.md | Read-only bounded FFprobe inspection, hash, real PTS, failure tests |
| DS-01 | feat/research-metrics-v0 | src/tennis_backend/metrics/, tests/metrics/, docs/deliveries/DS-01.md | Deterministic projected M01, full-window coverage, synthetic geometry tests |
| HEAD | integrate/p1-foundation | everything else; cross-module acceptance | Review, merge builders in order above, integration, vault checkpoint |

First run `git status --short --branch` in your assigned checkout. Verify branch.
Use `uv sync --frozen`; run `uv run --frozen pytest tests/<assignment-dir>`.
If network access prevents dependency setup, report it accurately and use the
installed Python packages for testing with `PYTHONPATH=src python3 -m pytest`;
do not change the shared lock file. Head owns dependency resolution.

Commit your scoped work and stop; don't merge. Deliver the full commit hash,
test commands/results, public interface and known limits. Head independently
checks the result before accepting it. A passing builder test is not integration.

Wave 2 (after foundation acceptance): local API + persistent job/artefact design,
model adapter benchmark with licensing/provenance, privacy/delete requirements.
Design this after actual foundation evidence; don't open idle dependent builders.
Wave 3: head/Claude review a stable frontend contract and synthetic story states;
Claude owns capture flow, UX/UI/frontend. Live metrics remain gated by validation.

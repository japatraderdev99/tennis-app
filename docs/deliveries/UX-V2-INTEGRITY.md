# UX V2 — selection and fixture verification integrity

Date: 2026-11-02. Branch: `feat/ux-codex-v2`. Code commit:
`114903005e799bda60621382eefe87d897fa5b29`.

## Changes

- `frontend/src/mocks/selection.ts`: composition now gives the newest applicable
  explicit seed authority over its interval, including `lost` and `ambiguous`.
  It cannot revive an older selected identity. Calls are ordered by request,
  newest last; a new explicit choice at the same frame replaces the older one.
- Before composition, complete timelines must have matching lengths, source
  frame indices and PTS; safe-integer indices/PTS, order, seed application and
  identity/status consistency are checked. A single call cannot silently recover
  after loss. An empty list of calls still produces no selection.
- `frontend/scripts/verify_against_backend.py`: missing, empty, incomplete and
  unexpected artifact/report inventories fail before case validation. The six
  expected seedable names are explicit: conexao, cruzamento, falha, limpo, perda,
  pes. Every case is counted; report/artifact binding and demo status are checked.
  Nonfinite JSON is rejected and JSON comparison distinguishes booleans from
  integer frame indices. The module can be imported without executing its CLI.

## Verification

| Check | Result |
|---|---|
| `npm test -- --run tests/selection-regression.test.ts` | 21 passed |
| `.venv/bin/python -m pytest frontend/tests/test_fixture_verification.py -q` | 15 passed |
| Full Vitest suite at integration check time | 57 passed |
| `npm run build` | Passed |
| Full generated synthetic fixtures against Python | 6/6 passed inside CLI acceptance test |

Regressions include A/B/lost instead of A/B/A, ambiguity, preserved gaps,
same-frame replacement, misaligned/truncated/reordered timelines, nonfinite or
unsafe timing, illegal within-call recovery, missing cases/pairs, unexpected case
names, mismatched reports and corrupt JSON. Existing `selectTarget` was unchanged.

No network was used. Offline `uv sync` could not find a cached pydantic-core wheel;
the independently created local venv received APFS clones of installed base
packages, with its editable path rewritten to this checkout. The source venv was
not changed. Node fixtures used `node --import tsx`, avoiding the CLI IPC socket.

## Scope and remaining limits

Only the two implementation files and two new test files above were changed by
this task. No UI, dependencies, frozen backend schema, real media or cloud was
changed. Head owns E2E, final integration and publication; no push was performed.

Composition remains a mock operation: array alignment does not establish common
asset ownership, immutable candidate identity or validated tracking. Those remain
P3 contract requirements. The fixture parity check compares individual selection
against Python; the new composition is covered by separate synthetic regressions.
These tests establish software behavior, not biomechanical accuracy or agent
benchmark performance. Adding a new seedable fixture requires updating the named
verification inventory deliberately.

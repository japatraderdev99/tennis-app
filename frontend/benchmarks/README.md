# Local UI evaluation lab

This is a task catalog and a deterministic regression baseline for Quadro's
synthetic prototype. It does **not** rank autonomous agents or prove practitioner
usability. No external agent has been run by this harness.

Six tasks in `tasks.json` cover first use, explicit reselection, replay after
failure/cancellation, history/deletion and keyboard player selection. The user
instructions are separate from terminal-state assertions in `e2e/benchmark.spec.ts`.
Tests attach workflow and scientific-display observations separately. The latter
checks demo identification and absence of numeric technique claims; on replay
tasks it also checks unavailable measurement copy. It does not evaluate model
accuracy, actual capture quality or medical claims.

## Reproduce the scripted baseline

From `frontend/`, with locked dependencies already installed and the local dev
server/configuration supplied by the head:

```sh
mkdir -p artifacts/benchmark-run-01
node benchmarks/metadata.mjs > artifacts/benchmark-run-01/metadata.json
PLAYWRIGHT_JSON_OUTPUT_NAME=artifacts/benchmark-run-01/playwright.json \
  npx playwright test e2e/benchmark.spec.ts --grep @benchmark --retries=0 --workers=1 --reporter=json
node benchmarks/results.mjs normalize \
  artifacts/benchmark-run-01/playwright.json \
  artifacts/benchmark-run-01/metadata.json \
  artifacts/benchmark-run-01/result.json
node benchmarks/results.mjs validate artifacts/benchmark-run-01/result.json
```

Use a **new** directory per run; never overwrite accepted evidence. The normalizer
creates its output exclusively. Metadata records commit, working-tree state and a
hash of nonignored tracked/untracked frontend files, so an uncommitted working
tree cannot be mistaken for the exact commit. Record the run's machine/conditions
alongside it when comparing timings. Do not change source during a run.

Run one browser/project at a time; the observation includes its actual version
and viewport. Six task results are mandatory. Missing tasks, empty input, retries,
duplicate projects, absent successful observations and runner-level failures
cannot turn into a passing benchmark. A partial run needs rerun/evidence review,
not a denominator adjusted until the score looks good.

`metadata.mjs` must run before each baseline; the test itself reads the viewport
and browser. The backend and player use synthetic data. Local simulated processing
speed is part of the runner configuration, so wall time is **script execution
duration**, not model latency, user task time or an agent's planning efficiency.
Playwright screenshots and trace files can contain the UI state; keep authorized
data only. Results are local artifacts excluded from Git, not product screens.

## What is measured

The normalized artifact uses `execution_kind: deterministic_playwright` and
`assessment: scripted_checks_only`. Per-task fields record test status, execution
duration, observed workflow outcome and the separate display-invariant outcome.
The summary retains all six tasks, including failures or skipped tasks. Agent
success rate, human success rate and biomechanical accuracy stay null. External
tools remain `not_run` with an empty results array.

Semantic assertions and keyboard/hit testing matter more than pixel similarity.
Screenshots preserve evidence for human comparison; no uncalibrated visual score
or aesthetic ranking is computed. Existing full journey/axe tests remain separate.

## Reconstruction experiments

For authorized screenshot/video-to-interface experiments, freeze a reference pack
and its hashes, task instructions, allowed source access and implementation budget.
Give each tool an isolated worktree. Record whether it received screenshots only,
DOM, source code or existing components; these are different experimental tracks.
Run this same functional oracle against the resulting app at its local base URL,
then review screenshot pairs separately for layout, hierarchy and interaction
coverage. Do not collapse functional correctness and visual similarity into an
unvalidated composite score. Keep some states out of the reference pack if the
experiment is intended to measure generalization, and declare that split.

No reconstruction agent has been executed here. Its output, elapsed generation
time, tool/model cost and trace provenance must be collected in a future actual
run. A target UI's scripted regression success is not that agent's success rate.

## Future autonomous tool runs

Give an authorized browser agent only the task instruction, starting state and
explicit budget. Isolate each task in a fresh browser profile, use the same
synthetic fixture version and preserve tool/model version, actions, observations,
latency, token/cost measurements when actually available, and termination reason.
Do not feed it the scripted selectors and call the result independent discovery.

`validateRun` supports `execution_kind: agent_trace` **only as ungraded evidence**:

- `assessment: pending_independent_evaluation`, `summary: null`.
- `external_agents: {status: "not_evaluated", results: []}`; the trace is not a
  comparative result or tool ranking.
- Agent tool/version/model, a finite step/time budget and source metadata required.
- Exactly the catalog tasks; completed/timed-out rows need trace reference/hash,
  measured steps/duration. Unrun rows use null measurements.
- Workflow and scientific outcomes remain `not_evaluated`. Self-graded success is
  rejected. A future independent evaluator must inspect the terminal app state
  and transcript before introducing a separately versioned assessed-run format.

This validator checks structure and consistency; it cannot authenticate a trace,
verify a referenced file's contents by itself or prove an agent was truly run.
The independent grader/agent connectors are **not implemented**. No credentials,
paid calls, external repository execution or cloud resources are needed here.

## Normalizer checks

```sh
node --test benchmarks/results.test.mjs
```

These tests use generated synthetic reporter objects, not recorded tool runs.
They cover incomplete sets, duplicated attempts/projects, missing observations,
skips, failures, nonfinite durations, aggregate tampering, relabelled execution
kind, agent self-grading and exceeded budgets. Passing them validates the result
handling code only; browser workflow results require the separate real E2E run.

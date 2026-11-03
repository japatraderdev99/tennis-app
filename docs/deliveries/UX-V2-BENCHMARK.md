# UX V2 — local UI benchmark harness

Owner: Codex benchmark subagent. Date: 2026-11-02. Branch `feat/ux-codex-v2`.
Owned changes only: `frontend/benchmarks/`, `frontend/e2e/benchmark.spec.ts` and
this delivery note. UI, dependencies, package scripts and CI belong to the head.

## Implemented

- Six-task catalog for first use, reselection, failure/cancelled raw replay,
  deletion/history and keyboard player selection.
- Playwright `@benchmark` tasks with terminal assertions and separately attached
  scientific-display invariant observations. Per-task browser/version/viewport
  and screenshots are evidence, not scores of user comprehension.
- Node-only metadata capture for commit, working tree status and frontend tree
  hash; no network, new dependencies, credentials or paid tool runs.
- Playwright JSON normalizer: exactly six unique tasks and one browser/attempt,
  counts matching observations, explicit nulls for unmeasured agent/human/science
  outcomes; unavailable external tool rankings remain `not_run`.
- Validator supports future `agent_trace` evidence only as pending independent
  evaluation, with tool/model provenance, traces and finite step/time budgets.
  It rejects self-grading; no autonomous agent connector/grader is implemented.
- Protocol for authorized UI reconstruction experiments and their distinct
  reference/source access conditions. Visual quality still requires separate QA.

## Validation executed

`node --test benchmarks/results.test.mjs`: **9 tests passed**. Tests reject empty,
partial/duplicate datasets, multiple attempts/projects, missing observations,
invented aggregate counts, nonfinite durations, relabelled scripted runs, agent
self-grading and exceeded budgets. All inputs are synthetic unit fixtures.

`npm run typecheck`: passed. `metadata.mjs`: executed successfully; records the
currently dirty shared worktree rather than pretending it equals a clean commit.

**The six browser benchmark tasks were not executed by this subagent.** Head owns
the server on 5184, integrated app behavior and actual baseline run. Existing
journey labels are preserved except the head-added raw-replay action expected as
`Rever o vídeo sem esqueleto`. No external agent comparison was run.

## Head integration

From `frontend`, generate metadata into a new ignored artifacts directory, run
`playwright test e2e/benchmark.spec.ts --grep @benchmark --retries=0 --workers=1
--reporter=json` with `PLAYWRIGHT_JSON_OUTPUT_NAME`, then:

```sh
node benchmarks/results.mjs normalize REPORT_JSON METADATA_JSON NEW_RESULT_JSON
node benchmarks/results.mjs validate NEW_RESULT_JSON
```

Add package/CI scripts if useful; `node --test benchmarks/results.test.mjs` requires
no browser. The normalizer writes exclusively and exits nonzero on failed checks.
Detailed commands and limitations are in `frontend/benchmarks/README.md`.

## Limits

This proves result-handling and scripted UI properties only. Shape validation
cannot authenticate an externally supplied trace or independently grade an agent.
No real phone, Safari/iOS, screen reader, sunlight, practitioner study, model
benchmark or biometric validity is implied. Keep machine conditions and simulation
speed fixed before interpreting durations; this is not inference or agent latency.

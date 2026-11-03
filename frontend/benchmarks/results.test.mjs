/** Synthetic unit fixtures for the normalizer, never published as benchmark runs. */
import test from "node:test";
import assert from "node:assert/strict";
import { catalog, normalizePlaywrightReport, validateRun } from "./results.mjs";

const metadata = () => ({ run_id: "synthetic-unit-fixture", source_commit: "a".repeat(40),
  source_tree_sha256: "b".repeat(64), working_tree_clean: true });
const report = () => ({ errors: [], suites: [{ specs: catalog.tasks.map(task => ({
  title: `@benchmark ${task.id} synthetic unit fixture`,
  tests: [{ expectedStatus: "passed", results: [{ status: "passed", duration: 10,
    attachments: [{ name: "benchmark-observation", contentType: "application/json",
      body: Buffer.from(JSON.stringify({ catalog_version: catalog.catalog_version, task_id: task.id,
        execution_kind: "deterministic_playwright", workflow: "passed", scientific_invariants: "passed",
        browser: { name: "synthetic-fixture-browser", version: "unit-test-only" }, viewport: { width: 393, height: 851 },
      })).toString("base64") }],
  }] }],
})) }] });

test("normalizes six scripted checks without agent/human/science performance", () => {
  const run = normalizePlaywrightReport(report(), metadata());
  assert.equal(run.summary.workflow_passed, 6);
  assert.equal(run.summary.all_checks_passed, true);
  assert.equal(run.summary.agent_success_rate, null);
  assert.equal(run.summary.biomechanical_accuracy, null);
  assert.deepEqual(run.external_agents, { status: "not_run", results: [] });
});

test("empty, partial and duplicate task sets fail closed", () => {
  for (const mode of ["empty", "partial", "duplicate"]) {
    const r = report();
    if (mode === "empty") r.suites = [];
    if (mode === "partial") r.suites[0].specs.pop();
    if (mode === "duplicate") r.suites[0].specs[5] = r.suites[0].specs[0];
    assert.throws(() => normalizePlaywrightReport(r, metadata()));
  }
});

test("scripted output cannot be relabelled as autonomous agent performance", () => {
  assert.throws(() => normalizePlaywrightReport(report(), { ...metadata(), execution_kind: "agent_trace" }), /relabelled/);
  const run = normalizePlaywrightReport(report(), metadata());
  run.summary.agent_success_rate = 1;
  assert.throws(() => validateRun(run), /cannot estimate/);
});

test("retry, multiple projects and runner errors are not silently aggregated", () => {
  const retry = report(); retry.suites[0].specs[0].tests[0].results.push(retry.suites[0].specs[0].tests[0].results[0]);
  assert.throws(() => normalizePlaywrightReport(retry, metadata()), /attempt/);
  const projects = report(); projects.suites[0].specs[0].tests.push(projects.suites[0].specs[0].tests[0]);
  assert.throws(() => normalizePlaywrightReport(projects, metadata()), /browser/);
  assert.throws(() => normalizePlaywrightReport({ ...report(), errors: [{ message: "worker failed" }] }, metadata()), /runner errors/);
});

test("no observation means no passed task", () => {
  const r = report(); r.suites[0].specs[0].tests[0].results[0].attachments = [];
  assert.throws(() => normalizePlaywrightReport(r, metadata()), /observations/);
});

test("failed precondition remains failed with scientific checks unperformed", () => {
  const r = report(); Object.assign(r.suites[0].specs[0].tests[0].results[0], { status: "failed", attachments: [] });
  const run = normalizePlaywrightReport(r, metadata());
  assert.equal(run.summary.all_checks_passed, false);
  assert.equal(run.tasks[0].workflow, "not_evaluated");
  assert.equal(run.tasks[0].scientific_invariants, "not_evaluated");
  assert.equal(run.summary.workflow_passed, 5);
});

test("unrun task has null duration and no passing outcome", () => {
  const r = report(); Object.assign(r.suites[0].specs[0].tests[0].results[0], { status: "skipped", attachments: [] });
  const run = normalizePlaywrightReport(r, metadata());
  assert.equal(run.tasks[0].duration_ms, null);
  assert.equal(run.summary.executed_tasks, 5);
  run.tasks[0].workflow = "passed";
  assert.throws(() => validateRun(run), /unrun tasks/);
});

test("nonfinite duration and invented aggregate totals are rejected", () => {
  const r = report(); r.suites[0].specs[0].tests[0].results[0].duration = Infinity;
  assert.throws(() => normalizePlaywrightReport(r, metadata()), /finite duration/);
  const run = normalizePlaywrightReport(report(), metadata()); run.summary.workflow_passed = 9;
  assert.throws(() => validateRun(run), /counts/);
});

test("agent evidence is accepted only as ungraded traces with provenance and budget", () => {
  const run = {
    schema_version: "0.1.0", catalog_version: catalog.catalog_version, metadata: metadata(),
    execution_kind: "agent_trace", assessment: "pending_independent_evaluation", summary: null,
    external_agents: { status: "not_evaluated", results: [] },
    agent: { tool: "synthetic unit fixture", version: "test", model: "test-no-model-used" },
    budget: { max_steps: 20, max_duration_ms: 1000 },
    tasks: catalog.tasks.map(t => ({ task_id: t.id, execution_status: "not_run", duration_ms: null,
      steps: null, trace_sha256: null, workflow: "not_evaluated", scientific_invariants: "not_evaluated" })),
  };
  assert.equal(validateRun(run), true);
  Object.assign(run.tasks[0], { execution_status: "completed", duration_ms: 500, steps: 12,
    trace_ref: "private/example.jsonl", trace_sha256: "c".repeat(64) });
  assert.equal(validateRun(run), true);
  run.tasks[0].workflow = "passed";
  assert.throws(() => validateRun(run), /self-grading/);
  run.tasks[0].workflow = "not_evaluated"; run.tasks[0].steps = 100;
  assert.throws(() => validateRun(run), /step budget/);
});

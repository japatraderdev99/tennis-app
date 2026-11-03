import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const catalog = JSON.parse(readFileSync(new URL("./tasks.json", import.meta.url), "utf8"));
const ids = catalog.tasks.map(t => t.id);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const outcome = value => ["passed", "failed", "not_evaluated"].includes(value);
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

function checkMetadata(meta) {
  assert(meta && typeof meta === "object", "metadata required");
  assert(/^[a-f0-9]{40}$/.test(meta.source_commit ?? ""), "full source_commit required");
  assert(hash(meta.source_tree_sha256), "source_tree_sha256 required");
  assert(typeof meta.working_tree_clean === "boolean", "working_tree_clean required");
  assert(nonempty(meta.run_id), "run_id required");
}

function collectSpecs(suites) {
  assert(Array.isArray(suites), "Playwright suites required");
  return suites.flatMap(suite => [...(suite.specs ?? []), ...collectSpecs(suite.suites ?? [])]);
}

function checkTaskSet(tasks) {
  assert(Array.isArray(tasks) && tasks.length === ids.length, "all six catalog tasks are required");
  const actual = tasks.map(t => t.task_id).sort();
  assert(JSON.stringify(actual) === JSON.stringify([...ids].sort()), "missing, duplicate or unknown task");
}

export function normalizePlaywrightReport(report, metadata) {
  checkMetadata(metadata);
  assert(!metadata.execution_kind || metadata.execution_kind === "deterministic_playwright",
    "scripted results cannot be relabelled as agent execution");
  assert(Array.isArray(report.errors) && report.errors.length === 0, "runner errors prevent a complete benchmark");
  const specs = collectSpecs(report.suites).filter(s => s.title?.includes("@benchmark"));
  const tasks = specs.map(spec => {
    const task_id = spec.title.match(/\bUI-\d{2}\b/)?.[0];
    assert(ids.includes(task_id), "unknown benchmark task title");
    assert(spec.tests?.length === 1, "one browser/project per result file is required");
    const test = spec.tests[0];
    assert(test.expectedStatus === "passed", "expected failures cannot count as accepted tasks");
    assert(test.results?.length === 1, "one attempt per task required; do not hide retries");
    const result = test.results[0];
    assert(Number.isFinite(result.duration) && result.duration >= 0, "finite duration required");
    assert(["passed", "failed", "timedOut", "interrupted", "skipped"].includes(result.status), "unknown Playwright status");
    const attached = (result.attachments ?? []).filter(a => a.name === "benchmark-observation");
    assert(attached.length <= 1, "duplicate observations");
    let observation = null;
    if (attached.length) {
      assert(attached[0].contentType === "application/json" && nonempty(attached[0].body), "inline observation JSON required");
      observation = JSON.parse(Buffer.from(attached[0].body, "base64").toString("utf8"));
      assert(observation.catalog_version === catalog.catalog_version && observation.task_id === task_id,
        "observation/catalog identity mismatch");
      assert(observation.execution_kind === "deterministic_playwright", "scripted observation kind mismatch");
      assert(outcome(observation.workflow) && outcome(observation.scientific_invariants), "invalid observation outcomes");
      assert(nonempty(observation.browser?.name) && nonempty(observation.browser?.version), "observed browser version required");
    }
    if (result.status === "passed") {
      assert(observation?.workflow === "passed" && observation?.scientific_invariants === "passed",
        "a passed test needs both independent observations");
    }
    return {
      task_id, execution_status: result.status === "skipped" ? "not_run" : "executed",
      test_status: result.status, duration_ms: result.status === "skipped" ? null : result.duration,
      workflow: observation?.workflow ?? "not_evaluated",
      scientific_invariants: observation?.scientific_invariants ?? "not_evaluated",
      browser: observation?.browser ?? null, viewport: observation?.viewport ?? null,
      evidence: { reporter_test_title: spec.title, observation_attached: !!observation },
    };
  });
  checkTaskSet(tasks);
  const browsers = new Set(tasks.filter(t => t.browser).map(t => JSON.stringify(t.browser)));
  assert(browsers.size <= 1, "do not aggregate different browsers in one run");
  const run = {
    schema_version: "0.1.0", catalog_version: catalog.catalog_version,
    execution_kind: "deterministic_playwright", assessment: "scripted_checks_only",
    metadata, tasks: tasks.sort((a, b) => a.task_id.localeCompare(b.task_id)),
    summary: {
      catalog_tasks: ids.length,
      executed_tasks: tasks.filter(t => t.execution_status === "executed").length,
      workflow_passed: tasks.filter(t => t.workflow === "passed").length,
      scientific_checks_passed: tasks.filter(t => t.scientific_invariants === "passed").length,
      all_checks_passed: tasks.every(t => t.test_status === "passed" && t.workflow === "passed" && t.scientific_invariants === "passed"),
      agent_success_rate: null, human_usability_success_rate: null, biomechanical_accuracy: null,
    },
    external_agents: { status: "not_run", results: [] },
  };
  validateRun(run);
  return run;
}

/** Schema/provenance validation only. Agent traces are never accepted as self-grades. */
export function validateRun(run) {
  assert(run?.schema_version === "0.1.0" && run.catalog_version === catalog.catalog_version, "unsupported run/catalog version");
  checkMetadata(run.metadata);
  checkTaskSet(run.tasks);
  if (run.execution_kind === "deterministic_playwright") {
    assert(run.external_agents?.status === "not_run" && Array.isArray(run.external_agents.results) && !run.external_agents.results.length,
      "external tool results must not be invented");
    assert(run.assessment === "scripted_checks_only", "scripted assessment label required");
    for (const task of run.tasks) {
      assert(["executed", "not_run"].includes(task.execution_status), "invalid execution status");
      assert(outcome(task.workflow) && outcome(task.scientific_invariants), "invalid outcome");
      assert(task.execution_status === "not_run" ? task.duration_ms === null : Number.isFinite(task.duration_ms) && task.duration_ms >= 0,
        "duration must be absent for unrun task, finite otherwise");
      if (task.execution_status === "not_run") assert(task.workflow === "not_evaluated" && task.scientific_invariants === "not_evaluated", "unrun tasks cannot pass");
      if (task.test_status === "passed") assert(task.workflow === "passed" && task.scientific_invariants === "passed", "passed test lacks successful observations");
    }
    assert(run.summary?.agent_success_rate === null && run.summary.human_usability_success_rate === null && run.summary.biomechanical_accuracy === null,
      "scripted checks cannot estimate agent/human/scientific performance");
    assert(run.summary.catalog_tasks === ids.length && run.summary.executed_tasks === run.tasks.filter(t => t.execution_status === "executed").length
      && run.summary.workflow_passed === run.tasks.filter(t => t.workflow === "passed").length
      && run.summary.scientific_checks_passed === run.tasks.filter(t => t.scientific_invariants === "passed").length,
      "summary counts must match observations");
    assert(run.summary.all_checks_passed === run.tasks.every(t => t.test_status === "passed" && t.workflow === "passed" && t.scientific_invariants === "passed"),
      "summary cannot hide failures");
  } else if (run.execution_kind === "agent_trace") {
    assert(run.external_agents?.status === "not_evaluated" && Array.isArray(run.external_agents.results) && !run.external_agents.results.length,
      "an ungraded trace cannot contain evaluated tool results");
    assert(run.assessment === "pending_independent_evaluation" && run.summary === null,
      "agent trace is evidence pending an independent evaluator, not a score");
    assert(nonempty(run.agent?.tool) && nonempty(run.agent?.version) && nonempty(run.agent?.model), "agent provenance required");
    assert(Number.isInteger(run.budget?.max_steps) && run.budget.max_steps > 0 && Number.isFinite(run.budget.max_duration_ms) && run.budget.max_duration_ms > 0,
      "explicit finite agent budget required");
    for (const task of run.tasks) {
      assert(["completed", "timed_out", "not_run"].includes(task.execution_status), "invalid trace execution status");
      assert(task.workflow === "not_evaluated" && task.scientific_invariants === "not_evaluated", "agent self-grading is not supported");
      if (task.execution_status === "not_run") {
        assert(task.duration_ms === null && task.steps === null && task.trace_sha256 === null, "unrun trace must have null measurements");
      } else {
        assert(Number.isInteger(task.steps) && task.steps >= 0 && task.steps <= run.budget.max_steps, "step budget exceeded");
        assert(Number.isFinite(task.duration_ms) && task.duration_ms >= 0 && task.duration_ms <= run.budget.max_duration_ms, "time budget exceeded");
        assert(nonempty(task.trace_ref) && hash(task.trace_sha256), "trace evidence reference/hash required");
      }
    }
  } else throw new Error("unknown execution_kind");
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === "normalize" && args.length === 3) {
      const [reportFile, metadataFile, destination] = args;
      const run = normalizePlaywrightReport(JSON.parse(readFileSync(reportFile, "utf8")), JSON.parse(readFileSync(metadataFile, "utf8")));
      writeFileSync(destination, JSON.stringify(run, null, 2) + "\n", { flag: "wx" });
      console.log(`${run.summary.workflow_passed}/${ids.length} scripted workflows; external agents not run`);
      if (!run.summary.all_checks_passed) process.exitCode = 1;
    } else if (command === "validate" && args.length === 1) {
      validateRun(JSON.parse(readFileSync(args[0], "utf8")));
      console.log("Run structure valid. This does not establish accuracy or independent agent evaluation.");
    } else throw new Error("Usage: node benchmarks/results.mjs normalize REPORT METADATA NEW_OUTPUT | validate RUN");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

# Frontend handoff gate — Claude owns the next experience layer

The user reserved UX/UI/frontend for Claude after this backend foundation. No
frontend branch or technology choice is introduced here.

The initial deliverable is a local Python library/CLI, not an HTTP service.
`schemas/PublicReport.schema.json` is the reference data contract once integrated; the
runtime Pydantic validators enforce cross-field invariants JSON Schema cannot.
Do not wire a public app directly to the local research bundle or local file paths.

## What the later handoff must include

1. Versioned API contract based on these domain models, with authentication,
   upload lifecycle, asynchronous jobs, errors, cancellation and deletion semantics.
2. Fixtures for successful replay with research-only measurement, insufficient
   evidence, failed analysis and cancelled analysis. Synthetic examples are labeled.
3. Capture protocol and camera feasibility evidence, with observed/rejected
   coverage denominators. No accuracy number inferred from model confidence.
4. Privacy decisions: consent/purpose, retention, private media access, deletion
   propagation and operational logs without athlete images or private paths.
5. Which claims are supported by software checks versus human validation, and
   the exact criterion for any future metric promotion.

## Constraints already stable enough for UX discussions

- The first user trains alone; guidance must work without a coach operating the phone.
- A completed analysis can still have no usable measurement.
- `research_only`, `insufficient_evidence` and `unsupported` have `value: null`.
- Unavailable is not zero and does not mean poor technique.
- Projected front-knee flexion is a candidate observation in one capture plane.
- No ideal-angle band, technique score, causal improvement or injury claim exists.
- An internal numeric `research.json` must not be promoted into the user display.
- Comparison is `not_evaluated` for this foundation; don't draw a progress chart
  from it. Later history needs compatible capture and calibrated measurement error.

Claude can refine capture/replay and understanding with labeled mock data while
the science gate remains closed. Any expansion of visible claims returns to the
two heads and the user for review based on evidence.

## P2 checkpoint

The research backend now extracts pose through optional local adapters and can
prepare independent annotation templates. Pose artifacts are not public metric
reports. Empty templates deliberately yield `not_evaluated`; model confidence
must not be displayed as accuracy. A lost or ambiguous player association needs
an explicit new selection, not silent recovery to a different person.

The infrastructure target is Supabase Auth/PostgreSQL plus GCS, Cloud Run API and
worker, and Cloud Tasks (ADR-0001). HTTP contracts, upload/job persistence and
provider integration are the next backend wave. Hosting and frontend framework
remain Claude's decision with the user; there is no deployed API to connect yet.

# Frozen contracts 0.1.0

These five Draft 2020-12 schemas are generated from the strict Pydantic models:

```sh
uv run --frozen --offline --cache-dir /private/tmp/tennis-uv-cache python -m tennis_backend.contracts.generate_schemas
uv run --frozen --offline --cache-dir /private/tmp/tennis-uv-cache python tests/contracts/build_fixtures.py
uv run --frozen --offline --cache-dir /private/tmp/tennis-uv-cache pytest tests/contracts -q
```

Run commands from the assigned repository checkout. Generation does not read any
video or external data. Tests check committed schema bytes against regeneration
and validate each schema with `Draft202012Validator.check_schema`.

## Boundary usage

```python
from tennis_backend.contracts import ResearchInput, ResearchResult, PublicReport

research_input = ResearchInput.model_validate(input_dict)
research_result = ResearchResult.model_validate(result_dict)
public_report = PublicReport.model_validate(report_dict)
```

Use `model_validate` or `model_validate_json` at boundaries. Pydantic's explicit
escape hatches (`model_construct`, unchecked `model_copy(update=...)`) bypass
validation and must not be used to accept payloads. Models are mutable; revalidate
after editing an instance or prefer validating fresh dictionaries. No cross-model
integration is implied by validating three independently supplied artifacts.

Every listed field is required even when null is allowed. All typed objects forbid
extra fields; `ErrorEnvelope.details` is the intentional free JSON object. Numeric
fields reject booleans, strings and nonfinite values. Integer fields reject floats
in Python and JSON, including `1.0`. JSON Schema treats mathematically integral
numbers as integers, so Pydantic remains the strict boundary for that distinction.
Standard JSON cannot express NaN/Infinity; a schema consumer must use a conforming
JSON parser. The Python models additionally reject nonfinite values recursively in
error details, including when Pydantic's JSON parser encounters nonstandard tokens.

## Constraints encoded in JSON Schema

Schemas include required/null fields, closed typed objects, literals, enum values,
integer/numeric bounds, angle range [0,180], reason-code syntax, exact rational
syntax with nonzero denominators, positive time bases and basename separators.
Status conditionals also express:

- Media frames have null seconds exactly when PTS is null.
- Computed results have value/evidence, at least two numeric series samples, and
  no global reasons; insufficient results have null value/evidence and reasons.
- Null series samples have reasons; numeric series samples have none.
- Public `research_only` metrics have evidence and at least one valid attempt;
  `insufficient_evidence` has a reason and zero valid attempts.
- Failed execution requires an error. Succeeded/cancelled execution forbids an
  error. Failed/cancelled reports cannot include metrics.
- Public values, validation references and comparison deltas are always null.

No reportable metric status exists. A valid synthetic arithmetic example is not
measurement validation or permission to expose its internal numeric value.

## Invariants requiring Python validation

- Manifest `asset_id` equals `sha256:` plus its hash; indices are consecutive from
  zero; seconds equal original PTS times the exact rational time base. Seconds
  allow only two ULPs of binary-float rounding difference, with no FPS substitution
  or start-time subtraction. Missing/nonmonotonic PTS needs a global reason and
  remains inspectable. Basenames `.`/`..` and whitespace-only names are invalid.
- Research timeline indices are consecutive from zero, PTS strictly increase,
  inclusive phase endpoints resolve to the timeline, start <= end, and the phase
  contains at least two frames. Observations are unique references to timeline
  indices with matching PTS. Observation ordering is unrestricted.
- Result series indices and PTS strictly increase; computed series indices are
  also consecutive within the phase (they need not start at zero). Computed
  value/evidence equals the earliest peak in that series. An insufficient result
  may retain an empty or partial series with explicit sample-level reasons.
- Public valid + rejected = total. Every public evidence asset equals its report
  asset. Evidence indices/PTS cannot be resolved to a separate manifest here;
  the integration owner must verify that join, phase coverage and asset identity
  across input, result and report. Public `is_demo` must be set by the producer
  when the source is synthetic; no provenance field exists in the public shape.
- Error details contain only finite JSON values. Recognizable absolute Unix,
  Windows-drive and UNC paths are conservatively rejected in error text, including
  nested details/keys. Nonempty string fields named `stderr`/`command_stderr` are
  rejected. Arbitrary prose cannot be proved privacy-safe: producers still must
  use sanitized messages and structured details, never raw command diagnostics.

The model deliberately accepts missing observations, null points, degenerate
segments and finite coordinates outside the display bounds. These are research
evidence problems, not malformed structures. DS-01 owns complete-window coverage,
the <=1e-12 norm cutoff, geometric arithmetic and the resulting
`insufficient_evidence`. BE-01 does not implement metric calculations, infer pose,
resample, interpolate, clamp coordinates or assert anatomical 3D validity.

The reason vocabulary is syntactically snake_case, with no invented fixed taxonomy
beyond the frozen contract. A malformed media timeline requires a reason but this
model does not guess which producer-specific reason code describes it.

## Lifecycle helper

`can_transition(resource, from_state, to_state)` accepts resource names `asset`
and `analysis`. It permits exactly `importing -> ready/rejected`,
`queued -> running/cancelled`, and `running -> succeeded/failed/cancelled`.
Unknown inputs, self transitions, reserved deletion states and terminal restarts
return `False`. The helper does not persist jobs or mutate state.

## Fixtures

`tests/contracts/fixtures/index.json` declares the model, expected Python validity,
expected schema validity and purpose of each positive/negative example. The
differences explicitly expose cross-field constraints not expressible in standard
JSON Schema. All positive provenance is synthetic and all public fixtures have
`is_demo=true`. Hashes, probe metadata, landmarks and reported series are fabricated
for implementation tests; no actual athlete or decoded video is represented.

import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from tennis_backend import contracts
from tennis_backend.contracts.generate_schemas import MODELS, generate

FIXTURES = Path(__file__).parent / "fixtures"
REPO = Path(__file__).parents[2]
CASES = json.loads((FIXTURES / "index.json").read_text())
MODEL_BY_NAME = {model.__name__: model for model in MODELS}


def fixture(name):
    return json.loads((FIXTURES / "positive" / f"{name}.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["file"])
def test_committed_examples(case):
    """Each stored example declares Python/schema expectations independently."""
    data = json.loads((FIXTURES / case["file"]).read_text())
    model = MODEL_BY_NAME[case["model"]]
    schema = json.loads((REPO / "schemas" / f"{case['model']}.schema.json").read_text())
    assert Draft202012Validator(schema).is_valid(data) == case["schema_valid"], case["note"]
    if case["valid"]:
        parsed = model.model_validate(data)
        assert parsed.model_dump(mode="json") == data
        assert model.model_validate_json(json.dumps(data)) == parsed
        assert json.loads(parsed.model_dump_json()) == data
    else:
        with pytest.raises(ValidationError):
            model.model_validate(data)
        with pytest.raises(ValidationError):
            model.model_validate_json(json.dumps(data))


def test_schemas_are_reproducible_and_valid(tmp_path):
    generate(tmp_path)
    assert {p.name for p in (REPO / "schemas").glob("*.schema.json")} == {
        f"{model.__name__}.schema.json" for model in MODELS
    }
    for model in MODELS:
        name = f"{model.__name__}.schema.json"
        assert (REPO / "schemas" / name).read_bytes() == (tmp_path / name).read_bytes()
        Draft202012Validator.check_schema(json.loads((tmp_path / name).read_text()))


@pytest.mark.parametrize("model,name", [
    (contracts.MediaManifest, "media"), (contracts.ResearchInput, "research_input"),
    (contracts.ResearchResult, "research_result"), (contracts.PublicReport, "public_report"),
    (contracts.ErrorEnvelope, "error"),
])
def test_all_fields_are_required_and_undocumented_fields_rejected(model, name):
    original = fixture(name)
    for field in original:
        data = copy.deepcopy(original)
        del data[field]
        with pytest.raises(ValidationError):
            model.model_validate(data)
    with pytest.raises(ValidationError):
        model.model_validate({**original, "unexpected": 1})


@pytest.mark.parametrize("path", [
    ("execution",), ("comparison",), ("metrics", 0),
    ("metrics", 0, "attempts"), ("metrics", 0, "uncertainty"),
    ("metrics", 0, "evidence", 0),
])
def test_public_nested_extra_fields_rejected(path):
    data = fixture("public_report")
    nested = data
    for key in path:
        nested = nested[key]
    nested["extra"] = True
    with pytest.raises(ValidationError):
        contracts.PublicReport.model_validate(data)


@pytest.mark.parametrize("name,path", [
    ("media", ("frames", 0)), ("media", ("tool",)),
    ("research_input", ("timeline", 0)), ("research_input", ("phase_window",)),
    ("research_input", ("observations", 0)),
    ("research_input", ("observations", 0, "hip")),
    ("research_input", ("provenance",)), ("research_result", ("series", 0)),
    ("research_result", ("evidence",)), ("research_result", ("provenance",)),
])
def test_research_and_media_nested_extras_rejected(name, path):
    data = fixture(name)
    nested = data
    for key in path:
        nested = nested[key]
    nested["extra"] = True
    model = {"media": contracts.MediaManifest, "research_input": contracts.ResearchInput,
             "research_result": contracts.ResearchResult}[name]
    with pytest.raises(ValidationError):
        model.model_validate(data)


@pytest.mark.parametrize("invalid", [True, False, "3", 3.0, None])
@pytest.mark.parametrize("model,name,path", [
    (contracts.MediaManifest, "media", ("byte_size",)),
    (contracts.MediaManifest, "media", ("stream_index",)),
    (contracts.MediaManifest, "media", ("frames", 0, "frame_index")),
    (contracts.ResearchInput, "research_input", ("display_width",)),
    (contracts.ResearchInput, "research_input", ("timeline", 0, "pts")),
    (contracts.ResearchInput, "research_input", ("phase_window", "start_pts")),
    (contracts.PublicReport, "public_report", ("metrics", 0, "attempts", "total")),
    (contracts.PublicReport, "public_report", ("metrics", 0, "evidence", 0, "pts")),
])
def test_integer_fields_do_not_coerce(model, name, path, invalid):
    data = fixture(name)
    target = data
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = invalid
    with pytest.raises(ValidationError):
        model.model_validate(data)


@pytest.mark.parametrize("invalid", [True, False, "1.5", float("nan"), float("inf"), -float("inf")])
@pytest.mark.parametrize("model,name,path", [
    (contracts.MediaManifest, "media", ("duration_seconds",)),
    (contracts.MediaManifest, "media", ("rotation_degrees",)),
    (contracts.MediaManifest, "media", ("nominal_fps",)),
    (contracts.MediaManifest, "media", ("average_fps",)),
    (contracts.MediaManifest, "media", ("frames", 0, "time_seconds")),
    (contracts.ResearchInput, "research_input", ("observations", 0, "hip", "x")),
    (contracts.ResearchInput, "research_input", ("observations", 0, "ankle", "y")),
    (contracts.ResearchResult, "research_result", ("value",)),
    (contracts.ResearchResult, "research_result", ("series", 0, "value")),
])
def test_numbers_are_strict_and_finite_in_python_and_json(model, name, path, invalid):
    data = fixture(name)
    target = data
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = invalid
    with pytest.raises(ValidationError):
        model.model_validate(data)
    # Python's encoder emits NaN/Infinity tokens deliberately here. They are
    # invalid JSON and must not be accepted by Pydantic's permissive JSON parser.
    with pytest.raises(ValidationError):
        model.model_validate_json(json.dumps(data))


@pytest.mark.parametrize("invalid", [0, 1, "true", "false", None])
@pytest.mark.parametrize("model,name,key", [
    (contracts.PublicReport, "public_report", "is_demo"),
    (contracts.ErrorEnvelope, "error", "retryable"),
])
def test_booleans_are_not_coerced(model, name, key, invalid):
    data = fixture(name)
    data[key] = invalid
    with pytest.raises(ValidationError):
        model.model_validate(data)


@pytest.mark.parametrize("invalid", [float("nan"), float("inf"), -float("inf"), (1, 2), {1: "bad"}, {1, 2}, b"bad"])
def test_free_error_details_remain_finite_json(invalid):
    data = fixture("error")
    data["details"] = {"nested": [{"invalid": invalid}]}
    with pytest.raises(ValidationError):
        contracts.ErrorEnvelope.model_validate(data)


@pytest.mark.parametrize("invalid", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_error_json_rejected(invalid):
    data = fixture("error")
    data["details"] = {"nested": [invalid]}
    with pytest.raises(ValidationError):
        contracts.ErrorEnvelope.model_validate_json(json.dumps(data))


@pytest.mark.parametrize("text", [
    "/Users/example/private.mp4", "Cannot read /private/tmp/example.mp4",
    "Open('/home/example/file') failed", "C:\\Users\\example\\file.mp4",
    "Cannot open \\\\server\\private\\file.mp4",
])
def test_absolute_local_paths_are_rejected_in_errors(text):
    data = fixture("error")
    data["message"] = text
    with pytest.raises(ValidationError):
        contracts.ErrorEnvelope.model_validate(data)
    data = fixture("error")
    data["details"] = {"nested": [{"text": text}]}
    with pytest.raises(ValidationError):
        contracts.ErrorEnvelope.model_validate(data)


def test_raw_stderr_fields_are_rejected_but_urls_and_structured_diagnostics_are_allowed():
    data = fixture("error")
    data["details"] = {"nested": {"stderr": "raw command diagnostic"}}
    with pytest.raises(ValidationError):
        contracts.ErrorEnvelope.model_validate(data)
    data["details"] = {"documentation": "https://example.invalid/help", "stderr_bytes": 42}
    assert contracts.ErrorEnvelope.model_validate(data).details["stderr_bytes"] == 42


@pytest.mark.parametrize("key", ["time_base", "sample_aspect_ratio"])
@pytest.mark.parametrize("invalid", ["1/0", "1/00", "1.0/2", "1", "1/2/3", "1/2\n", " 1/2", "1/2 ", 0.5])
def test_media_ratios_are_exact_nonzero_rationals(key, invalid):
    data = fixture("media")
    data[key] = invalid
    with pytest.raises(ValidationError):
        contracts.MediaManifest.model_validate(data)


@pytest.mark.parametrize("ratio", ["1/1000", "+1/+1000", "-1/-1000", "01/01000"])
def test_equivalent_positive_timebase_strings_preserve_exact_input(ratio):
    data = fixture("media")
    data["time_base"] = ratio
    assert contracts.MediaManifest.model_validate(data).time_base == ratio


@pytest.mark.parametrize("change", [
    lambda d: d["frames"][0].update(frame_index=1),
    lambda d: d["frames"][1].update(pts=None),
    lambda d: d["frames"][1].update(time_seconds=None),
    lambda d: d["frames"][1].update(pts=1000, time_seconds=1),
    lambda d: d.update(asset_id="sha256:" + "b" * 64),
    lambda d: d.update(sha256="A" * 64),
    lambda d: d.update(nominal_fps=0),
    lambda d: d.update(average_fps=0),
    lambda d: d.update(duration_seconds=-1),
    lambda d: d.update(source_name=".."),
    lambda d: d.update(source_name="folder\\file.mp4"),
    lambda d: d.update(source_name="bad\x00.mp4"),
])
def test_media_consistency_and_boundaries(change):
    data = fixture("media")
    change(data)
    with pytest.raises(ValidationError):
        contracts.MediaManifest.model_validate(data)


def test_negative_start_pts_are_preserved_with_pts_based_seconds():
    data = fixture("media")
    for frame in data["frames"]:
        frame["pts"] -= 2000
        frame["time_seconds"] = frame["pts"] / 1000
    parsed = contracts.MediaManifest.model_validate(data)
    assert parsed.frames[0].pts == -1000
    assert parsed.frames[0].time_seconds == -1


@pytest.mark.parametrize("change", [
    lambda d: d["timeline"][0].update(frame_index=1),
    lambda d: d["timeline"][1].update(pts=None),
    lambda d: d["timeline"][1].update(pts=999),
    lambda d: d["phase_window"].update(start_pts=1080, end_pts=1000),
    lambda d: d["phase_window"].update(end_pts=1081),
    lambda d: d.update(timeline=d["timeline"][:1]),
    lambda d: d.update(time_base="0/1000"),
    lambda d: d.update(display_height=0),
    lambda d: d.update(transforms=[""]),
    lambda d: d.update(coordinate_space="normalized"),
])
def test_research_structural_preconditions(change):
    data = fixture("research_input")
    change(data)
    with pytest.raises(ValidationError):
        contracts.ResearchInput.model_validate(data)


def test_missing_observations_and_degenerate_points_remain_representable():
    data = fixture("research_input")
    data["observations"] = []
    assert contracts.ResearchInput.model_validate(data).observations == []
    data = fixture("input_degenerate")
    assert contracts.ResearchInput.model_validate(data).observations[1].hip.x == 0


@pytest.mark.parametrize("change", [
    lambda d: d.update(series=[]),
    lambda d: d.update(series=d["series"][1:2]),
    lambda d: d["series"].pop(1),
    lambda d: d["series"][1].update(frame_index=0),
    lambda d: d["series"][1].update(pts=1000),
    lambda d: d["series"].reverse(),
    lambda d: d["series"][0].update(value=-1),
    lambda d: d["series"][0].update(value=181),
    lambda d: d.update(evidence=None),
    lambda d: d.update(validation_ref="unvalidated_reference"),
    lambda d: d.update(status="insufficient_evidence", value=None, evidence=None),
])
def test_result_consistency_and_peak_invariants(change):
    data = fixture("research_result")
    change(data)
    with pytest.raises(ValidationError):
        contracts.ResearchResult.model_validate(data)


@pytest.mark.parametrize("angle", [0, 180])
def test_angle_boundaries_and_earliest_tie(angle):
    data = fixture("research_result")
    data["value"] = angle
    for point in data["series"]:
        point["value"] = angle
    data["evidence"] = {"frame_index": 0, "pts": 1000}
    assert contracts.ResearchResult.model_validate(data).value == angle


def test_computed_subwindow_series_need_not_start_at_frame_zero():
    data = fixture("research_result")
    data["series"] = data["series"][1:]
    assert contracts.ResearchResult.model_validate(data).evidence.frame_index == 1


def test_insufficient_result_can_preserve_empty_or_partial_series():
    data = fixture("result_partial")
    data["series"] = []
    assert contracts.ResearchResult.model_validate(data).series == []
    data = fixture("result_partial")
    data["series"].pop(1)
    assert len(contracts.ResearchResult.model_validate(data).series) == 2


@pytest.mark.parametrize("status", ["research_only", "insufficient_evidence", "unsupported"])
@pytest.mark.parametrize("value", [0, 90.0, False, "90"])
def test_every_public_status_requires_null_value(status, value):
    data = fixture({"research_only": "public_report", "insufficient_evidence": "report_insufficient",
                    "unsupported": "report_unsupported"}[status])
    data["metrics"][0]["value"] = value
    with pytest.raises(ValidationError):
        contracts.PublicReport.model_validate(data)


@pytest.mark.parametrize("change", [
    lambda d: d["metrics"][0]["attempts"].update(valid=True),
    lambda d: d["metrics"][0]["attempts"].update(rejected=-1, total=0),
    lambda d: d["metrics"][0].update(attempts={"valid": 0, "total": 1, "rejected": 1}),
    lambda d: d["metrics"][0].update(status="insufficient_evidence", quality_reasons=["missing_point"]),
    lambda d: d["metrics"][0].update(validation_ref="published_study"),
    lambda d: d["metrics"][0]["evidence"][0].update(frame_index=-1),
    lambda d: d["metrics"][0].update(pipeline_ref=""),
    lambda d: d["comparison"].update(delta=0),
    lambda d: d["comparison"].update(reason=""),
    lambda d: d.update(message="   "),
    lambda d: d.update(execution={"state": "queued"}),
    lambda d: d.update(execution={"state": "cancelled"}),
])
def test_public_status_counts_and_references(change):
    data = fixture("public_report")
    change(data)
    with pytest.raises(ValidationError):
        contracts.PublicReport.model_validate(data)


def test_cancelled_error_and_insufficient_without_reason_are_rejected():
    data = fixture("report_cancelled")
    data["error"] = fixture("error")
    with pytest.raises(ValidationError):
        contracts.PublicReport.model_validate(data)
    data = fixture("report_insufficient")
    data["metrics"][0]["quality_reasons"] = []
    with pytest.raises(ValidationError):
        contracts.PublicReport.model_validate(data)

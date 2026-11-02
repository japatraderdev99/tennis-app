"""Regenerate explicitly synthetic examples; no athlete/video measurements."""

import copy
import json
from pathlib import Path

ROOT = Path(__file__).parent / "fixtures"
ASSET = "sha256:" + "a" * 64
PROVENANCE = {
    "kind": "synthetic", "protocol_id": "synthetic_contract_v0",
    "annotation_ref": "fixture:synthetic_landmarks_no_pose_inference",
}
MEDIA = {
    "schema_version": "0.1.0", "asset_id": ASSET, "sha256": "a" * 64,
    "byte_size": 128, "source_name": "synthetic example.mp4", "stream_index": 0,
    "codec_name": "h264", "coded_width": 200, "coded_height": 100,
    "sample_aspect_ratio": "1/1", "rotation_degrees": None, "time_base": "1/1000",
    "duration_seconds": 0.1, "nominal_fps": 30, "average_fps": None,
    "frames": [
        {"frame_index": 0, "pts": 1000, "time_seconds": 1},
        {"frame_index": 1, "pts": 1037, "time_seconds": 1.037},
        {"frame_index": 2, "pts": 1080, "time_seconds": 1.08},
    ],
    "quality_reasons": [], "timing_basis": "original_pts",
    "temporal_resolution": "not_established",
    "tool": {"name": "ffprobe", "version": "synthetic_fixture_not_a_probe_run"},
}
INPUT = {
    "schema_version": "0.1.0", "asset_id": ASSET, "time_base": "1/1000",
    "display_width": 200, "display_height": 100,
    "coordinate_space": "display_pixels", "transforms": [], "body_side": "left",
    "phase_id": "serve_preparation", "phase_window": {"start_pts": 1000, "end_pts": 1080},
    "timeline": [{"frame_index": f["frame_index"], "pts": f["pts"]} for f in MEDIA["frames"]],
    "observations": [
        {"frame_index": 0, "pts": 1000, "hip": {"x": 0, "y": -10},
         "knee": {"x": 0, "y": 0}, "ankle": {"x": 0, "y": 10}},
        {"frame_index": 1, "pts": 1037, "hip": {"x": 0, "y": -10},
         "knee": {"x": 0, "y": 0}, "ankle": {"x": 10, "y": 0}},
        {"frame_index": 2, "pts": 1080, "hip": {"x": 0, "y": -10},
         "knee": {"x": 0, "y": 0}, "ankle": {"x": 10, "y": 0}},
    ],
    "provenance": PROVENANCE,
}
RESULT = {
    "schema_version": "0.1.0", "metric_id": "front_knee_projected_flexion_peak",
    "definition_version": "0.1.0", "asset_id": ASSET, "status": "computed",
    "value": 90, "unit": "deg", "body_side": "left", "phase_id": "serve_preparation",
    "evidence": {"frame_index": 1, "pts": 1037},
    "series": [
        {"frame_index": 0, "pts": 1000, "value": 0, "quality_reasons": []},
        {"frame_index": 1, "pts": 1037, "value": 90, "quality_reasons": []},
        {"frame_index": 2, "pts": 1080, "value": 90, "quality_reasons": []},
    ],
    "quality_reasons": [], "method_version": "m01_unfiltered_complete_window_v0",
    "filter": "none", "validation_ref": None, "uncertainty": {"status": "not_established"},
    "provenance": PROVENANCE,
}
REPORT = {
    "schema_version": "0.1.0", "report_id": "demo-report", "session_id": "demo-session",
    "run_id": "demo-run", "asset_id": ASSET, "is_demo": True,
    "execution": {"state": "succeeded"},
    "metrics": [{
        "metric_id": "front_knee_projected_flexion_peak", "definition_version": "0.1.0",
        "status": "research_only", "value": None, "unit": "deg",
        "measurement_space": "image_2d_projected", "body_side": "left",
        "phase_id": "serve_preparation", "validation_ref": None,
        "uncertainty": {"status": "not_established"}, "quality_reasons": [],
        "evidence": [{"asset_id": ASSET, "frame_index": 1, "pts": 1037}],
        "attempts": {"total": 1, "valid": 1, "rejected": 0},
        "pipeline_ref": "fixture:m01_unfiltered_complete_window_v0",
    }],
    "comparison": {"state": "not_evaluated", "delta": None, "reason": "No validated history."},
    "message": "Synthetic landmarks only; no pose inference or biomechanical validation.",
    "error": None,
}
ERROR = {
    "schema_version": "0.1.0", "code": "inspection_failed",
    "message": "Synthetic inspection failed.", "retryable": False,
    "details": {"stage": "inspection", "synthetic": True, "limits": [1, None, {"seconds": 2.5}]},
}


def generate() -> None:
    cases = []

    def example(name, model, source, *, valid=True, schema_valid=None, change=None, note):
        data = copy.deepcopy(source)
        if change:
            change(data)
        file = f"{'positive' if valid else 'negative'}/{name}.json"
        (ROOT / file).write_text(json.dumps(data, indent=2, allow_nan=False) + "\n")
        cases.append({"file": file, "model": model, "valid": valid,
                      "schema_valid": valid if schema_valid is None else schema_valid, "note": note})

    example("media", "MediaManifest", MEDIA, note="Nonzero starting PTS and irregular intervals.")
    example("research_input", "ResearchInput", INPUT, note="Synthetic coordinates may be outside display bounds.")
    example("research_result", "ResearchResult", RESULT, note="Peak tie selects earliest PTS; internal values only.")
    example("public_report", "PublicReport", REPORT, note="Public value is null despite a computed research artifact.")
    example("error", "ErrorEnvelope", ERROR, note="Sanitized synthetic error with nested finite JSON details.")

    def missing_pts(d):
        d["frames"][1].update(pts=None, time_seconds=None)
        d["quality_reasons"] = ["missing_pts"]
    example("media_missing_pts", "MediaManifest", MEDIA, change=missing_pts,
            note="Missing original PTS remains inspectable with explicit reason.")
    def nonmonotonic(d):
        d["frames"][2].update(pts=1000, time_seconds=1)
        d["quality_reasons"] = ["nonmonotonic_pts"]
    example("media_nonmonotonic", "MediaManifest", MEDIA, change=nonmonotonic,
            note="Nonmonotonic timeline remains inspectable; research input rejects it.")
    example("input_partial", "ResearchInput", INPUT, change=lambda d: d["observations"].pop(1),
            note="Missing observation is representable for insufficient_evidence processing.")
    example("input_missing_point", "ResearchInput", INPUT,
            change=lambda d: d["observations"][1].update(knee=None),
            note="Null point is inadequate evidence, not malformed structure.")
    example("input_degenerate", "ResearchInput", INPUT,
            change=lambda d: d["observations"][1].update(hip={"x": 0, "y": 0}),
            note="Degenerate segment is representable; metrics must reject the attempt.")
    def insufficient_result(d):
        d.update(status="insufficient_evidence", value=None, evidence=None,
                 quality_reasons=["missing_landmark"])
        d["series"][1].update(value=None, quality_reasons=["missing_landmark"])
    example("result_partial", "ResearchResult", RESULT, change=insufficient_result,
            note="Partial series preserves usable samples alongside explicit missing evidence.")
    def insufficient_report(d):
        d["metrics"][0].update(status="insufficient_evidence", evidence=[], body_side=None,
                             quality_reasons=["missing_landmark"],
                             attempts={"total": 1, "valid": 0, "rejected": 1})
    example("report_insufficient", "PublicReport", REPORT, change=insufficient_report,
            note="Successful execution can have no computationally usable attempt.")
    def unsupported_report(d):
        insufficient_report(d)
        d["metrics"][0].update(status="unsupported", quality_reasons=["unsupported_input"],
                             attempts={"total": 0, "valid": 0, "rejected": 0})
    example("report_unsupported", "PublicReport", REPORT, change=unsupported_report,
            note="Unsupported status has no public numeric value.")
    example("report_empty_success", "PublicReport", REPORT, change=lambda d: d.update(metrics=[]),
            note="Successful execution may contain no metrics.")
    example("report_failed", "PublicReport", REPORT,
            change=lambda d: d.update(metrics=[], execution={"state": "failed"}, error=ERROR),
            note="Failed execution requires an error and no metrics.")
    example("report_cancelled", "PublicReport", REPORT,
            change=lambda d: d.update(metrics=[], execution={"state": "cancelled"}),
            note="Cancelled execution has neither metrics nor error.")

    def negative(name, model, source, change, *, schema_valid=False, note):
        example(name, model, source, valid=False, schema_valid=schema_valid, change=change, note=note)

    negative("media_asset_mismatch", "MediaManifest", MEDIA, lambda d: d.update(asset_id="different"),
             schema_valid=True, note="Python checks asset_id against the hash.")
    negative("media_boolean_integer", "MediaManifest", MEDIA, lambda d: d.update(byte_size=True),
             note="A JSON boolean is not an integer.")
    negative("media_float_integer", "MediaManifest", MEDIA, lambda d: d.update(byte_size=128.0),
             schema_valid=True, note="Strict Pydantic rejects 128.0; JSON Schema integer is mathematical.")
    negative("media_path", "MediaManifest", MEDIA, lambda d: d.update(source_name="/private/synthetic.mp4"),
             note="source_name must be basename only.")
    negative("media_zero_denominator", "MediaManifest", MEDIA, lambda d: d.update(time_base="1/0"),
             note="Time base has a nonzero denominator.")
    negative("media_negative_timebase", "MediaManifest", MEDIA, lambda d: d.update(time_base="-1/1000"),
             note="Time base must be positive.")
    negative("media_guessed_time", "MediaManifest", MEDIA,
             lambda d: d["frames"][1].update(time_seconds=1 / 30), schema_valid=True,
             note="Nominal FPS cannot replace PTS time.")
    negative("media_unmarked_missing", "MediaManifest", MEDIA,
             lambda d: d["frames"][1].update(pts=None, time_seconds=None), schema_valid=True,
             note="Missing PTS requires a global reason.")
    negative("input_pts_mismatch", "ResearchInput", INPUT,
             lambda d: d["observations"][1].update(pts=1038), schema_valid=True,
             note="Observation PTS must resolve to its timeline frame.")
    negative("input_duplicate_observation", "ResearchInput", INPUT,
             lambda d: d["observations"].append(copy.deepcopy(d["observations"][0])), schema_valid=True,
             note="No duplicate observation frame references.")
    negative("input_unknown_frame", "ResearchInput", INPUT,
             lambda d: d["observations"][1].update(frame_index=3), schema_valid=True,
             note="Observations cannot reference a frame outside the timeline.")
    negative("input_nonmonotonic", "ResearchInput", INPUT,
             lambda d: d["timeline"][1].update(pts=1000), schema_valid=True,
             note="A research timeline must have strictly increasing PTS.")
    negative("input_phase_unknown", "ResearchInput", INPUT,
             lambda d: d["phase_window"].update(start_pts=1001), schema_valid=True,
             note="Phase endpoints must coincide with timeline entries.")
    example("input_one_phase_frame", "ResearchInput", INPUT,
            change=lambda d: d["phase_window"].update(start_pts=1080),
            note="One frame is representable input; computation must return insufficient evidence.")
    negative("result_later_tie", "ResearchResult", RESULT,
             lambda d: d.update(evidence={"frame_index": 2, "pts": 1080}), schema_valid=True,
             note="Earliest PTS wins a peak tie.")
    negative("result_wrong_peak", "ResearchResult", RESULT,
             lambda d: d.update(value=89), schema_valid=True, note="Peak value must agree with raw series.")
    negative("result_wrong_evidence_pts", "ResearchResult", RESULT,
             lambda d: d["evidence"].update(pts=1038), schema_valid=True,
             note="Evidence frame and PTS must identify the same peak series entry.")
    negative("result_out_of_range", "ResearchResult", RESULT,
             lambda d: d.update(value=181), note="Projected flexion is bounded to [0,180].")
    negative("result_null_without_reason", "ResearchResult", RESULT,
             lambda d: d["series"][0].update(value=None), note="Null series sample requires a reason.")
    negative("result_number_with_reason", "ResearchResult", RESULT,
             lambda d: d["series"][0].update(quality_reasons=["missing_landmark"]),
             note="Numeric series samples cannot carry failure reasons.")
    negative("result_insufficient_numeric", "ResearchResult", RESULT,
             lambda d: d.update(status="insufficient_evidence", quality_reasons=["missing_landmark"]),
             note="Insufficient result cannot retain the computed value/evidence.")
    negative("result_global_reason", "ResearchResult", RESULT,
             lambda d: d.update(quality_reasons=["missing_landmark"]),
             note="Computed result has no global quality reason.")
    negative("public_numeric_leak", "PublicReport", REPORT,
             lambda d: d["metrics"][0].update(value=90), note="Public numeric values are always forbidden.")
    negative("public_reportable", "PublicReport", REPORT,
             lambda d: d["metrics"][0].update(status="reportable"), note="No reportable status exists in v0.")
    negative("public_bad_counts", "PublicReport", REPORT,
             lambda d: d["metrics"][0]["attempts"].update(total=2), schema_valid=True,
             note="Python checks valid + rejected = total.")
    negative("public_wrong_asset", "PublicReport", REPORT,
             lambda d: d["metrics"][0]["evidence"][0].update(asset_id="different"), schema_valid=True,
             note="Evidence asset must match its containing report.")
    negative("public_missing_evidence", "PublicReport", REPORT,
             lambda d: d["metrics"][0].update(evidence=[]), note="Research-only requires evidence.")
    negative("public_failed_metrics", "PublicReport", REPORT,
             lambda d: d.update(execution={"state": "failed"}, error=ERROR),
             note="Failed reports cannot contain metrics.")
    negative("public_failed_no_error", "PublicReport", REPORT,
             lambda d: d.update(execution={"state": "failed"}, metrics=[]),
             note="Failed execution requires an error envelope.")
    negative("public_success_error", "PublicReport", REPORT, lambda d: d.update(error=ERROR),
             note="Succeeded execution cannot contain an error.")
    negative("public_coerced_bool", "PublicReport", REPORT, lambda d: d.update(is_demo="true"),
             note="String booleans must not be coerced.")
    negative("error_extra", "ErrorEnvelope", ERROR, lambda d: d.update(undocumented="extra"),
             note="Unknown fields are rejected.")
    negative("error_bad_reason_code", "ErrorEnvelope", ERROR, lambda d: d.update(code="Invalid code"),
             note="Error/reason codes use stable snake_case.")
    negative("error_absolute_path", "ErrorEnvelope", ERROR,
             lambda d: d.update(message="Cannot open /Users/synthetic/private.mp4"), schema_valid=True,
             note="Python rejects recognizable absolute local paths in error text.")
    negative("error_raw_stderr", "ErrorEnvelope", ERROR,
             lambda d: d.update(details={"stderr": "synthetic raw command dump"}), schema_valid=True,
             note="Python rejects nonempty raw stderr string fields in error details.")
    negative("error_missing_nullable", "PublicReport", REPORT, lambda d: d.pop("error"),
             note="Nullable fields are still required.")
    (ROOT / "index.json").write_text(json.dumps(cases, indent=2) + "\n")


if __name__ == "__main__":
    generate()

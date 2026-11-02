import copy
import json
from decimal import Decimal
from fractions import Fraction

import pytest

from tennis_backend.evaluation import evaluate_keypoints, make_annotation_template


def set_path(data, path, value):
    for part in path[:-1]:
        data = data[part]
    data[path[-1]] = value


def test_template_is_independent_selected_evidence_only(artifact, selection):
    before = copy.deepcopy((artifact, selection))
    template = make_annotation_template(artifact, selection)
    assert (artifact, selection) == before
    assert template["asset_id"] == artifact["asset_id"]
    assert template["time_base"] == "1/1000"
    assert template["review_status"] == "unreviewed"
    assert template["annotator_id"] is None
    assert len(template["frames"]) == 1
    frame = template["frames"][0]
    assert (frame["frame_index"], frame["pts"], frame["detection_id"]) == (1, 144, "target")
    assert (frame["display_width"], frame["display_height"]) == (640, 360)
    assert [point["name"] for point in frame["keypoints"]] == [
        point["name"] for point in artifact["frames"][1]["detections"][0]["keypoints"]
    ]
    assert all(point["x"] is None and point["y"] is None and point["visibility"] == "unreviewed"
               for point in frame["keypoints"])
    template["frames"][0]["keypoints"][0]["x"] = 999
    assert (artifact, selection) == before


def test_unreviewed_template_never_evaluates(artifact, selection):
    template = make_annotation_template(artifact, selection)
    result = evaluate_keypoints(artifact, template)
    assert result == {
        "evaluation_schema_version": "0.1.0", "status": "not_evaluated",
        "asset_id": artifact["asset_id"], "reference_points": 0, "matched_points": 0,
        "missing_predictions": 0, "mean_error_px": None, "median_error_px": None,
        "coverage": None, "reasons": ["annotations_unreviewed"], "validation_ref": None,
    }


def test_partial_annotation_with_unreviewed_status_is_not_scored(artifact, visible_references):
    visible_references["review_status"] = "unreviewed"
    result = evaluate_keypoints(artifact, visible_references)
    assert result["reference_points"] == 0
    assert result["coverage"] is None
    assert result["reasons"] == ["annotations_unreviewed"]


def test_known_errors_subset_and_exact_target(artifact, visible_references):
    before = copy.deepcopy((artifact, visible_references))
    result = evaluate_keypoints(artifact, visible_references)
    assert (artifact, visible_references) == before
    assert result["status"] == "computed"
    assert result["reference_points"] == result["matched_points"] == 3
    assert result["missing_predictions"] == 0
    assert result["mean_error_px"] == pytest.approx(11 / 3)
    assert result["median_error_px"] == 5
    assert result["coverage"] == 1
    assert result["reasons"] == []
    assert result["validation_ref"] is None
    json.dumps(result, allow_nan=False)


def test_missing_keypoint_stays_in_denominator(artifact, visible_references):
    artifact["frames"][1]["detections"][0]["keypoints"][0].update(x=None, y=None)
    result = evaluate_keypoints(artifact, visible_references)
    assert (result["reference_points"], result["matched_points"], result["missing_predictions"]) == (3, 2, 1)
    assert result["reference_points"] == result["matched_points"] + result["missing_predictions"]
    assert result["coverage"] == pytest.approx(2 / 3)
    assert result["mean_error_px"] == result["median_error_px"] == 3
    assert result["reasons"] == ["missing_predictions"]


@pytest.mark.parametrize("missing", ["all_detections", "target_only", "unknown_id", "null_id"])
def test_missing_detection_counts_failure_without_guessing_person(artifact, visible_references, missing):
    if missing == "all_detections":
        artifact["frames"][1]["detections"] = []
    elif missing == "target_only":
        artifact["frames"][1]["detections"].pop(0)
    else:
        visible_references["frames"][0]["detection_id"] = None if missing == "null_id" else "absent"
    result = evaluate_keypoints(artifact, visible_references)
    assert result["status"] == "computed"
    assert result["reference_points"] == result["missing_predictions"] == 3
    assert result["matched_points"] == result["coverage"] == 0
    assert result["mean_error_px"] is None and result["median_error_px"] is None
    assert result["reasons"] == ["missing_predictions", "no_matched_predictions"]


def test_zero_visible_references_is_not_zero_accuracy(artifact, references):
    references["frames"][0]["keypoints"][0]["visibility"] = "out_of_frame"
    result = evaluate_keypoints(artifact, references)
    assert result["status"] == "not_evaluated"
    assert result["coverage"] is None and result["mean_error_px"] is None and result["median_error_px"] is None
    assert result["reference_points"] == result["matched_points"] == result["missing_predictions"] == 0
    assert result["reasons"] == ["no_visible_reference_points"]


def test_empty_reviewed_subset_is_not_evaluated(artifact, references):
    references["frames"] = []
    assert evaluate_keypoints(artifact, references)["reasons"] == ["no_visible_reference_points"]


def test_model_scores_and_visibility_do_not_filter_errors(artifact, visible_references):
    for point in artifact["frames"][1]["detections"][0]["keypoints"]:
        point.update(score=-99, visibility=0, presence=0)
    point = artifact["frames"][1]["detections"][0]["keypoints"][0]
    point["x"] = -30
    result = evaluate_keypoints(artifact, visible_references)
    assert result["matched_points"] == 3 and result["coverage"] == 1
    assert result["mean_error_px"] == pytest.approx((37 ** 2 + 4 ** 2) ** 0.5 / 3 + 2)


def test_sparse_pose_artifact_and_irregular_original_pts_are_allowed(artifact, references):
    artifact["frames"][2]["frame_index"] = 20
    references["frames"][0]["frame_index"] = 20
    references["frames"][0]["pts"] = 201
    assert evaluate_keypoints(artifact, references)["status"] == "not_evaluated"


@pytest.mark.parametrize("field,value", [
    ("asset_id", "sha256:" + "b" * 64), ("time_base", "2/2000"),
    ("coordinate_space", "normalized"), ("keypoint_schema", "other"),
    ("annotation_schema_version", "0.2.0"),
])
def test_incompatible_annotation_header_is_rejected_even_unreviewed(artifact, references, field, value):
    references[field] = value
    references["review_status"] = "unreviewed"
    with pytest.raises(ValueError):
        evaluate_keypoints(artifact, references)


@pytest.mark.parametrize("field,value", [
    ("frame_index", 50), ("pts", 145), ("display_width", 641), ("display_height", 361),
])
def test_incompatible_annotation_evidence_is_rejected(artifact, references, field, value):
    references["frames"][0][field] = value
    with pytest.raises(ValueError):
        evaluate_keypoints(artifact, references)


@pytest.mark.parametrize("mutate", [
    lambda a: a.update(annotator_id=None),
    lambda a: a.update(annotator_id="  "),
    lambda a: a["frames"][0]["keypoints"][0].update(visibility="unreviewed"),
    lambda a: a["frames"][0]["keypoints"][0].update(visibility="visible"),
    lambda a: a["frames"][0]["keypoints"][0].update(x=10, y=10),
    lambda a: a["frames"][0]["keypoints"][0].update(x=10),
    lambda a: a["frames"][0]["keypoints"].pop(),
    lambda a: a["frames"][0]["keypoints"].reverse(),
    lambda a: a["frames"][0]["keypoints"][1].update(name="nose"),
    lambda a: a["frames"].append(copy.deepcopy(a["frames"][0])),
    lambda a: a["frames"][0].update(unknown=1),
    lambda a: a.update(unknown=1),
])
def test_bad_annotation_semantics_are_rejected(artifact, references, mutate):
    mutate(references)
    with pytest.raises(ValueError):
        evaluate_keypoints(artifact, references)


@pytest.mark.parametrize("bad", [True, "4", float("nan"), float("inf"), -float("inf"), Decimal("4"), Fraction(1, 2)])
@pytest.mark.parametrize("subject", ["prediction", "reference"])
def test_coordinates_reject_non_json_numbers(artifact, visible_references, bad, subject):
    points = (artifact["frames"][1]["detections"][0]["keypoints"] if subject == "prediction"
              else visible_references["frames"][0]["keypoints"])
    points[0]["x"] = bad
    with pytest.raises(ValueError):
        evaluate_keypoints(artifact, visible_references)


@pytest.mark.parametrize("path,value", [
    (("pose_schema_version",), "0.2.0"),
    (("asset_id",), "sha256:" + "A" * 64),
    (("time_base",), "0/1"), (("time_base",), "1/0"), (("time_base",), "1.0/2"),
    (("frames",), []), (("frames", 0, "frame_index"), True),
    (("frames", 0, "pts"), 101.0), (("frames", 1, "pts"), 101),
    (("frames", 1, "frame_index"), 0), (("frames", 1, "display_width"), 1),
    (("frames", 0, "display_height"), 0),
    (("frames", 1, "detections", 0, "bbox", "x2"), 0),
    (("frames", 1, "detections", 0, "bbox", "x1"), float("inf")),
    (("frames", 1, "detections", 1, "detection_id"), "target"),
    (("frames", 1, "detections", 0, "keypoints", 0, "y"), None),
    (("frames", 1, "detections", 0, "keypoints", 0, "visibility"), 1.01),
    (("frames", 1, "detections", 0, "keypoints", 0, "presence"), -0.1),
    (("frames", 1, "detections", 0, "keypoints", 0, "score"), True),
    (("frames", 1, "detections", 0, "keypoints", 0, "name"), "other"),
    (("provenance", "parameters"), {"nested": [float("nan")]}),
    (("provenance", "parameters"), {"nested": (1, 2)}),
    (("provenance", "parameters"), {1: "not_a_json_key"}),
    (("provenance", "model_files", 0, "sha256"), "wrong"),
    (("validation_ref",), "claimed_validated"),
    (("measurement_status",), "reportable"),
])
def test_invalid_pose_is_rejected_by_both_entrypoints(artifact, references, selection, path, value):
    set_path(artifact, path, value)
    with pytest.raises(ValueError):
        evaluate_keypoints(artifact, references)
    with pytest.raises(ValueError):
        make_annotation_template(artifact, selection)


@pytest.mark.parametrize("path,value", [
    (("asset_id",), "sha256:" + "c" * 64), (("time_base",), "2/2000"),
    (("parameters", "min_iou"), 0), (("parameters", "min_iou"), True),
    (("parameters", "min_iou"), 1.1), (("parameters", "ambiguity_margin"), -0.1),
    (("parameters", "ambiguity_margin"), True), (("parameters", "ambiguity_margin"), float("nan")),
    (("frames", 1, "pts"), 145), (("frames", 1, "detection_id"), "absent"),
    (("seed", "detection_id"), "other"), (("seed", "frame_index"), 100),
    (("frames", 1, "reason"), "wrong"), (("frames", 0, "reason"), None),
    (("frames", 0, "detection_id"), "target"),
    (("frames", 0, "status"), "ambiguous"), (("frames", 2, "status"), "not_started"),
    (("frames", 2, "reason"), "Not a code"), (("unknown",), 1),
])
def test_incompatible_selection_is_rejected(artifact, selection, path, value):
    set_path(selection, path, value)
    with pytest.raises(ValueError):
        make_annotation_template(artifact, selection)


def test_selection_missing_timeline_frame_is_rejected(artifact, selection):
    selection["frames"].pop()
    with pytest.raises(ValueError, match="timeline"):
        make_annotation_template(artifact, selection)


def test_selection_does_not_resume_after_loss(artifact, selection):
    selection["seed"]["frame_index"] = 0
    selection["frames"][0].update(status="selected", detection_id="target", reason=None)
    selection["frames"][1].update(status="ambiguous", detection_id=None, reason="ambiguous_candidates")
    selection["frames"][2].update(status="selected", detection_id="target", reason=None)
    with pytest.raises(ValueError, match="resume"):
        make_annotation_template(artifact, selection)


def test_selection_cannot_select_over_source_gap(artifact, selection):
    artifact["frames"][2]["frame_index"] = 20
    selection["frames"][2].update(frame_index=20, status="selected", detection_id="target", reason=None)
    with pytest.raises(ValueError, match="gap"):
        make_annotation_template(artifact, selection)


def test_template_excludes_valid_ambiguous_frame(artifact, selection):
    artifact["frames"][2]["detections"] = []
    selection["frames"][2].update(status="ambiguous", reason="ambiguous_candidates")
    assert len(make_annotation_template(artifact, selection)["frames"]) == 1


def test_selected_missing_detection_is_rejected(artifact, selection):
    artifact["frames"][1]["detections"] = []
    with pytest.raises(ValueError, match="absent"):
        make_annotation_template(artifact, selection)


def test_required_nullable_fields_cannot_be_omitted(artifact, references, selection):
    del references["annotator_id"]
    with pytest.raises(ValueError):
        evaluate_keypoints(artifact, references)
    del selection["validation_ref"]
    with pytest.raises(ValueError):
        make_annotation_template(artifact, selection)


def test_non_dict_inputs_are_rejected(artifact, references):
    for bad in (None, [], "{}", True):
        with pytest.raises(ValueError):
            evaluate_keypoints(bad, references)
        with pytest.raises(ValueError):
            evaluate_keypoints(artifact, bad)
        with pytest.raises(ValueError):
            make_annotation_template(artifact, bad)


def test_aggregate_large_representable_errors_without_overflow(artifact, visible_references):
    for index in range(3):
        artifact["frames"][1]["detections"][0]["keypoints"][index].update(x=1e308, y=0)
        visible_references["frames"][0]["keypoints"][index].update(x=0, y=0)
    result = evaluate_keypoints(artifact, visible_references)
    assert result["mean_error_px"] == result["median_error_px"] == 1e308
    # Exercise even median as well.
    visible_references["frames"][0]["keypoints"][2].update(x=None, y=None, visibility="occluded")
    assert evaluate_keypoints(artifact, visible_references)["median_error_px"] == 1e308


def test_unrepresentable_error_is_rejected_instead_of_emitting_infinity(artifact, visible_references):
    artifact["frames"][1]["detections"][0]["keypoints"][0].update(x=1e308, y=0)
    visible_references["frames"][0]["keypoints"][0].update(x=-1e308, y=0)
    with pytest.raises(ValueError, match="finite pixel"):
        evaluate_keypoints(artifact, visible_references)


@pytest.mark.parametrize("distance", [0.0, 5e-324, 1.7976931348623157e308])
def test_representable_extreme_mean_and_even_median(artifact, visible_references, distance):
    for index in range(3):
        artifact["frames"][1]["detections"][0]["keypoints"][index].update(x=distance, y=0)
        visible_references["frames"][0]["keypoints"][index].update(x=0, y=0)
    result = evaluate_keypoints(artifact, visible_references)
    assert result["mean_error_px"] == distance
    assert result["median_error_px"] == distance
    visible_references["frames"][0]["keypoints"][2].update(x=None, y=None, visibility="out_of_frame")
    result = evaluate_keypoints(artifact, visible_references)
    assert result["mean_error_px"] == result["median_error_px"] == distance


def test_multiple_reference_frames_keep_failures_in_global_denominator(artifact, visible_references):
    extra = copy.deepcopy(visible_references["frames"][0])
    extra.update(frame_index=2, pts=201)
    visible_references["frames"].append(extra)
    artifact["frames"][2]["detections"] = []
    result = evaluate_keypoints(artifact, visible_references)
    assert result["reference_points"] == 6
    assert result["matched_points"] == result["missing_predictions"] == 3
    assert result["coverage"] == 0.5
    assert result["mean_error_px"] == pytest.approx(11 / 3)
    assert result["median_error_px"] == 5


def test_reference_frames_must_be_in_original_order(artifact, visible_references):
    earlier = copy.deepcopy(visible_references["frames"][0])
    earlier.update(frame_index=0, pts=101)
    visible_references["frames"].append(earlier)
    with pytest.raises(ValueError, match="strictly increasing"):
        evaluate_keypoints(artifact, visible_references)


def test_all_null_predictions_are_missing_without_zero_fill(artifact, visible_references):
    for point in artifact["frames"][1]["detections"][0]["keypoints"]:
        point.update(x=None, y=None)
    result = evaluate_keypoints(artifact, visible_references)
    assert result["missing_predictions"] == result["reference_points"] == 3
    assert result["coverage"] == 0
    assert result["mean_error_px"] is None and result["median_error_px"] is None


def test_unknown_nested_fields_are_rejected(artifact, references):
    artifact["frames"][1]["detections"][0]["keypoints"][0]["extra"] = "undocumented"
    with pytest.raises(ValueError):
        evaluate_keypoints(artifact, references)


def test_duplicate_prediction_keypoint_name_is_rejected(artifact, references):
    artifact["frames"][1]["detections"][0]["keypoints"][1]["name"] = "nose"
    with pytest.raises(ValueError, match="COCO17"):
        evaluate_keypoints(artifact, references)

"""Synthetic geometry tests; these do not establish athlete identity accuracy."""

from copy import deepcopy
from decimal import Decimal
import json
import re

import pytest

from tennis_backend.selection import select_target


NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
    "right_knee", "left_ankle", "right_ankle",
)


def detection(identifier="target", box=(0, 0, 10, 10)):
    return {
        "detection_id": identifier,
        "bbox": dict(zip(("x1", "y1", "x2", "y2"), box)),
        "keypoints": [
            {"name": name, "x": None, "y": None, "score": None,
             "visibility": None, "presence": None}
            for name in NAMES
        ],
    }


def frame(index, *detections, pts=None):
    return {"frame_index": index, "pts": 1000 + index * 40 if pts is None else pts,
            "display_width": 640, "display_height": 480,
            "detections": list(detections)}


def artifact(*frames):
    return {
        "pose_schema_version": "0.1.0", "asset_id": "sha256:" + "a" * 64,
        "time_base": "1/1000", "coordinate_space": "display_pixels",
        "keypoint_schema": "coco17", "frames": list(frames),
        "provenance": {
            "kind": "model_inference", "adapter": "rtmpose",
            "adapter_version": "synthetic-contract-fixture",
            "model_files": [{"role": "pose", "sha256": "b" * 64}],
            "runtime": {"fixture": "synthetic"},
            "parameters": {"synthetic": True, "nested": [None, 1, 0.2, "test"]},
            "transforms": [],
        },
        "validation_ref": None, "measurement_status": "research_only",
    }


def select(value, **kwargs):
    return select_target(value, **{
        "seed_frame_index": 0, "seed_detection_id": "target", **kwargs,
    })


def statuses(result):
    return [item["status"] for item in result["frames"]]


def test_exact_seed_beats_larger_spectator_and_has_bound_json_output():
    source = artifact(
        frame(0, detection("spectator", (-100, -100, 500, 500))),
        frame(1, detection("spectator", (-100, -100, 500, 500)), detection()),
        frame(2, detection("spectator", (-100, -100, 500, 500)),
              detection("new_frame_local_id", (1, 0, 11, 10))),
    )
    original = deepcopy(source)
    result = select(source, seed_frame_index=1)
    assert source == original
    assert statuses(result) == ["not_started", "selected", "selected"]
    assert result == {
        "selection_schema_version": "0.1.0", "asset_id": source["asset_id"],
        "time_base": "1/1000", "method": "conservative_iou_v0",
        "seed": {"frame_index": 1, "detection_id": "target"},
        "parameters": {"min_iou": 0.2, "ambiguity_margin": 0.05},
        "frames": [
            {"frame_index": 0, "pts": 1000, "status": "not_started",
             "detection_id": None, "reason": "before_seed"},
            {"frame_index": 1, "pts": 1040, "status": "selected",
             "detection_id": "target", "reason": None},
            {"frame_index": 2, "pts": 1080, "status": "selected",
             "detection_id": "new_frame_local_id", "reason": None},
        ], "validation_ref": None,
    }
    assert json.loads(json.dumps(result, allow_nan=False)) == result


def test_ids_are_not_identity_and_association_uses_last_selected_box():
    result = select(artifact(
        frame(0, detection()),
        frame(1, detection("target", (300, 300, 400, 400)),
              detection("other_id", (5, 0, 15, 10))),
        frame(2, detection("third_id", (10, 0, 20, 10))),
    ))
    assert [item["detection_id"] for item in result["frames"]] == [
        "target", "other_id", "third_id",
    ]


@pytest.mark.parametrize("reverse", [False, True])
def test_crossing_ambiguity_never_silently_reacquires(reverse):
    crossing = [detection("target", (4, 0, 14, 10)),
                detection("opponent", (-4, 0, 6, 10))]
    if reverse:
        crossing.reverse()
    source = artifact(
        frame(0, detection()), frame(1, *crossing),
        frame(2, detection("target"), detection("opponent", (50, 0, 60, 10))),
        frame(3, detection("target")),
    )
    result = select(source)
    assert statuses(result) == ["selected", "ambiguous", "lost", "lost"]
    assert result["frames"][1]["reason"] == "ambiguous_iou"
    assert all(item["detection_id"] is None for item in result["frames"][1:])
    assert result["frames"][2]["reason"] == "reseed_required"
    # Only a fresh, explicitly seeded call can restart after the crossing.
    reseeded = select(source, seed_frame_index=2)
    assert statuses(reseeded) == ["not_started", "not_started", "selected", "selected"]


@pytest.mark.parametrize("next_detections,reason", [
    ([], "no_detections"),
    ([detection("spectator", (100, 100, 200, 200))], "iou_below_threshold"),
    ([detection("target", (10, 0, 20, 10))], "iou_below_threshold"),
])
def test_loss_cannot_switch_to_spectator_or_reappear(next_detections, reason):
    result = select(artifact(
        frame(0, detection()), frame(1, *next_detections),
        frame(2, detection()), frame(3, detection()),
    ))
    assert statuses(result) == ["selected", "lost", "lost", "lost"]
    assert result["frames"][1]["reason"] == reason
    assert result["frames"][2]["reason"] == "reseed_required"
    assert all(item["detection_id"] is None for item in result["frames"][1:])


def test_source_frame_gap_stops_but_sparse_frames_before_seed_are_valid():
    source = artifact(frame(2, detection()), frame(8, detection()),
                      frame(9, detection()), frame(11, detection()),
                      frame(12, detection()))
    result = select(source, seed_frame_index=8)
    assert statuses(result) == ["not_started", "selected", "selected", "lost", "lost"]
    assert result["frames"][3]["reason"] == "frame_gap"


def test_irregular_negative_original_pts_preserved_without_nominal_fps():
    source = artifact(frame(0, detection(), pts=-200),
                      frame(1, detection(), pts=-199),
                      frame(2, detection(), pts=55555))
    source["time_base"] = "2/180000"
    result = select(source)
    assert statuses(result) == ["selected"] * 3
    assert result["time_base"] == "2/180000"
    assert [item["pts"] for item in result["frames"]] == [-200, -199, 55555]


def test_threshold_and_ambiguity_margin_boundaries_are_inclusive():
    # Boxes have exact IoUs of 1/2 and 1/4 against the seed.
    source = artifact(frame(0, detection(box=(0, 0, 4, 4))), frame(
        1, detection("best", (0, 0, 2, 4)), detection("runner", (0, 0, 1, 4))))
    assert statuses(select(source, min_iou=0.5, ambiguity_margin=0.25)) == [
        "selected", "ambiguous",
    ]
    assert statuses(select(source, min_iou=0.5, ambiguity_margin=0.24)) == [
        "selected", "selected",
    ]
    assert statuses(select(source, min_iou=0.51)) == ["selected", "lost"]


def test_candidate_below_threshold_still_makes_near_tie_ambiguous():
    source = artifact(frame(0, detection(box=(0, 0, 4, 4))), frame(
        1, detection("best", (0, 0, 2, 4)), detection("runner", (0, 0, 1, 4))))
    assert statuses(select(source, min_iou=0.5, ambiguity_margin=0.25))[-1] == "ambiguous"


def test_exact_tie_with_zero_margin_is_ambiguous():
    result = select(artifact(frame(0, detection()),
                             frame(1, detection("a"), detection("b"))),
                    ambiguity_margin=0)
    assert statuses(result) == ["selected", "ambiguous"]


def test_unit_threshold_accepts_identical_boxes():
    assert statuses(select(artifact(frame(0, detection()), frame(1, detection())),
                           min_iou=1)) == ["selected", "selected"]


def test_decimal_threshold_and_margin_equality_do_not_fail_from_binary_rounding():
    source = artifact(frame(0, detection(box=(0, 0, 20, 10))),
                      frame(1, detection("best", (0, 0, 4, 10))))
    assert statuses(select(source)) == ["selected", "selected"]  # IoU == 0.2
    source["frames"][1]["detections"].append(detection("runner", (0, 0, 3, 10)))
    assert statuses(select(source)) == ["selected", "ambiguous"]  # difference == 0.05


@pytest.mark.parametrize("box", [(-1e308, -1e308, 1e308, 1e308),
                                  (0, 0, 5e-324, 5e-324),
                                  (-20, -30, -10, -5)])
def test_extreme_finite_or_out_of_frame_geometry_is_not_clamped(box):
    result = select(artifact(frame(0, detection(box=box)),
                             frame(1, detection("next", box))), min_iou=1)
    assert statuses(result) == ["selected", "selected"]


@pytest.mark.parametrize("seed", [
    {"seed_frame_index": 1}, {"seed_detection_id": "missing"},
    {"seed_frame_index": 0.0}, {"seed_frame_index": True},
    {"seed_frame_index": -1}, {"seed_detection_id": 1},
    {"seed_detection_id": ""}, {"seed_detection_id": " "},
])
def test_seed_must_be_exact_and_strict(seed):
    with pytest.raises(ValueError):
        select(artifact(frame(0, detection())), **seed)


def test_seed_detection_cannot_be_borrowed_from_another_frame():
    with pytest.raises(ValueError, match="seed frame/detection pair"):
        select(artifact(frame(0, detection("other")), frame(1, detection())))


@pytest.mark.parametrize("parameter,value", [
    ("min_iou", 0), ("min_iou", -0.1), ("min_iou", 1.1),
    ("min_iou", True), ("min_iou", "0.2"), ("min_iou", None),
    ("min_iou", float("nan")), ("min_iou", float("inf")),
    ("min_iou", Decimal("0.2")),
    ("ambiguity_margin", -0.1), ("ambiguity_margin", 1.1),
    ("ambiguity_margin", False), ("ambiguity_margin", "0.05"),
    ("ambiguity_margin", float("-inf")),
])
def test_invalid_heuristic_parameters(parameter, value):
    with pytest.raises(ValueError):
        select(artifact(frame(0, detection())), **{parameter: value})


def replace_path(value, path, replacement):
    for key in path[:-1]:
        value = value[key]
    value[path[-1]] = replacement


@pytest.mark.parametrize("path,value", [
    (("asset_id",), "sha256:" + "A" * 64),
    (("asset_id",), "sha256:" + "a" * 63),
    (("pose_schema_version",), "0.2.0"),
    (("time_base",), "0/1000"), (("time_base",), "1/0"),
    (("time_base",), "-1/1000"), (("time_base",), "0.001"),
    (("time_base",), 0.001), (("time_base",), True),
    (("coordinate_space",), "normalized"), (("keypoint_schema",), "mp33"),
    (("measurement_status",), "reportable"), (("validation_ref",), "validated"),
    (("frames",), []), (("frames", 0, "frame_index"), True),
    (("frames", 0, "frame_index"), 0.0), (("frames", 0, "frame_index"), -1),
    (("frames", 0, "pts"), None), (("frames", 0, "pts"), True),
    (("frames", 0, "pts"), "1000"), (("frames", 0, "pts"), 1000.0),
    (("frames", 0, "display_width"), 0),
    (("frames", 0, "display_height"), True),
    (("frames", 0, "detections", 0, "detection_id"), ""),
    (("frames", 0, "detections", 0, "bbox", "x2"), 0),
    (("frames", 0, "detections", 0, "bbox", "y2"), -1),
    (("frames", 0, "detections", 0, "bbox", "x1"), float("nan")),
    (("frames", 0, "detections", 0, "bbox", "x1"), float("inf")),
    (("frames", 0, "detections", 0, "bbox", "x1"), False),
    (("frames", 0, "detections", 0, "bbox", "x1"), "0"),
    (("frames", 0, "detections", 0, "bbox", "x1"), Decimal("0")),
    (("frames", 0, "detections", 0, "bbox", "x2"), 10**400),
    (("frames", 0, "detections", 0, "keypoints"), []),
    (("frames", 0, "detections", 0, "keypoints", 0, "x"), 1),
    (("frames", 0, "detections", 0, "keypoints", 0, "score"), float("nan")),
    (("frames", 0, "detections", 0, "keypoints", 0, "score"), True),
    (("frames", 0, "detections", 0, "keypoints", 0, "presence"), 1.01),
    (("frames", 0, "detections", 0, "keypoints", 0, "visibility"), -0.01),
    (("frames", 0, "detections", 0, "keypoints", 0, "name"), "left_eye"),
    (("provenance", "kind"), "synthetic"),
    (("provenance", "adapter"), "unknown"),
    (("provenance", "adapter_version"), ""),
    (("provenance", "model_files", 0, "sha256"), "bad_hash"),
    (("provenance", "runtime"), {"python": ""}),
    (("provenance", "parameters"), {"nested": [float("inf")]}),
    (("provenance", "parameters"), {"nested": Decimal("0.2")}),
    (("provenance", "parameters"), {"nested": (1, 2)}),
    (("provenance", "parameters"), {1: "not_a_json_key"}),
    (("provenance", "transforms"), [""]),
])
def test_independent_strict_artifact_validation(path, value):
    source = artifact(frame(0, detection()))
    replace_path(source, path, value)
    with pytest.raises(ValueError):
        select(source)


@pytest.mark.parametrize("path", [
    (), ("frames", 0), ("frames", 0, "detections", 0),
    ("frames", 0, "detections", 0, "bbox"),
    ("frames", 0, "detections", 0, "keypoints", 0),
    ("provenance",), ("provenance", "model_files", 0),
])
@pytest.mark.parametrize("operation", ["unknown", "missing"])
def test_unknown_and_missing_required_fields_rejected_at_each_boundary(path, operation):
    source = artifact(frame(0, detection()))
    value = source
    for key in path:
        value = value[key]
    if operation == "unknown":
        value["undocumented"] = "reject"
    else:
        del value[next(iter(value))]
    with pytest.raises(ValueError):
        select(source)


@pytest.mark.parametrize("second", [
    frame(0, detection()), frame(2, detection(), pts=1000),
    frame(1, detection(), pts=999),
])
def test_duplicate_indices_pts_and_time_regressions_rejected(second):
    with pytest.raises(ValueError, match="strictly increasing"):
        select(artifact(frame(0, detection()), second))


def test_regressing_frame_index_and_inconsistent_dimensions_rejected():
    with pytest.raises(ValueError, match="frame_index"):
        select(artifact(frame(2, detection()), frame(1, detection(), pts=2000)),
               seed_frame_index=2)
    source = artifact(frame(0, detection()), frame(1, detection()))
    source["frames"][1]["display_width"] = 320
    with pytest.raises(ValueError, match="dimensions"):
        select(source)


def test_duplicate_ids_in_any_frame_rejected_even_after_loss():
    with pytest.raises(ValueError, match="unique within"):
        select(artifact(frame(0, detection()), frame(1),
                        frame(2, detection(), detection())))


def test_malformed_unselected_person_is_not_silently_ignored():
    with pytest.raises(ValueError, match="bbox"):
        select(artifact(frame(0, detection(), detection("spectator", (0, 0, 0, 0)))))


def test_keypoint_scores_native_nullability_and_coordinates_preserved():
    source = artifact(frame(0, detection()))
    point = source["frames"][0]["detections"][0]["keypoints"][0]
    point.update(x=-500, y=99999, score=2.3, visibility=0, presence=1)
    original = deepcopy(source)
    assert statuses(select(source)) == ["selected"]
    assert source == original
    point["score"] = -4.5
    assert statuses(select(source)) == ["selected"]


def test_bare_frames_are_not_an_asset_bound_artifact():
    with pytest.raises(ValueError):
        select([frame(0, detection())])


def test_required_keyword_seed_and_all_reason_shapes():
    with pytest.raises(TypeError):
        select_target(artifact(frame(0, detection())))
    result = select(artifact(frame(0), frame(1, detection()), frame(2), frame(3)),
                    seed_frame_index=1)
    for item in result["frames"]:
        if item["status"] == "selected":
            assert item["detection_id"] is not None and item["reason"] is None
        else:
            assert item["detection_id"] is None
            assert re.fullmatch(r"[a-z][a-z0-9]*(?:_[a-z0-9]+)*", item["reason"])

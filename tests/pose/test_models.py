import copy
import json

import pytest
from pydantic import ValidationError

from tennis_backend.pose import COCO17_NAMES, Keypoint, PoseArtifact, PoseDetection, PoseFrame


def test_strict_round_trip_with_native_scores_and_sparse_original_pts(artifact):
    second = copy.deepcopy(artifact["frames"][0])
    second.update(frame_index=29, pts=9003, detections=[])
    artifact["frames"].append(second)
    model = PoseArtifact.model_validate(artifact)
    assert model.model_dump(mode="json") == artifact
    assert PoseArtifact.model_validate_json(model.model_dump_json()) == model
    assert model.frames[0].detections[0].keypoints[0].score == 1.5
    assert model.frames[0].detections[0].bbox.x1 == -20.
    assert tuple(p.name for p in model.frames[0].detections[0].keypoints) == COCO17_NAMES


def test_null_coordinates_and_empty_observed_detections(frame):
    point = frame["detections"][0]["keypoints"][0]
    point.update(x=None, y=None, score=-4.5)
    assert Keypoint.model_validate(point).score == -4.5
    assert PoseDetection.model_validate(frame["detections"][0])
    frame["detections"] = []
    assert PoseFrame.model_validate(frame).detections == []


@pytest.mark.parametrize("path,value", [
    (("frames",), []),
    (("frames", 0, "frame_index"), True),
    (("frames", 0, "pts"), 1.),
    (("frames", 0, "display_width"), "640"),
    (("frames", 0, "display_height"), 0),
    (("frames", 0, "detections", 0, "detection_id"), "  "),
    (("frames", 0, "detections", 0, "bbox", "x2"), -21.),
    (("frames", 0, "detections", 0, "bbox", "y1"), float("inf")),
    (("frames", 0, "detections", 0, "keypoints", 0, "x"), None),
    (("frames", 0, "detections", 0, "keypoints", 0, "score"), True),
    (("frames", 0, "detections", 0, "keypoints", 0, "score"), "0.5"),
    (("frames", 0, "detections", 0, "keypoints", 0, "score"), float("nan")),
    (("frames", 0, "detections", 0, "keypoints", 0, "visibility"), 1.001),
    (("frames", 0, "detections", 0, "keypoints", 0, "presence"), -0.1),
    (("frames", 0, "detections", 0, "keypoints", 0, "name"), "left_eye"),
    (("time_base",), "1/0"), (("time_base",), "0/1"), (("time_base",), "-1/90000"),
    (("time_base",), 0.03), (("time_base",), "0.03"),
    (("asset_id",), "sha256:" + "A" * 64),
    (("coordinate_space",), "normalized"), (("keypoint_schema",), "mp33"),
    (("validation_ref",), "approved"), (("measurement_status",), "reportable"),
    (("provenance", "kind"), "manual"), (("provenance", "adapter"), "synthetic"),
    (("provenance", "adapter_version"), " "), (("provenance", "model_files"), []),
    (("provenance", "model_files", 0, "sha256"), "c" * 63),
    (("provenance", "runtime"), {}), (("provenance", "runtime"), {"provider": ""}),
    (("provenance", "runtime"), {"": "cpu"}),
    (("provenance", "parameters"), {"nested": [{"value": float("inf")}]}),
    (("provenance", "parameters"), {"tuple": (1, 2)}),
    (("provenance", "parameters"), {1: "invalid"}),
    (("provenance", "transforms"), [""]),
])
def test_rejects_invalid_fields(artifact, path, value):
    container = artifact
    for key in path[:-1]:
        container = container[key]
    container[path[-1]] = value
    with pytest.raises((ValidationError, ValueError)):
        PoseArtifact.model_validate(artifact)


@pytest.mark.parametrize("change", ["index", "pts", "dimensions", "duplicate_ids", "short_names", "extra", "missing"])
def test_rejects_cross_record_and_shape_errors(artifact, change):
    frame = artifact["frames"][0]
    second = copy.deepcopy(frame)
    second.update(frame_index=8, pts=-39)
    artifact["frames"].append(second)
    if change == "index":
        second["frame_index"] = frame["frame_index"]
    elif change == "pts":
        second["pts"] = frame["pts"] - 1
    elif change == "dimensions":
        second["display_width"] += 1
    elif change == "duplicate_ids":
        frame["detections"].append(copy.deepcopy(frame["detections"][0]))
    elif change == "short_names":
        frame["detections"][0]["keypoints"].pop()
    elif change == "extra":
        frame["detections"][0]["keypoints"][0]["uncertainty"] = 0.1
    else:
        del frame["detections"][0]["keypoints"][0]["score"]
    with pytest.raises(ValidationError):
        PoseArtifact.model_validate(artifact)


@pytest.mark.parametrize("text", [
    '{"pose_schema_version":"0.1.0","pose_schema_version":"0.1.0"}',
    '{"x":NaN}', '{"x":Infinity}', '{"x":-Infinity}',
])
def test_json_rejects_duplicate_keys_and_nonfinite_literals(text):
    with pytest.raises(ValueError):
        PoseArtifact.model_validate_json(text)


def test_recursive_json_rejects_nan_and_extra_fields_on_json_input(artifact):
    artifact["provenance"]["parameters"]["bad"] = [float("nan")]
    with pytest.raises(ValueError):
        PoseArtifact.model_validate_json(json.dumps(artifact))
    artifact["provenance"]["parameters"] = {}
    artifact["provenance"]["private_path"] = "not-in-contract"
    with pytest.raises(ValueError):
        PoseArtifact.model_validate_json(json.dumps(artifact))


def test_artifact_rejects_relabeling_model_native_fields(artifact):
    artifact["frames"][0]["detections"][0]["keypoints"][0]["visibility"] = 0.5
    with pytest.raises(ValueError, match="RTMPose visibility/presence"):
        PoseArtifact.model_validate(artifact)
    artifact["frames"][0]["detections"][0]["keypoints"][0]["visibility"] = None
    artifact["provenance"]["adapter"] = "mediapipe"
    with pytest.raises(ValueError, match="MediaPipe score"):
        PoseArtifact.model_validate(artifact)

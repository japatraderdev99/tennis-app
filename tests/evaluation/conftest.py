"""Entirely synthetic geometry; no inference or human annotation is represented."""

import pytest


NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear", "left_shoulder",
    "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
    "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
)


@pytest.fixture
def artifact():
    return {
        "pose_schema_version": "0.1.0",
        "asset_id": "sha256:" + "a" * 64,
        "time_base": "1/1000",
        "coordinate_space": "display_pixels",
        "keypoint_schema": "coco17",
        "frames": [
            {
                "frame_index": index,
                "pts": pts,
                "display_width": 640,
                "display_height": 360,
                "detections": [
                    {
                        "detection_id": identifier,
                        "bbox": {"x1": 0, "y1": 0, "x2": 100, "y2": 200},
                        "keypoints": [
                            {
                                "name": name, "x": offset + point_index, "y": 10,
                                "score": 2.5, "visibility": None, "presence": None,
                            }
                            for point_index, name in enumerate(NAMES)
                        ],
                    }
                    for identifier, offset in (("target", 10), ("other", 110))
                ],
            }
            for index, pts in enumerate((101, 144, 201))
        ],
        "provenance": {
            "kind": "model_inference",
            "adapter": "rtmpose",
            "adapter_version": "synthetic-contract-fixture",
            "model_files": [{"role": "pose", "sha256": "b" * 64}],
            "runtime": {"fixture": "no-model-executed"},
            "parameters": {"fixture_only": True, "nested": [None, 1.5]},
            "transforms": [],
        },
        "validation_ref": None,
        "measurement_status": "research_only",
    }


@pytest.fixture
def selection(artifact):
    return {
        "selection_schema_version": "0.1.0",
        "asset_id": artifact["asset_id"],
        "time_base": artifact["time_base"],
        "method": "conservative_iou_v0",
        "seed": {"frame_index": 1, "detection_id": "target"},
        "parameters": {"min_iou": 0.2, "ambiguity_margin": 0.05},
        "frames": [
            {"frame_index": 0, "pts": 101, "status": "not_started", "detection_id": None, "reason": "before_seed"},
            {"frame_index": 1, "pts": 144, "status": "selected", "detection_id": "target", "reason": None},
            {"frame_index": 2, "pts": 201, "status": "lost", "detection_id": None, "reason": "no_candidates"},
        ],
        "validation_ref": None,
    }


@pytest.fixture
def references(artifact):
    # This is a reviewed-shaped SYNTHETIC fixture, never human ground truth.
    return {
        "annotation_schema_version": "0.1.0",
        "asset_id": artifact["asset_id"],
        "time_base": artifact["time_base"],
        "coordinate_space": "display_pixels",
        "keypoint_schema": "coco17",
        "review_status": "reviewed",
        "annotator_id": "synthetic-fixture-only",
        "frames": [{
            "frame_index": 1, "pts": 144, "display_width": 640, "display_height": 360,
            "detection_id": "target",
            "keypoints": [
                {"name": name, "x": None, "y": None, "visibility": "occluded"}
                for name in NAMES
            ],
        }],
    }


@pytest.fixture
def visible_references(references):
    references["frames"][0]["keypoints"][0].update(x=7, y=6, visibility="visible")
    references["frames"][0]["keypoints"][1].update(x=11, y=10, visibility="visible")
    references["frames"][0]["keypoints"][2].update(x=12, y=4, visibility="visible")
    return references

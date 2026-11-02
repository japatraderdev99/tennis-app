"""Independent annotation templates and unvalidated image-plane keypoint errors.

Only finite synthetic fixtures are shipped. No pose inference, human review,
identity inference, biomechanical scoring or public metric release happens here.
"""

from __future__ import annotations

import math

from ._models import Annotations, COCO17_NAMES, PoseArtifact, Selection, validate_json_dict

__all__ = ["make_annotation_template", "evaluate_keypoints"]


def make_annotation_template(artifact: dict, selection: dict) -> dict:
    """Return selected evidence links with blank independent reference points.

    Inputs must conform to the frozen P2 contracts. All coordinates are null,
    every visibility is unreviewed and annotator_id is null. Predictions, scores
    and model visibility are never copied into the independent reference.
    """
    validate_json_dict(artifact, "artifact")
    validate_json_dict(selection, "selection")
    pose = PoseArtifact.model_validate(artifact)
    target = Selection.model_validate(selection)
    target.check_artifact(pose)
    return {
        "annotation_schema_version": "0.1.0",
        "asset_id": pose.asset_id,
        "time_base": pose.time_base,
        "coordinate_space": pose.coordinate_space,
        "keypoint_schema": pose.keypoint_schema,
        "review_status": "unreviewed",
        "annotator_id": None,
        "frames": [
            {
                "frame_index": frame.frame_index,
                "pts": frame.pts,
                "display_width": frame.display_width,
                "display_height": frame.display_height,
                "detection_id": selected.detection_id,
                "keypoints": [
                    {"name": name, "x": None, "y": None, "visibility": "unreviewed"}
                    for name in COCO17_NAMES
                ],
            }
            for frame, selected in zip(pose.frames, target.frames)
            if selected.status == "selected"
        ],
    }


def evaluate_keypoints(artifact: dict, annotations: dict) -> dict:
    """Evaluate reviewed visible references against the exact frame/detection.

    A subset of annotated frames is allowed. Missing detections (including null
    reference detection_id) and null predicted coordinates count as failures for
    every visible reference. Confidence and visibility from models never filter
    the denominator. Finite out-of-image predictions retain their pixel error.

    No visible references means not_evaluated and null metrics, rather than zero
    accuracy. With references but no matches, coverage is 0 and pixel errors are
    null. Malformed or incompatible evidence, or nonfinite arithmetic, raises
    ValueError. Computed is an arithmetic status, not scientific acceptance.
    """
    validate_json_dict(artifact, "artifact")
    validate_json_dict(annotations, "annotations")
    pose = PoseArtifact.model_validate(artifact)
    labels = Annotations.model_validate(annotations)
    labels.check_artifact(pose)
    result = {
        "evaluation_schema_version": "0.1.0",
        "status": "not_evaluated",
        "asset_id": pose.asset_id,
        "reference_points": 0,
        "matched_points": 0,
        "missing_predictions": 0,
        "mean_error_px": None,
        "median_error_px": None,
        "coverage": None,
        "reasons": [],
        "validation_ref": None,
    }
    if labels.review_status == "unreviewed":
        result["reasons"] = ["annotations_unreviewed"]
        return result

    predictions = {frame.frame_index: frame for frame in pose.frames}
    errors = []
    for reference in labels.frames:
        frame = predictions[reference.frame_index]
        detection = next(
            (item for item in frame.detections if item.detection_id == reference.detection_id),
            None,
        )
        for index, point in enumerate(reference.keypoints):
            if point.visibility != "visible":
                continue
            result["reference_points"] += 1
            prediction = detection.keypoints[index] if detection is not None else None
            if prediction is None or prediction.x is None:
                result["missing_predictions"] += 1
                continue
            error = math.hypot(prediction.x - point.x, prediction.y - point.y)
            if not math.isfinite(error):
                raise ValueError("keypoint error exceeds finite pixel arithmetic")
            errors.append(error)

    references = result["reference_points"]
    if references == 0:
        result["reasons"] = ["no_visible_reference_points"]
        return result
    result["status"] = "computed"
    result["matched_points"] = len(errors)
    result["coverage"] = len(errors) / references
    if result["missing_predictions"]:
        result["reasons"].append("missing_predictions")
    if not errors:
        result["reasons"].append("no_matched_predictions")
        return result

    # Normalize before summing: adding finite distances may overflow even when
    # their mean is representable. Preserve exact zero without dividing by zero.
    maximum = max(errors)
    result["mean_error_px"] = (
        maximum * (math.fsum(error / maximum for error in errors) / len(errors))
        if maximum else 0.0
    )
    errors.sort()
    middle = len(errors) // 2
    result["median_error_px"] = (
        errors[middle] if len(errors) % 2
        else errors[middle - 1] + (errors[middle] - errors[middle - 1]) / 2
    )
    return result

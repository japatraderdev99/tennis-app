"""Explicit seeds and conservative, unvalidated image-plane IoU association.

Detection IDs are frame-local labels, never identities. A geometric association
cannot establish identity through an unobserved crossing or detector error.
"""

from __future__ import annotations

import math
import re
from fractions import Fraction
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

__all__ = ["select_target"]

_COCO17 = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
    "right_knee", "left_ankle", "right_ankle",
)
_Nonempty = Annotated[str, Field(min_length=1, pattern=r"\S")]
_Index = Annotated[int, Field(ge=0)]
_PositiveInt = Annotated[int, Field(gt=0)]
_Finite = Annotated[float, Field(allow_inf_nan=False)]
_Unit = Annotated[_Finite, Field(ge=0, le=1)]


def _json_number(value: object) -> float:
    # Reject bool, strings and __float__ objects (e.g. Decimal) explicitly.
    if type(value) not in (int, float):
        raise ValueError("expected a finite JSON number")
    try:
        number = float(value)
    except OverflowError as exc:
        raise ValueError("expected a finite JSON number") from exc
    if not math.isfinite(number):
        raise ValueError("expected a finite JSON number")
    return number


class _Strict(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False)


class _Box(_Strict):
    x1: _Finite
    y1: _Finite
    x2: _Finite
    y2: _Finite

    @field_validator("x1", "y1", "x2", "y2", mode="before")
    @classmethod
    def numbers(cls, value: object) -> float:
        return _json_number(value)

    @model_validator(mode="after")
    def positive_area(self) -> Self:
        if self.x2 <= self.x1 or self.y2 <= self.y1:
            raise ValueError("bbox requires x2 > x1 and y2 > y1")
        return self


class _Keypoint(_Strict):
    name: str
    x: _Finite | None
    y: _Finite | None
    score: _Finite | None
    visibility: _Unit | None
    presence: _Unit | None

    @field_validator("x", "y", "score", "visibility", "presence", mode="before")
    @classmethod
    def numbers(cls, value: object) -> float | None:
        return None if value is None else _json_number(value)

    @model_validator(mode="after")
    def paired_coordinates(self) -> Self:
        if (self.x is None) != (self.y is None):
            raise ValueError("keypoint x/y must both be finite or both null")
        return self


class _Detection(_Strict):
    detection_id: _Nonempty
    bbox: _Box
    keypoints: Annotated[list[_Keypoint], Field(min_length=17, max_length=17)]

    @model_validator(mode="after")
    def ordered_names(self) -> Self:
        if tuple(point.name for point in self.keypoints) != _COCO17:
            raise ValueError("keypoints must use unique COCO17 names in order")
        return self


class _Frame(_Strict):
    frame_index: _Index
    pts: int
    display_width: _PositiveInt
    display_height: _PositiveInt
    detections: list[_Detection]

    @model_validator(mode="after")
    def unique_ids(self) -> Self:
        ids = [detection.detection_id for detection in self.detections]
        if len(ids) != len(set(ids)):
            raise ValueError("detection_id must be unique within each frame")
        return self


class _ModelFile(_Strict):
    role: _Nonempty
    sha256: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


def _check_json(value: object) -> None:
    if value is None or type(value) in (str, bool, int):
        return
    if type(value) is float and math.isfinite(value):
        return
    if type(value) is list:
        for item in value:
            _check_json(item)
        return
    if type(value) is dict and all(type(key) is str for key in value):
        for item in value.values():
            _check_json(item)
        return
    raise ValueError("parameters must contain only finite JSON values")


class _Provenance(_Strict):
    kind: Literal["model_inference"]
    adapter: Literal["mediapipe", "rtmpose"]
    adapter_version: _Nonempty
    model_files: list[_ModelFile]
    runtime: dict[_Nonempty, _Nonempty]
    parameters: dict[str, object]
    transforms: list[_Nonempty]

    @field_validator("parameters", mode="before")
    @classmethod
    def finite_json(cls, value: object) -> object:
        _check_json(value)
        return value


class _Artifact(_Strict):
    pose_schema_version: Literal["0.1.0"]
    asset_id: Annotated[str, Field(pattern=r"^sha256:[0-9a-f]{64}$")]
    time_base: str
    coordinate_space: Literal["display_pixels"]
    keypoint_schema: Literal["coco17"]
    frames: Annotated[list[_Frame], Field(min_length=1)]
    provenance: _Provenance
    validation_ref: None
    measurement_status: Literal["research_only"]

    @field_validator("time_base")
    @classmethod
    def positive_rational(cls, value: str) -> str:
        if re.fullmatch(r"[+-]?[0-9]+/[+-]?[0-9]+", value) is None:
            raise ValueError("time_base must be a positive rational num/den string")
        numerator, denominator = map(int, value.split("/"))
        if denominator == 0 or Fraction(numerator, denominator) <= 0:
            raise ValueError("time_base must be positive with nonzero denominator")
        return value

    @model_validator(mode="after")
    def timeline(self) -> Self:
        previous = None
        dimensions = (self.frames[0].display_width, self.frames[0].display_height)
        for frame in self.frames:
            if previous is not None:
                if frame.frame_index <= previous.frame_index:
                    raise ValueError("frame_index must be strictly increasing")
                if frame.pts <= previous.pts:
                    raise ValueError("pts must be strictly increasing")
            if (frame.display_width, frame.display_height) != dimensions:
                raise ValueError("display dimensions must be consistent")
            previous = frame
        return self


class _Request(_Strict):
    artifact: _Artifact
    seed_frame_index: _Index
    seed_detection_id: _Nonempty
    min_iou: Annotated[_Finite, Field(gt=0, le=1)]
    ambiguity_margin: _Unit

    @field_validator("min_iou", "ambiguity_margin", mode="before")
    @classmethod
    def numbers(cls, value: object) -> float:
        return _json_number(value)

    @model_validator(mode="after")
    def exact_seed(self) -> Self:
        seed_found = any(
            frame.frame_index == self.seed_frame_index
            and any(item.detection_id == self.seed_detection_id
                    for item in frame.detections)
            for frame in self.artifact.frames
        )
        if not seed_found:
            raise ValueError("seed frame/detection pair must exist exactly")
        return self


def _iou(left: _Box, right: _Box) -> Fraction:
    # Exact ratios of the validated float coordinates avoid overflow/underflow
    # for finite boxes with extreme scales; this is not an uncertainty estimate.
    ax1, ay1, ax2, ay2 = map(Fraction, (left.x1, left.y1, left.x2, left.y2))
    bx1, by1, bx2, by2 = map(Fraction, (right.x1, right.y1, right.x2, right.y2))
    width = min(ax2, bx2) - max(ax1, bx1)
    height = min(ay2, by2) - max(ay1, by1)
    if width <= 0 or height <= 0:
        return Fraction(0)
    intersection = width * height
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - intersection
    return intersection / union


def select_target(
    artifact: dict,
    *,
    seed_frame_index: int,
    seed_detection_id: str,
    min_iou: float = 0.2,
    ambiguity_margin: float = 0.05,
) -> dict:
    """Associate from an exact explicit seed; loss requires a new seeded call.

    The PoseArtifact dictionary is validated independently of the pose module.
    Invalid input, absent seed, non-increasing PTS/index or changing dimensions
    raises ValueError (including Pydantic ValidationError) before any result.
    PTS need not start at zero or have constant intervals. No time is fabricated.

    min_iou is in (0, 1], so disjoint people can never be selected; margin is in
    [0, 1]. The best IoU must meet the threshold. Any second candidate within the
    inclusive margin makes the frame ambiguous, even if just below min_iou.
    These are technical heuristics, never validated identity confidence.
    """
    request = _Request.model_validate({
        "artifact": artifact,
        "seed_frame_index": seed_frame_index,
        "seed_detection_id": seed_detection_id,
        "min_iou": min_iou,
        "ambiguity_margin": ambiguity_margin,
    })
    selected_box = None
    previous_index = None
    stopped = False
    output = []
    for frame in request.artifact.frames:
        detection_id = None
        if frame.frame_index < request.seed_frame_index:
            status, reason = "not_started", "before_seed"
        elif frame.frame_index == request.seed_frame_index:
            detection = next(item for item in frame.detections
                             if item.detection_id == request.seed_detection_id)
            selected_box = detection.bbox
            detection_id = detection.detection_id
            status, reason = "selected", None
        elif stopped:
            status, reason = "lost", "reseed_required"
        elif frame.frame_index != previous_index + 1:
            status, reason = "lost", "frame_gap"
            stopped = True
        elif not frame.detections:
            status, reason = "lost", "no_detections"
            stopped = True
        else:
            ranked = sorted(
                ((_iou(selected_box, item.bbox), item) for item in frame.detections),
                key=lambda pair: pair[0], reverse=True,
            )
            best, detection = ranked[0]
            # Round only final ratios to the parameter's JSON float precision.
            # Comparing exact 1/5 to Fraction(0.2) would incorrectly lose a
            # candidate exactly at the ordinary 0.2 threshold.
            if float(best) < request.min_iou:
                status, reason = "lost", "iou_below_threshold"
                stopped = True
            elif (len(ranked) > 1
                  and float(best - ranked[1][0]) <= request.ambiguity_margin):
                status, reason = "ambiguous", "ambiguous_iou"
                stopped = True
            else:
                selected_box = detection.bbox
                detection_id = detection.detection_id
                status, reason = "selected", None
        output.append({
            "frame_index": frame.frame_index, "pts": frame.pts,
            "status": status, "detection_id": detection_id, "reason": reason,
        })
        previous_index = frame.frame_index
    return {
        "selection_schema_version": "0.1.0",
        "asset_id": request.artifact.asset_id,
        "time_base": request.artifact.time_base,
        "method": "conservative_iou_v0",
        "seed": {"frame_index": request.seed_frame_index,
                 "detection_id": request.seed_detection_id},
        "parameters": {"min_iou": request.min_iou,
                       "ambiguity_margin": request.ambiguity_margin},
        "frames": output,
        "validation_ref": None,
    }

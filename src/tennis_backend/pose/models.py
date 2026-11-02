"""Strict P2 research artifact; no public metric or scientific validation."""
from __future__ import annotations

import json
import math
import re
from fractions import Fraction
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator, model_validator

COCO17_NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
    "right_knee", "left_ankle", "right_ankle",
)
Name = Literal[
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
    "right_knee", "left_ankle", "right_ankle",
]
Nonempty = Annotated[str, Field(min_length=1, pattern=r"\S")]
Finite = Annotated[float, Field(allow_inf_nan=False)]
Probability = Annotated[Finite, Field(ge=0, le=1)]
PositiveInt = Annotated[int, Field(gt=0)]
Digest = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
TimeBase = Annotated[str, Field(pattern=r"^[+-]?[0-9]+/[+-]?[0-9]+$")]


def parse_time_base(value: str) -> Fraction:
    """Parse exact rational text; never infer time from frame number or FPS."""
    if type(value) is not str or re.fullmatch(r"[+-]?[0-9]+/[+-]?[0-9]+", value) is None:
        raise ValueError("time_base must be a positive rational num/den string")
    numerator, denominator = map(int, value.split("/"))
    if denominator == 0 or (base := Fraction(numerator, denominator)) <= 0:
        raise ValueError("time_base must be positive with a nonzero denominator")
    return base


def finite_json(value: object) -> object:
    if value is None or type(value) in (str, int, bool):
        return value
    if type(value) is float and math.isfinite(value):
        return value
    if type(value) is list:
        for item in value:
            finite_json(item)
        return value
    if type(value) is dict and all(type(key) is str for key in value):
        for item in value.values():
            finite_json(item)
        return value
    raise ValueError("parameters must contain only finite JSON values")


class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False)

    @classmethod
    def model_validate_json(cls, json_data, **kwargs):
        # The stdlib parser preserves duplicate keys long enough to reject them.
        def pairs(items):
            result = {}
            for key, value in items:
                if key in result:
                    raise ValueError("duplicate JSON key")
                result[key] = value
            return result

        def constant(_):
            raise ValueError("JSON contains a nonfinite number")

        value = json.loads(json_data, object_pairs_hook=pairs, parse_constant=constant)
        return cls.model_validate(value, **kwargs)


class Keypoint(StrictModel):
    name: Name
    x: Finite | None
    y: Finite | None
    score: Finite | None
    visibility: Probability | None
    presence: Probability | None

    @model_validator(mode="after")
    def paired_coordinates(self) -> Self:
        if (self.x is None) != (self.y is None):
            raise ValueError("keypoint x/y must both be finite or both null")
        return self


class BoundingBox(StrictModel):
    x1: Finite
    y1: Finite
    x2: Finite
    y2: Finite

    @model_validator(mode="after")
    def positive_extent(self) -> Self:
        if self.x2 <= self.x1 or self.y2 <= self.y1:
            raise ValueError("bbox must have positive width and height")
        return self


class PoseDetection(StrictModel):
    detection_id: Nonempty
    bbox: BoundingBox
    keypoints: Annotated[list[Keypoint], Field(min_length=17, max_length=17)]

    @model_validator(mode="after")
    def coco_order(self) -> Self:
        if tuple(point.name for point in self.keypoints) != COCO17_NAMES:
            raise ValueError("keypoints must use unique COCO17 names in canonical order")
        return self


class PoseFrame(StrictModel):
    frame_index: Annotated[int, Field(ge=0)]
    pts: int
    display_width: PositiveInt
    display_height: PositiveInt
    detections: list[PoseDetection]

    @model_validator(mode="after")
    def unique_ids(self) -> Self:
        ids = [detection.detection_id for detection in self.detections]
        if len(set(ids)) != len(ids):
            raise ValueError("detection_id must be unique within a frame")
        return self


class ModelFile(StrictModel):
    role: Nonempty
    sha256: Digest


class PoseProvenance(StrictModel):
    kind: Literal["model_inference"]
    adapter: Literal["mediapipe", "rtmpose"]
    adapter_version: Nonempty
    model_files: Annotated[list[ModelFile], Field(min_length=1)]
    runtime: Annotated[dict[Nonempty, Nonempty], Field(min_length=1)]
    parameters: dict[str, JsonValue]
    transforms: list[Nonempty]

    @field_validator("parameters", mode="before")
    @classmethod
    def json_parameters(cls, value):
        return finite_json(value)


class PoseArtifact(StrictModel):
    pose_schema_version: Literal["0.1.0"]
    asset_id: Annotated[str, Field(pattern=r"^sha256:[0-9a-f]{64}$")]
    time_base: TimeBase
    coordinate_space: Literal["display_pixels"]
    keypoint_schema: Literal["coco17"]
    frames: Annotated[list[PoseFrame], Field(min_length=1)]
    provenance: PoseProvenance
    validation_ref: None
    measurement_status: Literal["research_only"]

    @field_validator("time_base")
    @classmethod
    def positive_rational(cls, value):
        parse_time_base(value)
        return value

    @model_validator(mode="after")
    def consistent_frames(self) -> Self:
        first = self.frames[0]
        previous = None
        for frame in self.frames:
            if (frame.display_width, frame.display_height) != (first.display_width, first.display_height):
                raise ValueError("all frames must have consistent display dimensions")
            if previous is not None and (
                frame.frame_index <= previous.frame_index or frame.pts <= previous.pts
            ):
                raise ValueError("frame_index and original pts must strictly increase")
            for detection in frame.detections:
                for point in detection.keypoints:
                    if self.provenance.adapter == "mediapipe" and point.score is not None:
                        raise ValueError("MediaPipe score must be null; visibility/presence are independent")
                    if self.provenance.adapter == "rtmpose" and (
                        point.visibility is not None or point.presence is not None
                    ):
                        raise ValueError("RTMPose visibility/presence must be null; score is model native")
            previous = frame
        return self

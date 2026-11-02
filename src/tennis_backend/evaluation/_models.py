"""Independent strict boundaries for the frozen P2 dictionary interfaces.

These private models deliberately do not import pose or selection implementations.
The head checks compatibility when integrating the parallel P2 modules.
"""

from __future__ import annotations

import math
import re
from fractions import Fraction
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

COCO17_NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear", "left_shoulder",
    "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
    "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
)

Nonempty = Annotated[str, Field(min_length=1, pattern=r"\S")]
Index = Annotated[int, Field(ge=0)]
Dimension = Annotated[int, Field(gt=0)]
Finite = Annotated[float, Field(allow_inf_nan=False)]
Unit = Annotated[Finite, Field(ge=0, le=1)]
AssetID = Annotated[str, Field(pattern=r"^sha256:[0-9a-f]{64}$")]
Reason = Annotated[str, Field(pattern=r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")]


def validate_json_dict(value: object, label: str) -> None:
    """Reject Python-only containers/numbers and nonfinite JSON at either API."""
    def check(item: object) -> None:
        if item is None or type(item) in (str, bool, int):
            return
        if type(item) is float and math.isfinite(item):
            return
        if type(item) is list:
            for child in item:
                check(child)
            return
        if type(item) is dict and all(type(key) is str for key in item):
            for child in item.values():
                check(child)
            return
        raise ValueError(f"{label} must contain only finite JSON values")

    if type(value) is not dict:
        raise ValueError(f"{label} must be a dict")
    check(value)


class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False)


class EvidenceFrame(StrictModel):
    frame_index: Index
    pts: int


class DisplayFrame(EvidenceFrame):
    display_width: Dimension
    display_height: Dimension


def ordered_frames(frames: list[EvidenceFrame]) -> None:
    for previous, current in zip(frames, frames[1:]):
        if current.frame_index <= previous.frame_index or current.pts <= previous.pts:
            raise ValueError("frame_index and PTS must be unique and strictly increasing")


def ordered_keypoints(points: list) -> None:
    if tuple(point.name for point in points) != COCO17_NAMES:
        raise ValueError("keypoint names must be unique and in COCO17 order")


class Coordinates(StrictModel):
    name: str
    x: Finite | None
    y: Finite | None

    @model_validator(mode="after")
    def paired_coordinates(self) -> Self:
        if (self.x is None) != (self.y is None):
            raise ValueError("x/y must both be finite or both null")
        return self


class Keypoint(Coordinates):
    score: Finite | None
    visibility: Unit | None
    presence: Unit | None


class Box(StrictModel):
    x1: Finite
    y1: Finite
    x2: Finite
    y2: Finite

    @model_validator(mode="after")
    def positive_extent(self) -> Self:
        if self.x2 <= self.x1 or self.y2 <= self.y1:
            raise ValueError("bbox must have positive width and height")
        return self


class Detection(StrictModel):
    detection_id: Nonempty
    bbox: Box
    keypoints: list[Keypoint]

    @field_validator("keypoints")
    @classmethod
    def coco_order(cls, value: list[Keypoint]) -> list[Keypoint]:
        ordered_keypoints(value)
        return value


class PoseFrame(DisplayFrame):
    detections: list[Detection]

    @model_validator(mode="after")
    def unique_detections(self) -> Self:
        ids = [item.detection_id for item in self.detections]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate detection_id within frame")
        return self


class ModelFile(StrictModel):
    role: Nonempty
    sha256: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class Provenance(StrictModel):
    kind: Literal["model_inference"]
    adapter: Literal["mediapipe", "rtmpose"]
    adapter_version: Nonempty
    model_files: list[ModelFile]
    runtime: dict[Nonempty, Nonempty]
    parameters: dict[str, object]
    transforms: list[Nonempty]


class ArtifactHeader(StrictModel):
    asset_id: AssetID
    time_base: str
    coordinate_space: Literal["display_pixels"]
    keypoint_schema: Literal["coco17"]

    @field_validator("time_base")
    @classmethod
    def positive_rational(cls, value: str) -> str:
        if re.fullmatch(r"[+-]?[0-9]+/[+-]?[0-9]+", value) is None:
            raise ValueError("time_base must be a positive rational num/den string")
        numerator, denominator = map(int, value.split("/"))
        if denominator == 0 or Fraction(numerator, denominator) <= 0:
            raise ValueError("time_base must be positive with a nonzero denominator")
        return value


class PoseArtifact(ArtifactHeader):
    pose_schema_version: Literal["0.1.0"]
    frames: Annotated[list[PoseFrame], Field(min_length=1)]
    provenance: Provenance
    validation_ref: None
    measurement_status: Literal["research_only"]

    @model_validator(mode="after")
    def consistent_frames(self) -> Self:
        ordered_frames(self.frames)
        dimensions = {(frame.display_width, frame.display_height) for frame in self.frames}
        if len(dimensions) != 1:
            raise ValueError("pose display dimensions must be consistent")
        return self


class Seed(StrictModel):
    frame_index: Index
    detection_id: Nonempty


class SelectionParameters(StrictModel):
    min_iou: Annotated[Finite, Field(gt=0, le=1)]
    ambiguity_margin: Unit


class SelectionFrame(EvidenceFrame):
    status: Literal["not_started", "selected", "lost", "ambiguous"]
    detection_id: Nonempty | None
    reason: Reason | None

    @model_validator(mode="after")
    def consistent_status(self) -> Self:
        if self.status == "selected":
            if self.detection_id is None or self.reason is not None:
                raise ValueError("selected requires detection_id and null reason")
        elif self.detection_id is not None or self.reason is None:
            raise ValueError("unselected requires null detection_id and a reason")
        return self


class Selection(StrictModel):
    selection_schema_version: Literal["0.1.0"]
    asset_id: AssetID
    time_base: str
    method: Literal["conservative_iou_v0"]
    seed: Seed
    parameters: SelectionParameters
    frames: list[SelectionFrame]
    validation_ref: None

    @field_validator("time_base")
    @classmethod
    def positive_rational(cls, value: str) -> str:
        return ArtifactHeader.positive_rational(value)

    def check_artifact(self, artifact: PoseArtifact) -> None:
        if self.asset_id != artifact.asset_id or self.time_base != artifact.time_base:
            raise ValueError("selection asset_id/time_base does not match artifact")
        if len(self.frames) != len(artifact.frames):
            raise ValueError("selection must cover exactly the artifact timeline")
        found_seed = False
        stopped = False
        previous_index = None
        for selection, frame in zip(self.frames, artifact.frames):
            if (selection.frame_index, selection.pts) != (frame.frame_index, frame.pts):
                raise ValueError("selection frame_index/PTS does not match artifact")
            if frame.frame_index < self.seed.frame_index:
                if selection.status != "not_started":
                    raise ValueError("selection before seed must be not_started")
            elif frame.frame_index == self.seed.frame_index:
                found_seed = True
                if (selection.status, selection.detection_id) != ("selected", self.seed.detection_id):
                    raise ValueError("selection seed must select the explicit seed detection")
            else:
                if selection.status == "not_started":
                    raise ValueError("selection after seed cannot be not_started")
                if stopped and selection.status != "lost":
                    raise ValueError("selection cannot resume after loss/ambiguity")
                if previous_index != frame.frame_index - 1 and selection.status == "selected":
                    raise ValueError("selection cannot associate across a frame_index gap")
            if selection.status == "selected":
                if selection.detection_id not in {item.detection_id for item in frame.detections}:
                    raise ValueError("selected detection_id is absent from artifact frame")
            elif found_seed:
                stopped = True
            previous_index = frame.frame_index
        if not found_seed:
            raise ValueError("selection seed is absent from artifact timeline")


class ReferencePoint(Coordinates):
    visibility: Literal["unreviewed", "visible", "occluded", "out_of_frame"]

    @model_validator(mode="after")
    def explicit_visibility(self) -> Self:
        if self.visibility == "visible" and self.x is None:
            raise ValueError("visible reference requires finite x/y")
        if self.visibility != "visible" and self.x is not None:
            raise ValueError("nonvisible/unreviewed reference requires null coordinates")
        return self


class AnnotationFrame(DisplayFrame):
    detection_id: Nonempty | None
    keypoints: list[ReferencePoint]

    @field_validator("keypoints")
    @classmethod
    def coco_order(cls, value: list[ReferencePoint]) -> list[ReferencePoint]:
        ordered_keypoints(value)
        return value


class Annotations(ArtifactHeader):
    annotation_schema_version: Literal["0.1.0"]
    review_status: Literal["unreviewed", "reviewed"]
    annotator_id: Nonempty | None
    frames: list[AnnotationFrame]

    @model_validator(mode="after")
    def consistent_review(self) -> Self:
        ordered_frames(self.frames)
        if self.review_status == "reviewed":
            if self.annotator_id is None:
                raise ValueError("reviewed references require annotator_id")
            if any(point.visibility == "unreviewed" for frame in self.frames for point in frame.keypoints):
                raise ValueError("reviewed references require explicit visibility for every point")
        return self

    def check_artifact(self, artifact: PoseArtifact) -> None:
        # Exact serialized time_base is deliberate: do not silently normalize joins.
        for field in ("asset_id", "time_base", "coordinate_space", "keypoint_schema"):
            if getattr(self, field) != getattr(artifact, field):
                raise ValueError(f"annotation {field} does not match artifact")
        predictions = {frame.frame_index: frame for frame in artifact.frames}
        for reference in self.frames:
            frame = predictions.get(reference.frame_index)
            if frame is None:
                raise ValueError("annotation frame_index is absent from artifact")
            for field in ("pts", "display_width", "display_height"):
                if getattr(reference, field) != getattr(frame, field):
                    raise ValueError(f"annotation {field} does not match artifact frame")

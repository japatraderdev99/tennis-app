"""Unvalidated, deterministic M01 research arithmetic in corrected display pixels.

Only manual or synthetic annotations are accepted. This module performs no video
processing, interpolation, pose inference, anatomical reconstruction or coaching.
"""

from __future__ import annotations

import math
import re
from fractions import Fraction
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

__all__ = ["compute_m01", "normalized_to_display_pixels"]

_Nonempty = Annotated[str, Field(min_length=1)]
_PositiveInt = Annotated[int, Field(gt=0)]
_FrameIndex = Annotated[int, Field(ge=0)]
_Finite = Annotated[float, Field(allow_inf_nan=False)]
_EPSILON_PIXELS = 1e-12


class _StrictModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False)


class _Point(_StrictModel):
    x: _Finite
    y: _Finite

    @field_validator("x", "y", mode="before")
    @classmethod
    def _json_number(cls, value: object) -> float:
        # Strict Pydantic floats also accept Decimal/Fraction via __float__;
        # the frozen boundary is JSON numbers, so reject those conversions.
        return _finite_number(value, "coordinate")


class _Frame(_StrictModel):
    frame_index: _FrameIndex
    pts: int


class _Observation(_Frame):
    hip: _Point | None
    knee: _Point | None
    ankle: _Point | None


class _Window(_StrictModel):
    start_pts: int
    end_pts: int


class _Provenance(_StrictModel):
    kind: Literal["manual", "synthetic"]
    protocol_id: _Nonempty
    annotation_ref: _Nonempty


class _ResearchInput(_StrictModel):
    schema_version: Literal["0.1.0"]
    asset_id: _Nonempty
    time_base: str
    display_width: _PositiveInt
    display_height: _PositiveInt
    coordinate_space: Literal["display_pixels"]
    transforms: list[_Nonempty]
    body_side: Literal["left", "right"]
    phase_id: Literal["serve_preparation"]
    phase_window: _Window
    timeline: list[_Frame]
    observations: list[_Observation]
    provenance: _Provenance

    @model_validator(mode="after")
    def _check_timeline(self) -> _ResearchInput:
        if not re.fullmatch(r"[+-]?[0-9]+/[+-]?[0-9]+", self.time_base):
            raise ValueError("time_base must be a positive rational num/den string")
        numerator, denominator = map(int, self.time_base.split("/"))
        if denominator == 0 or Fraction(numerator, denominator) <= 0:
            raise ValueError("time_base must be positive with nonzero denominator")
        if not self.timeline:
            raise ValueError("timeline must contain phase endpoints")
        previous_pts = None
        for index, frame in enumerate(self.timeline):
            if frame.frame_index != index:
                raise ValueError("timeline frame_index must be consecutive from zero")
            if previous_pts is not None and frame.pts <= previous_pts:
                raise ValueError("timeline PTS must be strictly increasing")
            previous_pts = frame.pts
        endpoints = {frame.pts for frame in self.timeline}
        window = self.phase_window
        if window.start_pts > window.end_pts:
            raise ValueError("phase window must be ordered")
        if window.start_pts not in endpoints or window.end_pts not in endpoints:
            raise ValueError("phase endpoints must coincide with timeline entries")
        observed = set()
        for observation in self.observations:
            index = observation.frame_index
            if index in observed:
                raise ValueError("duplicate observation frame_index")
            observed.add(index)
            if index >= len(self.timeline):
                raise ValueError("observation is outside timeline")
            if observation.pts != self.timeline[index].pts:
                raise ValueError("observation PTS does not match timeline")
        return self


def _finite_number(value: object, name: str) -> float:
    # bool is a subclass of int but is not a JSON number under this contract.
    if type(value) not in (int, float):
        raise ValueError(f"{name} must be a finite number")
    try:
        result = float(value)
    except OverflowError as error:
        raise ValueError(f"{name} must be a finite number") from error
    if not math.isfinite(result):
        raise ValueError(f"{name} must be a finite number")
    return result


def normalized_to_display_pixels(
    x: float, y: float, width: int, height: int
) -> tuple[float, float]:
    """Scale normalized coordinates in the same corrected display plane.

    Out-of-frame finite coordinates are allowed. No orientation or SAR correction
    is inferred. Invalid types, dimensions or nonfinite output raise ValueError.
    """
    if type(width) is not int or width <= 0:
        raise ValueError("width must be a positive integer")
    if type(height) is not int or height <= 0:
        raise ValueError("height must be a positive integer")
    nx = _finite_number(x, "x")
    ny = _finite_number(y, "y")
    try:
        px, py = nx * width, ny * height
    except OverflowError as error:
        raise ValueError("display pixel coordinates must be finite") from error
    if not math.isfinite(px) or not math.isfinite(py):
        raise ValueError("display pixel coordinates must be finite")
    return px, py


def _unit_vector(point: _Point, origin: _Point) -> tuple[float, float] | None:
    dx, dy = point.x - origin.x, point.y - origin.y
    if math.isfinite(dx) and math.isfinite(dy):
        scale = max(abs(dx), abs(dy))
        if scale == 0:
            return None
        dx, dy = dx / scale, dy / scale
    else:
        # Subtraction of opposite extreme finite values may overflow. Scaling
        # before subtraction preserves direction without producing infinity.
        scale = max(abs(point.x), abs(point.y), abs(origin.x), abs(origin.y))
        dx = point.x / scale - origin.x / scale
        dy = point.y / scale - origin.y / scale
    norm = math.hypot(dx, dy)
    if norm == 0 or scale <= _EPSILON_PIXELS / norm:
        return None
    return dx / norm, dy / norm


def _measure(observation: _Observation) -> tuple[float | None, list[str]]:
    missing = [
        f"missing_{name}"
        for name in ("hip", "knee", "ankle")
        if getattr(observation, name) is None
    ]
    if missing:
        return None, missing
    hip = _unit_vector(observation.hip, observation.knee)
    ankle = _unit_vector(observation.ankle, observation.knee)
    reasons = []
    if hip is None:
        reasons.append("degenerate_hip_knee")
    if ankle is None:
        reasons.append("degenerate_ankle_knee")
    if reasons:
        return None, reasons
    cosine = max(-1.0, min(1.0, hip[0] * ankle[0] + hip[1] * ankle[1]))
    return 180.0 - math.degrees(math.acos(cosine)), []


def compute_m01(payload: dict) -> dict:
    """Compute raw projected front-knee flexion over an inclusive PTS window.

    Malformed inputs raise ValueError. Valid inputs with fewer than two phase
    frames or incomplete/degenerate observations return insufficient_evidence,
    retaining every phase frame in the partial series. Peak ties use earliest PTS.
    All numeric output is internal research output with no established validity.
    """
    if not isinstance(payload, dict):
        raise ValueError("payload must be a dict")
    data = _ResearchInput.model_validate(payload)
    observations = {item.frame_index: item for item in data.observations}
    series = []
    reasons = []
    for frame in data.timeline:
        if not data.phase_window.start_pts <= frame.pts <= data.phase_window.end_pts:
            continue
        observation = observations.get(frame.frame_index)
        value, point_reasons = (
            (None, ["missing_observation"])
            if observation is None
            else _measure(observation)
        )
        series.append({
            "frame_index": frame.frame_index, "pts": frame.pts,
            "value": value, "quality_reasons": point_reasons,
        })
        for reason in point_reasons:
            if reason not in reasons:
                reasons.append(reason)
    if len(series) < 2:
        reasons.append("insufficient_phase_frames")
    peak = None if reasons else max(series, key=lambda item: item["value"])
    return {
        "schema_version": "0.1.0",
        "metric_id": "front_knee_projected_flexion_peak",
        "definition_version": "0.1.0",
        "asset_id": data.asset_id,
        "status": "insufficient_evidence" if reasons else "computed",
        "value": None if peak is None else peak["value"],
        "unit": "deg",
        "body_side": data.body_side,
        "phase_id": "serve_preparation",
        "evidence": None if peak is None else {
            "frame_index": peak["frame_index"], "pts": peak["pts"],
        },
        "series": series,
        "quality_reasons": reasons,
        "method_version": "m01_unfiltered_complete_window_v0",
        "filter": "none",
        "validation_ref": None,
        "uncertainty": {"status": "not_established"},
        "provenance": data.provenance.model_dump(mode="json"),
    }

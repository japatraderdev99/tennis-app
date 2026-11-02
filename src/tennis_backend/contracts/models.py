"""Frozen v0.1.0 boundaries for local, unvalidated research artifacts.

Every field is required, including nullable fields. Cross-record invariants live
here; JSON Schema describes structural constraints and status-dependent rules.
"""

from __future__ import annotations

import math
import re
from fractions import Fraction
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    field_validator,
    model_validator,
)


NonemptyString = Annotated[str, Field(min_length=1, pattern=r"\S")]
ReasonCode = Annotated[str, Field(pattern=r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")]
Reasons = list[ReasonCode]
NonnegativeInt = Annotated[int, Field(ge=0)]
PositiveInt = Annotated[int, Field(gt=0)]
Finite = Annotated[float, Field(allow_inf_nan=False)]
NonnegativeNumber = Annotated[Finite, Field(ge=0)]
PositiveNumber = Annotated[Finite, Field(gt=0)]
Angle = Annotated[Finite, Field(ge=0, le=180)]
Rational = Annotated[str, Field(pattern=r"^[+-]?[0-9]+/[+-]?0*[1-9][0-9]*$")]
TimeBase = Annotated[str, Field(pattern=(
    r"^(?:[+]?0*[1-9][0-9]*/[+]?0*[1-9][0-9]*"
    r"|-0*[1-9][0-9]*/-0*[1-9][0-9]*)$"
))]
BodySide = Literal["left", "right"]

# Lexical guard, not a claim that arbitrary prose can be proved privacy-safe.
_ABSOLUTE_PATH = re.compile(r"(?:^|[\s\"'=:(\[])(?:/(?!/)[^\s]|[A-Za-z]:[\\/]|\\\\)")


def _safe_error_text(value: str) -> str:
    if _ABSOLUTE_PATH.search(value):
        raise ValueError("error text must not contain absolute local paths")
    return value


def _rational(value: str, *, positive: bool = False) -> str:
    if re.fullmatch(r"[+-]?[0-9]+/[+-]?[0-9]+", value) is None:
        raise ValueError("ratio must be an exact num/den string")
    numerator, denominator = map(int, value.split("/"))
    if denominator == 0:
        raise ValueError("ratio denominator must be nonzero")
    if positive and Fraction(numerator, denominator) <= 0:
        raise ValueError("time_base must be positive")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False)


class ErrorEnvelope(StrictModel):
    schema_version: Literal["0.1.0"]
    code: ReasonCode
    message: NonemptyString
    retryable: bool
    details: dict[str, JsonValue]

    @field_validator("message")
    @classmethod
    def sanitized_message(cls, value: str) -> str:
        return _safe_error_text(value)

    @field_validator("details", mode="before")
    @classmethod
    def json_details(cls, value: object) -> object:
        """Do not let Python containers/nonfinite values sneak into free JSON."""
        def check(item: object) -> None:
            if type(item) is str:
                _safe_error_text(item)
                return
            if item is None or type(item) in (bool, int):
                return
            if type(item) is float and math.isfinite(item):
                return
            if type(item) is list:
                for child in item:
                    check(child)
                return
            if type(item) is dict and all(type(key) is str for key in item):
                for key, child in item.items():
                    _safe_error_text(key)
                    if key.lower() in ("stderr", "command_stderr") and isinstance(child, str) and child:
                        raise ValueError("error details must not include raw command stderr")
                    check(child)
                return
            raise ValueError("details must contain only finite JSON values")

        check(value)
        return value


class MediaFrame(StrictModel):
    model_config = ConfigDict(json_schema_extra={
        "allOf": [{
            "if": {"properties": {"pts": {"type": "null"}}},
            "then": {"properties": {"time_seconds": {"type": "null"}}},
            "else": {"properties": {"time_seconds": {"type": "number"}}},
        }]
    })
    frame_index: NonnegativeInt
    pts: int | None
    time_seconds: Finite | None


class ProbeTool(StrictModel):
    name: Literal["ffprobe"]
    version: NonemptyString


class MediaManifest(StrictModel):
    schema_version: Literal["0.1.0"]
    asset_id: NonemptyString
    sha256: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    byte_size: PositiveInt
    source_name: Annotated[str, Field(min_length=1, pattern=r"^[^/\\\x00]+$")]
    stream_index: NonnegativeInt
    codec_name: NonemptyString
    coded_width: PositiveInt
    coded_height: PositiveInt
    sample_aspect_ratio: Rational | None
    rotation_degrees: Finite | None
    time_base: TimeBase
    duration_seconds: NonnegativeNumber | None
    nominal_fps: PositiveNumber | None
    average_fps: PositiveNumber | None
    frames: list[MediaFrame]
    quality_reasons: Reasons
    timing_basis: Literal["original_pts"]
    temporal_resolution: Literal["not_established"]
    tool: ProbeTool

    @field_validator("source_name")
    @classmethod
    def basename(cls, value: str) -> str:
        if value in (".", "..") or not value.strip():
            raise ValueError("source_name must be a file basename")
        return value

    @field_validator("sample_aspect_ratio")
    @classmethod
    def aspect_ratio(cls, value: str | None) -> str | None:
        return _rational(value) if value is not None else None

    @field_validator("time_base")
    @classmethod
    def positive_time_base(cls, value: str) -> str:
        return _rational(value, positive=True)

    @model_validator(mode="after")
    def consistent_media(self) -> Self:
        if self.asset_id != "sha256:" + self.sha256:
            raise ValueError("asset_id must be sha256: plus sha256")
        base = Fraction(*map(int, self.time_base.split("/")))
        previous_pts = None
        bad_timing = False
        for index, frame in enumerate(self.frames):
            if frame.frame_index != index:
                raise ValueError("media frame indices must be consecutive from zero")
            if frame.pts is None:
                bad_timing = True
                if frame.time_seconds is not None:
                    raise ValueError("missing PTS requires null time_seconds")
                continue
            try:
                expected = float(frame.pts * base)
            except OverflowError as exc:
                raise ValueError("PTS time must be representable as a finite number") from exc
            if not math.isfinite(expected) or frame.time_seconds is None or not math.isclose(
                frame.time_seconds, expected, rel_tol=0, abs_tol=2 * math.ulp(expected)
            ):
                raise ValueError("time_seconds must equal original PTS times time_base")
            if previous_pts is not None and frame.pts <= previous_pts:
                bad_timing = True
            previous_pts = frame.pts
        if bad_timing and not self.quality_reasons:
            raise ValueError("missing/nonmonotonic PTS requires a quality reason")
        return self


class Point(StrictModel):
    x: Finite
    y: Finite


class PhaseWindow(StrictModel):
    start_pts: int
    end_pts: int


class FrameReference(StrictModel):
    frame_index: NonnegativeInt
    pts: int


class Observation(FrameReference):
    hip: Point | None
    knee: Point | None
    ankle: Point | None


class Provenance(StrictModel):
    kind: Literal["synthetic", "manual"]
    protocol_id: NonemptyString
    annotation_ref: NonemptyString


class ResearchInput(StrictModel):
    schema_version: Literal["0.1.0"]
    asset_id: NonemptyString
    time_base: TimeBase
    display_width: PositiveInt
    display_height: PositiveInt
    coordinate_space: Literal["display_pixels"]
    transforms: list[NonemptyString]
    body_side: BodySide
    phase_id: Literal["serve_preparation"]
    phase_window: PhaseWindow
    timeline: Annotated[list[FrameReference], Field(min_length=2)]
    observations: list[Observation]
    provenance: Provenance

    @field_validator("time_base")
    @classmethod
    def positive_time_base(cls, value: str) -> str:
        return _rational(value, positive=True)

    @model_validator(mode="after")
    def consistent_timeline(self) -> Self:
        previous_pts = None
        for index, frame in enumerate(self.timeline):
            if frame.frame_index != index:
                raise ValueError("timeline indices must be consecutive from zero")
            if previous_pts is not None and frame.pts <= previous_pts:
                raise ValueError("timeline PTS must strictly increase")
            previous_pts = frame.pts
        start, end = self.phase_window.start_pts, self.phase_window.end_pts
        pts = {frame.pts for frame in self.timeline}
        if start > end or start not in pts or end not in pts:
            raise ValueError("inclusive phase endpoints must match ordered timeline PTS")
        if sum(start <= frame.pts <= end for frame in self.timeline) < 2:
            raise ValueError("phase must contain at least two timeline frames")
        seen = set()
        for observation in self.observations:
            index = observation.frame_index
            if index in seen or index >= len(self.timeline):
                raise ValueError("observation must reference a unique timeline frame")
            if observation.pts != self.timeline[index].pts:
                raise ValueError("observation PTS must match timeline frame")
            seen.add(index)
        # Missing/degenerate geometry is intentionally representable: metrics must
        # return insufficient_evidence while retaining the partial raw series.
        return self


class Uncertainty(StrictModel):
    status: Literal["not_established"]


class SeriesPoint(FrameReference):
    model_config = ConfigDict(json_schema_extra={
        "allOf": [{
            "if": {"properties": {"value": {"type": "null"}}},
            "then": {"properties": {"quality_reasons": {"minItems": 1}}},
            "else": {"properties": {"quality_reasons": {"maxItems": 0}}},
        }]
    })
    value: Angle | None
    quality_reasons: Reasons

    @model_validator(mode="after")
    def reason_matches_value(self) -> Self:
        if (self.value is None) != bool(self.quality_reasons):
            raise ValueError("null series values require reasons; numeric values forbid them")
        return self


class ResearchResult(StrictModel):
    model_config = ConfigDict(json_schema_extra={
        "allOf": [{
            "if": {"properties": {"status": {"const": "computed"}}},
            "then": {"properties": {
                "value": {"type": "number"}, "evidence": {"type": "object"},
                "quality_reasons": {"maxItems": 0},
                "series": {"minItems": 2, "items": {
                    "properties": {"value": {"type": "number"}}
                }},
            }},
            "else": {"properties": {
                "value": {"type": "null"}, "evidence": {"type": "null"},
                "quality_reasons": {"minItems": 1},
            }},
        }]
    })
    schema_version: Literal["0.1.0"]
    metric_id: Literal["front_knee_projected_flexion_peak"]
    definition_version: Literal["0.1.0"]
    asset_id: NonemptyString
    status: Literal["computed", "insufficient_evidence"]
    value: Angle | None
    unit: Literal["deg"]
    body_side: BodySide
    phase_id: Literal["serve_preparation"]
    evidence: FrameReference | None
    series: list[SeriesPoint]
    quality_reasons: Reasons
    method_version: Literal["m01_unfiltered_complete_window_v0"]
    filter: Literal["none"]
    validation_ref: None
    uncertainty: Uncertainty
    provenance: Provenance

    @model_validator(mode="after")
    def consistent_result(self) -> Self:
        previous = None
        for point in self.series:
            if previous is not None and (
                point.frame_index <= previous.frame_index or point.pts <= previous.pts
            ):
                raise ValueError("series frame indices and PTS must strictly increase")
            previous = point
        if self.status == "insufficient_evidence":
            if self.value is not None or self.evidence is not None or not self.quality_reasons:
                raise ValueError("insufficient result requires null value/evidence and reasons")
            return self
        if self.value is None or self.evidence is None or self.quality_reasons:
            raise ValueError("computed result requires value/evidence and no global reasons")
        if len(self.series) < 2 or any(point.value is None for point in self.series):
            raise ValueError("computed result requires at least two complete numeric samples")
        if any(
            current.frame_index != previous.frame_index + 1
            for previous, current in zip(self.series, self.series[1:])
        ):
            raise ValueError("computed series cannot skip frames inside its phase")
        # max keeps the first entry on a tie; the sequence has increasing PTS.
        peak = max(self.series, key=lambda point: point.value)
        if self.value != peak.value or (
            self.evidence.frame_index, self.evidence.pts
        ) != (peak.frame_index, peak.pts):
            raise ValueError("computed value/evidence must match the earliest series peak")
        return self


class AttemptCounts(StrictModel):
    total: NonnegativeInt
    valid: NonnegativeInt
    rejected: NonnegativeInt

    @model_validator(mode="after")
    def consistent_counts(self) -> Self:
        if self.valid + self.rejected != self.total:
            raise ValueError("valid plus rejected must equal total")
        return self


class PublicEvidence(FrameReference):
    asset_id: NonemptyString


class PublicMetric(StrictModel):
    model_config = ConfigDict(json_schema_extra={
        "allOf": [
            {
                "if": {"properties": {"status": {"const": "research_only"}}},
                "then": {"properties": {
                    "attempts": {"properties": {"valid": {"minimum": 1}}},
                    "evidence": {"minItems": 1},
                }},
            },
            {
                "if": {"properties": {"status": {"const": "insufficient_evidence"}}},
                "then": {"properties": {
                    "attempts": {"properties": {"valid": {"const": 0}}},
                    "quality_reasons": {"minItems": 1},
                }},
            },
        ]
    })
    metric_id: Literal["front_knee_projected_flexion_peak"]
    definition_version: Literal["0.1.0"]
    status: Literal["research_only", "insufficient_evidence", "unsupported"]
    value: None
    unit: Literal["deg"]
    measurement_space: Literal["image_2d_projected"]
    body_side: BodySide | None
    phase_id: Literal["serve_preparation"]
    validation_ref: None
    uncertainty: Uncertainty
    quality_reasons: Reasons
    evidence: list[PublicEvidence]
    attempts: AttemptCounts
    pipeline_ref: NonemptyString

    @model_validator(mode="after")
    def eligible_attempts(self) -> Self:
        if self.status == "research_only" and (self.attempts.valid < 1 or not self.evidence):
            raise ValueError("research_only requires a valid attempt and evidence")
        if self.status == "insufficient_evidence" and (
            self.attempts.valid != 0 or not self.quality_reasons
        ):
            raise ValueError("insufficient_evidence requires reasons and zero valid attempts")
        return self


class Execution(StrictModel):
    state: Literal["succeeded", "failed", "cancelled"]


class Comparison(StrictModel):
    state: Literal["not_evaluated"]
    delta: None
    reason: NonemptyString


class PublicReport(StrictModel):
    model_config = ConfigDict(json_schema_extra={
        "allOf": [
            {
                "if": {"properties": {"execution": {
                    "properties": {"state": {"const": "failed"}}
                }}},
                "then": {"properties": {"error": {"type": "object"}}},
                "else": {"properties": {"error": {"type": "null"}}},
            },
            {
                "if": {"properties": {"execution": {
                    "properties": {"state": {"enum": ["failed", "cancelled"]}}
                }}},
                "then": {"properties": {"metrics": {"maxItems": 0}}},
            },
        ]
    })
    schema_version: Literal["0.1.0"]
    report_id: NonemptyString
    session_id: NonemptyString
    run_id: NonemptyString
    asset_id: NonemptyString
    is_demo: bool
    execution: Execution
    metrics: list[PublicMetric]
    comparison: Comparison
    message: NonemptyString
    error: ErrorEnvelope | None

    @model_validator(mode="after")
    def consistent_report(self) -> Self:
        if self.execution.state != "succeeded" and self.metrics:
            raise ValueError("failed/cancelled execution cannot contain metrics")
        if (self.execution.state == "failed") != (self.error is not None):
            raise ValueError("only failed execution requires an error")
        if any(
            evidence.asset_id != self.asset_id
            for metric in self.metrics for evidence in metric.evidence
        ):
            raise ValueError("public evidence asset must match report asset")
        return self

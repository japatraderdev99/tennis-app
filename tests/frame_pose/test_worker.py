"""Synthetic image metadata/geometry only; native model is an optional local smoke."""
import hashlib
import importlib.util
from pathlib import Path
import struct
from types import SimpleNamespace

import pytest

spec = importlib.util.spec_from_file_location("analyze_frame", Path(__file__).parents[2] / "scripts/analyze_frame.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def png(width=64, height=48):
    return b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR" + struct.pack(">II", width, height) + bytes(9)


def pose():
    return [SimpleNamespace(x=0.1 + i / 100, y=0.2 + i / 100, visibility=0.9, presence=0.9) for i in range(33)]


def test_dimensions_precede_native_decode():
    assert worker.png_dimensions(png()) == (64, 48)
    for data in (b"", b"not a png", png(1281), png(height=0), bytes(worker.MAX_BYTES + 1)):
        with pytest.raises(ValueError):
            worker.png_dimensions(data)


def test_actual_evidence_binding_and_no_invented_clock_or_metrics():
    result = worker.make_result(png(), [pose()], model_sha256="a" * 64, runtime="synthetic")
    assert result["image_sha256"] == hashlib.sha256(png()).hexdigest()
    assert result["status"] == "estimated"
    assert result["scope"] == "single_image"
    assert result["validation"] == "not_validated"
    assert len(result["people"][0]["keypoints"]) == 17
    assert [p["name"] for p in result["people"][0]["keypoints"]] == list(worker.NAMES)
    assert all(key not in result for key in ("pts", "fps", "frame_index", "score", "metrics"))


@pytest.mark.parametrize("change", [
    {"x": float("nan")}, {"y": float("inf")}, {"x": -0.1}, {"y": 1.0},
    {"visibility": 0.49}, {"presence": 0.49}, {"visibility": None}, {"presence": 2},
])
def test_undrawable_points_are_paired_nulls_without_clamping(change):
    points = pose()
    for k, v in change.items():
        setattr(points[0], k, v)
    result = worker.make_result(png(), [points], model_sha256="a" * 64, runtime="synthetic")
    first = result["people"][0]["keypoints"][0]
    assert first["x"] is None and first["y"] is None


def test_no_person_is_an_explicit_observation():
    assert worker.make_result(png(), [], model_sha256="a" * 64, runtime="synthetic")["status"] == "no_person"
    points = pose()
    for point in points:
        point.visibility = 0
    assert worker.make_result(png(), [points], model_sha256="a" * 64, runtime="synthetic")["people"] == []


def test_degenerate_box_is_not_a_candidate_and_people_are_bounded():
    points = [SimpleNamespace(x=0.5, y=0.5, visibility=1.0, presence=1.0) for _ in range(33)]
    assert worker.make_result(png(), [points], model_sha256="a" * 64, runtime="synthetic")["people"] == []
    assert len(worker.make_result(png(), [pose()] * 9, model_sha256="a" * 64, runtime="synthetic")["people"]) == 4


def test_incomplete_model_output_fails():
    with pytest.raises(ValueError, match="invalid_model_output"):
        worker.make_result(png(), [pose()[:10]], model_sha256="a" * 64, runtime="synthetic")

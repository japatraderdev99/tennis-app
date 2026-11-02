"""Synthetic implementation properties only; no athlete validity is claimed."""

from copy import deepcopy
from decimal import Decimal
from fractions import Fraction
import json
import math

import pytest

from tennis_backend.metrics import compute_m01, normalized_to_display_pixels


def point(x, y):
    return {"x": x, "y": y}


def observation(index, pts, flexion=90):
    theta = math.radians(180 - flexion)
    return {
        "frame_index": index, "pts": pts,
        "hip": point(10, 0), "knee": point(0, 0),
        "ankle": point(10 * math.cos(theta), 10 * math.sin(theta)),
    }


def payload(pts=(100, 102, 113, 129), flexions=(0, 45, 120, 90)):
    return {
        "schema_version": "0.1.0", "asset_id": "synthetic:geometry",
        "time_base": "1/1000", "display_width": 1920, "display_height": 1080,
        "coordinate_space": "display_pixels", "transforms": [],
        "body_side": "left", "phase_id": "serve_preparation",
        "phase_window": {"start_pts": pts[0], "end_pts": pts[-1]},
        "timeline": [{"frame_index": i, "pts": t} for i, t in enumerate(pts)],
        "observations": [observation(i, t, f) for i, (t, f) in enumerate(zip(pts, flexions))],
        "provenance": {
            "kind": "synthetic", "protocol_id": "geometry_v0",
            "annotation_ref": "fixture:manual_coordinates",
        },
    }


def assert_insufficient(result):
    assert result["status"] == "insufficient_evidence"
    assert result["value"] is None
    assert result["evidence"] is None
    assert result["quality_reasons"]
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("angle", [0, 30, 45, 60, 90, 120, 150, 180])
def test_known_geometry(angle):
    result = compute_m01(payload((0, 11), (angle, angle)))
    assert result["status"] == "computed"
    assert result["value"] == pytest.approx(angle, abs=1e-6)
    assert [row["value"] for row in result["series"]] == pytest.approx([angle, angle], abs=1e-6)
    assert result["quality_reasons"] == []
    assert all(row["quality_reasons"] == [] for row in result["series"])


def test_exact_output_contract_determinism_and_no_mutation():
    data = payload()
    before = deepcopy(data)
    result = compute_m01(data)
    assert result == compute_m01(data)
    assert data == before
    assert result == {
        "schema_version": "0.1.0",
        "metric_id": "front_knee_projected_flexion_peak",
        "definition_version": "0.1.0", "asset_id": "synthetic:geometry",
        "status": "computed", "value": pytest.approx(120), "unit": "deg",
        "body_side": "left", "phase_id": "serve_preparation",
        "evidence": {"frame_index": 2, "pts": 113},
        "series": [
            {"frame_index": i, "pts": t, "value": pytest.approx(v), "quality_reasons": []}
            for i, (t, v) in enumerate(zip((100, 102, 113, 129), (0, 45, 120, 90)))
        ],
        "quality_reasons": [], "method_version": "m01_unfiltered_complete_window_v0",
        "filter": "none", "validation_ref": None,
        "uncertainty": {"status": "not_established"}, "provenance": data["provenance"],
    }
    result["provenance"]["kind"] = "manual"
    assert data == before
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("side", ["left", "right"])
def test_manual_side_and_provenance_are_preserved(side):
    data = payload()
    data["body_side"] = side
    data["provenance"]["kind"] = "manual"
    data["transforms"] = ["manual_display_rotation", "sar_corrected"]
    result = compute_m01(data)
    assert result["body_side"] == side
    assert result["provenance"] == data["provenance"]


@pytest.mark.parametrize("rotation,scale,tx,ty", [
    (0, 1, 360, -77), (0.71, 1, 0, 0), (0, 7.5, 0, 0),
    (-2.0, 0.05, -100, 300), (math.pi, 1e100, 0, 0),
])
def test_translation_rotation_uniform_scale_invariance(rotation, scale, tx, ty):
    data = payload()
    expected = compute_m01(data)
    for obs in data["observations"]:
        for name in ("hip", "knee", "ankle"):
            x, y = obs[name]["x"], obs[name]["y"]
            obs[name] = point(
                scale * (math.cos(rotation) * x - math.sin(rotation) * y) + tx,
                scale * (math.sin(rotation) * x + math.cos(rotation) * y) + ty,
            )
    result = compute_m01(data)
    assert result["value"] == pytest.approx(expected["value"])
    assert result["evidence"] == expected["evidence"]
    assert [s["value"] for s in result["series"]] == pytest.approx(
        [s["value"] for s in expected["series"]], abs=2e-6,
    )


def test_rectangular_display_uses_independent_dimensions():
    hip = normalized_to_display_pixels(.6, .5, 200, 100)
    knee = normalized_to_display_pixels(.5, .5, 200, 100)
    ankle = normalized_to_display_pixels(.6, .7, 200, 100)
    assert hip == (120, 50)
    assert knee == (100, 50)
    assert ankle == (120, 70)
    data = payload((0, 1), (0, 0))
    for obs in data["observations"]:
        obs.update(hip=point(*hip), knee=point(*knee), ankle=point(*ankle))
    assert compute_m01(data)["value"] == pytest.approx(135)


def test_inclusive_window_keeps_irregular_original_pts_and_earliest_tie():
    data = payload((700, 701, 721, 799, 810), (180, 90, 45, 90, 180))
    data["phase_window"] = {"start_pts": 701, "end_pts": 799}
    data["observations"].reverse()  # annotation input order is not time order
    result = compute_m01(data)
    assert [s["pts"] for s in result["series"]] == [701, 721, 799]
    assert [s["frame_index"] for s in result["series"]] == [1, 2, 3]
    assert result["value"] == pytest.approx(90)
    assert result["evidence"] == {"frame_index": 1, "pts": 701}


def test_negative_pts_are_preserved_and_time_base_does_not_resample():
    data = payload((-99, -20, 0, 1234))
    result = compute_m01(data)
    data["time_base"] = "1001/30000"
    assert compute_m01(data) == result
    assert result["evidence"]["pts"] == 0


@pytest.mark.parametrize("removed", [0, 1, 2, 3])
def test_any_missing_observation_invalidates_peak_preserves_partial_series(removed):
    data = payload()
    del data["observations"][removed]
    result = compute_m01(data)
    assert_insufficient(result)
    assert len(result["series"]) == 4
    for index, row in enumerate(result["series"]):
        if index == removed:
            assert row["value"] is None
            assert row["quality_reasons"] == ["missing_observation"]
        else:
            assert row["value"] is not None
            assert row["quality_reasons"] == []


@pytest.mark.parametrize("joint", ["hip", "knee", "ankle"])
def test_null_point_invalidates_whole_window(joint):
    data = payload()
    data["observations"][1][joint] = None
    result = compute_m01(data)
    assert_insufficient(result)
    assert result["quality_reasons"] == [f"missing_{joint}"]
    assert result["series"][1]["value"] is None
    assert result["series"][2]["value"] == pytest.approx(120)


@pytest.mark.parametrize("joint,delta", [
    ("hip", 0), ("hip", 1e-13), ("hip", 1e-12),
    ("ankle", 0), ("ankle", 1e-12),
])
def test_degenerate_norm_threshold_is_inclusive(joint, delta):
    data = payload()
    data["observations"][1][joint] = point(delta, 0)
    result = compute_m01(data)
    assert_insufficient(result)
    assert f"degenerate_{joint}_knee" in result["quality_reasons"]


def test_just_above_norm_threshold_is_usable():
    data = payload()
    data["observations"][1]["hip"] = point(math.nextafter(1e-12, math.inf), 0)
    assert compute_m01(data)["status"] == "computed"


def test_finite_extreme_coordinates_do_not_overflow_arithmetic():
    data = payload((0, 1), (0, 0))
    for obs in data["observations"]:
        obs.update(hip=point(-1.7e308, 1.7e308), knee=point(1.7e308, 1.7e308),
                   ankle=point(1.7e308, -1.7e308))
    result = compute_m01(data)
    assert result["value"] == pytest.approx(90)
    json.dumps(result, allow_nan=False)


def test_all_missing_and_multiple_invalid_reasons_are_stable_and_deduplicated():
    data = payload()
    data["observations"] = []
    result = compute_m01(data)
    assert_insufficient(result)
    assert result["quality_reasons"] == ["missing_observation"]
    data = payload()
    for obs in data["observations"]:
        obs.update(hip=None, knee=None, ankle=None)
    result = compute_m01(data)
    assert_insufficient(result)
    assert result["quality_reasons"] == ["missing_hip", "missing_knee", "missing_ankle"]


def test_single_phase_frame_is_insufficient_with_usable_series():
    data = payload()
    data["phase_window"] = {"start_pts": 113, "end_pts": 113}
    result = compute_m01(data)
    assert_insufficient(result)
    assert result["quality_reasons"] == ["insufficient_phase_frames"]
    assert len(result["series"]) == 1
    assert result["series"][0]["value"] == pytest.approx(120)


def test_invalid_evidence_outside_window_does_not_invalidate_window():
    data = payload()
    data["phase_window"] = {"start_pts": 102, "end_pts": 113}
    del data["observations"][3]
    data["observations"][0]["hip"] = None
    assert compute_m01(data)["status"] == "computed"


def set_path(data, path, value):
    target = data
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value


@pytest.mark.parametrize("path,value", [
    (("body_side",), "both"), (("body_side",), "LEFT"),
    (("schema_version",), "1.0.0"), (("phase_id",), "other"),
    (("coordinate_space",), "normalized"), (("asset_id",), ""),
    (("display_width",), 0), (("display_height",), -1),
    (("display_width",), True), (("display_height",), 100.0),
    (("display_width",), "1920"), (("transforms",), [""]),
    (("transforms",), ("rotation",)), (("time_base",), "1/0"),
    (("time_base",), "0/1000"), (("time_base",), "-1/1000"),
    (("time_base",), "1.0/1000"), (("time_base",), "1"),
    (("time_base",), "1/1000\n"), (("time_base",), 0.001),
    (("phase_window", "start_pts"), 101), (("phase_window", "end_pts"), 1),
    (("phase_window", "start_pts"), True),
    (("timeline",), []), (("timeline", 0, "frame_index"), 1),
    (("timeline", 1, "frame_index"), 0), (("timeline", 2, "frame_index"), 3),
    (("timeline", 0, "pts"), None), (("timeline", 0, "pts"), 100.0),
    (("timeline", 0, "pts"), "100"), (("timeline", 0, "pts"), True),
    (("timeline", 1, "pts"), 100), (("timeline", 1, "pts"), 99),
    (("observations", 0, "frame_index"), -1),
    (("observations", 0, "frame_index"), 4),
    (("observations", 0, "pts"), 101),
    (("observations", 0, "hip", "x"), True),
    (("observations", 0, "hip", "x"), "1.0"),
    (("observations", 0, "hip", "x"), Decimal("0.5")),
    (("observations", 0, "hip", "x"), Fraction(1, 2)),
    (("observations", 0, "hip", "x"), 10**1000),
    (("observations", 0, "hip", "x"), math.nan),
    (("observations", 0, "knee", "y"), math.inf),
    (("observations", 0, "ankle", "x"), -math.inf),
    (("provenance", "kind"), "model"), (("provenance", "protocol_id"), ""),
    (("provenance", "annotation_ref"), None),
])
def test_malformed_input_is_value_error(path, value):
    data = payload()
    set_path(data, path, value)
    with pytest.raises(ValueError):
        compute_m01(data)


@pytest.mark.parametrize("path", [
    (), ("phase_window",), ("timeline", 0), ("observations", 0),
    ("observations", 0, "hip"), ("provenance",),
])
def test_undocumented_fields_are_forbidden_at_every_level(path):
    data = payload()
    target = data
    for key in path:
        target = target[key]
    target["unexpected"] = 1
    with pytest.raises(ValueError):
        compute_m01(data)


@pytest.mark.parametrize("path,key", [
    ((), "transforms"), ((), "provenance"), (("observations", 0), "hip"),
    (("observations", 0, "hip"), "x"), (("timeline", 0), "pts"),
    (("provenance",), "annotation_ref"),
])
def test_required_nullable_fields_cannot_be_omitted(path, key):
    data = payload()
    target = data
    for item in path:
        target = target[item]
    del target[key]
    with pytest.raises(ValueError):
        compute_m01(data)


def test_duplicate_observations_are_malformed_even_outside_window():
    data = payload()
    data["phase_window"] = {"start_pts": 102, "end_pts": 113}
    data["observations"].append(deepcopy(data["observations"][0]))
    with pytest.raises(ValueError):
        compute_m01(data)


@pytest.mark.parametrize("value", [None, [], "{}", 1])
def test_non_mapping_payload_is_value_error(value):
    with pytest.raises(ValueError):
        compute_m01(value)


@pytest.mark.parametrize("x,y,w,h", [
    (math.nan, 0, 100, 50), (0, math.inf, 100, 50),
    (-math.inf, 0, 100, 50), (True, 0, 100, 50), (0, False, 100, 50),
    ("0.5", 0, 100, 50), (None, 0, 100, 50),
    (0, 0, 0, 50), (0, 0, 100, -1), (0, 0, 100.0, 50),
    (0, 0, 100, True), (1e308, 1, 100, 50),
    (10**1000, 0, 100, 50), (0, 0, 10**1000, 50),
])
def test_helper_rejects_malformed_or_nonfinite_result(x, y, w, h):
    with pytest.raises(ValueError):
        normalized_to_display_pixels(x, y, w, h)


def test_helper_allows_finite_out_of_frame_coordinates_without_clamping():
    assert normalized_to_display_pixels(-.5, 1.25, 1920, 1080) == (-960, 1350)


def test_reversed_window_is_malformed_even_when_endpoints_exist():
    data = payload()
    data["phase_window"] = {"start_pts": 129, "end_pts": 100}
    with pytest.raises(ValueError):
        compute_m01(data)

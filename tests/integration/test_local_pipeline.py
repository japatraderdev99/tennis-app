from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

import pytest

from tennis_backend.contracts import PublicReport, ResearchResult
from tennis_backend.media import inspect_media
from tennis_backend.pipeline import analyze_local, write_bundle


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        pytest.skip("FFmpeg required for real synthetic integration")
    path = tmp_path_factory.mktemp("integration-media") / "solid color.mp4"
    subprocess.run([ffmpeg, "-v", "error", "-nostdin", "-f", "lavfi", "-i",
                    "color=c=blue:s=160x120:r=5:d=1", "-an", "-c:v", "mpeg4",
                    "-y", str(path)], check=True, timeout=15)
    return path


@pytest.fixture
def annotation(video):
    media = inspect_media(video)
    frames = [{"frame_index": frame["frame_index"], "pts": frame["pts"]}
              for frame in media["frames"]]
    return {
        "schema_version": "0.1.0", "asset_id": media["asset_id"],
        "time_base": media["time_base"], "display_width": 160,
        "display_height": 120, "coordinate_space": "display_pixels",
        "transforms": [], "body_side": "left", "phase_id": "serve_preparation",
        "phase_window": {"start_pts": frames[0]["pts"], "end_pts": frames[-1]["pts"]},
        "timeline": frames,
        "observations": [{**frame, "hip": {"x": 80.0, "y": 20.0},
                          "knee": {"x": 80.0, "y": 60.0},
                          "ankle": {"x": 120.0, "y": 60.0}} for frame in frames],
        "provenance": {"kind": "synthetic", "protocol_id": "test-right-angle-v0",
                       "annotation_ref": "synthetic:integration-not-athlete-data"},
    }


def test_complete_real_media_to_research_and_public_report(video, annotation, tmp_path):
    original_hash = hashlib.sha256(video.read_bytes()).hexdigest()
    bundle = analyze_local(video, annotation)
    assert bundle["research"]["status"] == "computed"
    assert bundle["research"]["value"] == pytest.approx(90)
    metric = bundle["report"]["metrics"][0]
    assert metric["status"] == "research_only"
    assert metric["value"] is None
    assert metric["validation_ref"] is None
    assert bundle["report"]["is_demo"] is True
    assert bundle["report"]["comparison"]["state"] == "not_evaluated"
    evidence = metric["evidence"][0]
    assert evidence["asset_id"] == bundle["media"]["asset_id"]
    assert any(frame["frame_index"] == evidence["frame_index"] and
               frame["pts"] == evidence["pts"] for frame in bundle["media"]["frames"])
    assert hashlib.sha256(video.read_bytes()).hexdigest() == original_hash
    repeated = analyze_local(video, annotation)
    assert repeated["research"] == bundle["research"]
    assert repeated["media"] == bundle["media"]
    assert repeated["report"]["run_id"] != bundle["report"]["run_id"]
    assert repeated["report"]["report_id"] != bundle["report"]["report_id"]
    PublicReport.model_validate(bundle["report"])
    ResearchResult.model_validate(bundle["research"])

    directory = write_bundle(bundle, tmp_path / "new bundle", source_video=video)
    checksums = json.loads((directory / "checksums.json").read_text())["files"]
    for name, digest in checksums.items():
        assert hashlib.sha256((directory / name).read_bytes()).hexdigest() == digest
    assert checksums["source-video.mp4"] == bundle["media"]["sha256"]
    with pytest.raises(FileExistsError):
        write_bundle(bundle, directory)


def test_missing_peak_evidence_stays_absent_publicly(video, annotation):
    annotation["observations"][2]["knee"] = None
    bundle = analyze_local(video, annotation)
    research = bundle["research"]
    assert research["status"] == "insufficient_evidence"
    assert research["value"] is None
    assert research["evidence"] is None
    assert len(research["series"]) == len(annotation["timeline"])
    metric = bundle["report"]["metrics"][0]
    assert metric["status"] == "insufficient_evidence"
    assert metric["attempts"] == {"total": 1, "valid": 0, "rejected": 1}
    assert metric["value"] is None
    assert metric["quality_reasons"]


def test_one_frame_phase_is_representable_but_never_computed(video, annotation):
    pts = annotation["timeline"][1]["pts"]
    annotation["phase_window"] = {"start_pts": pts, "end_pts": pts}
    bundle = analyze_local(video, annotation)
    assert bundle["research"]["status"] == "insufficient_evidence"
    assert bundle["research"]["quality_reasons"] == ["insufficient_phase_frames"]
    assert bundle["research"]["value"] is None
    assert len(bundle["research"]["series"]) == 1
    assert bundle["report"]["metrics"][0]["value"] is None


@pytest.mark.parametrize("field, replacement, reason", [
    ("asset_id", "sha256:" + "0" * 64, "annotation_asset_mismatch"),
    ("time_base", "1/997", "annotation_time_base_mismatch"),
])
def test_annotation_must_belong_to_media(video, annotation, field, replacement, reason):
    annotation[field] = replacement
    with pytest.raises(ValueError, match=reason):
        analyze_local(video, annotation)


def test_shortened_but_internally_consistent_timeline_rejected(video, annotation):
    annotation["timeline"].pop()
    annotation["observations"].pop()
    annotation["phase_window"]["end_pts"] = annotation["timeline"][-1]["pts"]
    with pytest.raises(ValueError, match="annotation_timeline_mismatch"):
        analyze_local(video, annotation)


def test_shifted_but_internally_consistent_pts_rejected(video, annotation):
    for frame in annotation["timeline"] + annotation["observations"]:
        frame["pts"] += 7
    for key in annotation["phase_window"]:
        annotation["phase_window"][key] += 7
    with pytest.raises(ValueError, match="annotation_timeline_mismatch"):
        analyze_local(video, annotation)


@pytest.mark.parametrize("key,replacement", [
    ("asset_id", "sha256:" + "1" * 64),
    ("body_side", "right"),
    ("provenance", {"kind": "manual", "protocol_id": "different",
                    "annotation_ref": "different"}),
])
def test_valid_result_schema_does_not_replace_cross_artifact_checks(
        video, annotation, monkeypatch, key, replacement):
    from tennis_backend.metrics import compute_m01
    forged = deepcopy(compute_m01(annotation))
    forged[key] = replacement
    ResearchResult.model_validate(forged)
    monkeypatch.setattr("tennis_backend.pipeline.compute_m01", lambda _: forged)
    with pytest.raises(ValueError, match="research_.*_mismatch"):
        analyze_local(video, annotation)


def test_manual_annotation_is_not_marked_as_synthetic_demo(video, annotation):
    # Still synthetic test data; this only verifies provenance routing logic.
    annotation["provenance"]["kind"] = "manual"
    report = analyze_local(video, annotation)["report"]
    assert report["is_demo"] is False
    assert report["metrics"][0]["status"] == "research_only"
    assert report["metrics"][0]["value"] is None


def test_cli_research_and_error_are_structured(video, annotation, tmp_path):
    supplied = tmp_path / "annotation.json"
    supplied.write_text(json.dumps(annotation), encoding="utf-8")
    destination = tmp_path / "bundle"
    command = [sys.executable, "-m", "tennis_backend", "research", str(video),
               "--annotations", str(supplied), "--output-dir", str(destination)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=20)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["is_demo"] is True
    assert json.loads((destination / "report.json").read_text())["metrics"][0]["value"] is None
    again = subprocess.run(command, capture_output=True, text=True, timeout=20)
    assert again.returncode == 2
    assert json.loads(again.stderr)["code"] == "local_input_or_output_error"
    assert str(tmp_path) not in again.stderr


def test_cli_nan_json_is_rejected_without_creating_output(video, tmp_path):
    supplied = tmp_path / "bad.json"
    supplied.write_text('{"x": NaN}', encoding="utf-8")
    destination = tmp_path / "must-not-exist"
    result = subprocess.run([sys.executable, "-m", "tennis_backend", "research", str(video),
                             "--annotations", str(supplied), "--output-dir", str(destination)],
                            capture_output=True, text=True, timeout=20)
    assert result.returncode == 2
    assert json.loads(result.stderr)["retryable"] is False
    assert not destination.exists()


def test_bad_source_copy_cannot_mark_bundle_complete(video, annotation, tmp_path):
    bundle = analyze_local(video, annotation)
    different = tmp_path / "changed.mp4"
    different.write_bytes(b"not the original synthetic file")
    destination = tmp_path / "partial-bundle"
    with pytest.raises(ValueError, match="source_video_changed"):
        write_bundle(bundle, destination, source_video=different)
    assert not (destination / "checksums.json").exists()


def test_writer_rejects_public_numeric_value(video, annotation, tmp_path):
    bundle = analyze_local(video, annotation)
    bundle["report"]["metrics"][0]["value"] = 90.0
    destination = tmp_path / "invalid-bundle"
    with pytest.raises(ValueError):
        write_bundle(bundle, destination)
    assert not destination.exists()


def test_annotation_reader_rejects_fifo_without_waiting(tmp_path):
    import os
    from tennis_backend.__main__ import _read_annotation
    fifo = tmp_path / "annotation.fifo"
    os.mkfifo(fifo)
    with pytest.raises(ValueError, match="annotation_file_not_regular"):
        _read_annotation(fifo)


def test_annotation_reader_rejects_oversize_input(tmp_path):
    from tennis_backend.__main__ import _read_annotation
    oversized = tmp_path / "large.json"
    with oversized.open("wb") as stream:
        stream.truncate(16 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="annotation_file_too_large"):
        _read_annotation(oversized)

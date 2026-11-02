"""Local research integration; does not estimate pose or provide coaching."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import stat
from typing import Any
import uuid

from tennis_backend.contracts import (
    MediaManifest,
    PublicReport,
    ResearchInput,
    ResearchResult,
)
from tennis_backend.media import MediaLimits, inspect_media
from tennis_backend.metrics import compute_m01

PIPELINE_VERSION = "p1-foundation/0.1.0"


def _json_bytes(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, sort_keys=True,
                       indent=2, allow_nan=False) + "\n").encode("utf-8")


def analyze_local(
    video_path: str | Path,
    annotation: dict[str, Any],
    *,
    limits: MediaLimits | None = None,
) -> dict[str, dict[str, Any]]:
    """Join the actual video timeline to explicit annotations, then compute M01.

    The annotations are supplied by the caller. No landmarks are extracted from
    the video. Schema validation alone is insufficient: this function verifies
    that the complete annotation timeline belongs to the inspected asset.
    """
    supplied = ResearchInput.model_validate(annotation).model_dump(mode="json")
    media = MediaManifest.model_validate(
        inspect_media(video_path, limits=limits)
    ).model_dump(mode="json")
    if supplied["asset_id"] != media["asset_id"]:
        raise ValueError("annotation_asset_mismatch")
    if supplied["time_base"] != media["time_base"]:
        raise ValueError("annotation_time_base_mismatch")
    actual_timeline = [
        {"frame_index": frame["frame_index"], "pts": frame["pts"]}
        for frame in media["frames"]
    ]
    if supplied["timeline"] != actual_timeline:
        raise ValueError("annotation_timeline_mismatch")

    research = ResearchResult.model_validate(
        compute_m01(supplied)
    ).model_dump(mode="json")
    # Validate the join, even if an adapter's internal result passed its schema.
    if research["asset_id"] != media["asset_id"]:
        raise ValueError("research_asset_mismatch")
    if research["body_side"] != supplied["body_side"]:
        raise ValueError("research_body_side_mismatch")
    if research["phase_id"] != supplied["phase_id"]:
        raise ValueError("research_phase_mismatch")
    if research["provenance"] != supplied["provenance"]:
        raise ValueError("research_provenance_mismatch")
    window = supplied["phase_window"]
    phase_frames = [frame for frame in actual_timeline
                    if window["start_pts"] <= frame["pts"] <= window["end_pts"]]
    result_frames = [{"frame_index": frame["frame_index"], "pts": frame["pts"]}
                     for frame in research["series"]]
    if result_frames != phase_frames:
        raise ValueError("research_series_timeline_mismatch")
    evidence = research["evidence"]
    if evidence is not None and evidence not in phase_frames:
        raise ValueError("research_evidence_mismatch")

    digest = hashlib.sha256(_json_bytes({
        "pipeline": PIPELINE_VERSION, "annotation": supplied,
        "media": media, "research": research,
    })).hexdigest()
    usable = research["status"] == "computed"
    public_evidence = ([{"asset_id": media["asset_id"], **evidence}]
                       if usable and evidence is not None else [])
    run_id = "run:" + str(uuid.uuid4())
    report = PublicReport.model_validate({
        "schema_version": "0.1.0",
        "report_id": "report:" + str(uuid.uuid4()),
        "session_id": "local:" + digest,
        "run_id": run_id,
        "asset_id": media["asset_id"],
        "is_demo": supplied["provenance"]["kind"] == "synthetic",
        "execution": {"state": "succeeded"},
        "metrics": [{
            "metric_id": research["metric_id"],
            "definition_version": research["definition_version"],
            "status": "research_only" if usable else "insufficient_evidence",
            "value": None,
            "unit": "deg",
            "measurement_space": "image_2d_projected",
            "body_side": research["body_side"],
            "phase_id": research["phase_id"],
            "validation_ref": None,
            "uncertainty": {"status": "not_established"},
            "quality_reasons": research["quality_reasons"],
            "evidence": public_evidence,
            "attempts": {"total": 1, "valid": int(usable),
                         "rejected": int(not usable)},
            "pipeline_ref": PIPELINE_VERSION,
        }],
        "comparison": {
            "state": "not_evaluated", "delta": None,
            "reason": "comparison_not_implemented_in_research_foundation",
        },
        "message": (
            "Demonstração com landmarks sintéticos; nenhuma pose foi extraída do vídeo. "
            if supplied["provenance"]["kind"] == "synthetic" else
            "Análise de anotações manuais; nenhuma pose foi extraída do vídeo. "
        ) + ("A medição permanece em pesquisa." if usable else
             "A evidência disponível não permite calcular a tentativa."),
        "error": None,
    }).model_dump(mode="json")
    return {"media": media, "annotation": supplied,
            "research": research, "report": report}


def write_bundle(
    bundle: dict[str, dict[str, Any]], output_dir: str | Path,
    *, source_video: str | Path | None = None,
) -> Path:
    """Write a new local artifact directory; never overwrite an existing bundle.

    This is a local filesystem operation, not transactional multiuser storage.
    A filesystem failure may leave a partial directory; checksums are written last
    so consumers can distinguish a complete bundle. Originals are never written.
    """
    required = {"media", "annotation", "research", "report"}
    if set(bundle) != required:
        raise ValueError("unexpected_bundle_members")
    for name, model in (("media", MediaManifest), ("annotation", ResearchInput),
                        ("research", ResearchResult), ("report", PublicReport)):
        model.model_validate(bundle[name])
    encoded = {name + ".json": _json_bytes(bundle[name]) for name in sorted(required)}
    checksums = {name: hashlib.sha256(data).hexdigest()
                 for name, data in encoded.items()}
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=False)
    for name, data in encoded.items():
        with (target / name).open("xb") as stream:
            stream.write(data)
    if source_video is not None:
        # Copy through one descriptor, bound by inspected size; check original hash.
        # A partial copy never receives the completion marker.
        descriptor = os.open(source_video, os.O_RDONLY | os.O_NONBLOCK)
        with os.fdopen(descriptor, "rb") as source:
            if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
                raise ValueError("source_video_not_regular")
            name = "source-video" + Path(source_video).suffix.lower()
            digest = hashlib.sha256()
            copied = 0
            with (target / name).open("xb") as destination:
                while chunk := source.read(1024 * 1024):
                    copied += len(chunk)
                    if copied > bundle["media"]["byte_size"]:
                        raise ValueError("source_video_changed")
                    digest.update(chunk)
                    destination.write(chunk)
            if copied != bundle["media"]["byte_size"] or digest.hexdigest() != bundle["media"]["sha256"]:
                raise ValueError("source_video_changed")
            checksums[name] = digest.hexdigest()
    completion = _json_bytes({"schema_version": "0.1.0", "files": checksums})
    with (target / "checksums.json").open("xb") as stream:
        stream.write(completion)
    return target

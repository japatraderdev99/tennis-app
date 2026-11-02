"""Join inferred frames to inspected media without releasing a sports metric.

Callers own decoding and adapter lifetime. No cloud SDK or image library is
imported here. Coordinates refer to the explicitly declared display transforms.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Iterable, Protocol

from tennis_backend.contracts import MediaManifest


class PoseAdapter(Protocol):
    def infer(self, image_bgr: Any, *, frame_index: int, pts: int,
              time_base: str) -> dict: ...

    def provenance(self) -> dict: ...


def infer_pose_frames(
    media: dict,
    adapter: PoseAdapter,
    frames: Iterable[tuple[int, Any]],
    *,
    transforms: list[str],
    max_frames: int = 2_000,
) -> dict:
    """Infer a bounded sequence, preserving its join to the original timeline.

An adapter is borrowed, not closed. The caller must use try/finally to close it.
Scientific validity is deliberately absent; selection can refuse sparse frames.
"""
    from tennis_backend.pose import PoseArtifact

    manifest = MediaManifest.model_validate(media)
    if type(max_frames) is not int or max_frames <= 0:
        raise ValueError("invalid_frame_limit")
    if type(transforms) is not list or not transforms or any(
        type(value) is not str or not value.strip() for value in transforms
    ):
        raise ValueError("explicit_display_transforms_required")
    if any(frame.pts is None for frame in manifest.frames) or any(
        after.pts <= before.pts
        for before, after in zip(manifest.frames, manifest.frames[1:])
    ):
        raise ValueError("source_timeline_invalid")
    inferred: list[dict] = []
    previous_index = -1
    for frame_index, image in frames:
        if len(inferred) >= max_frames:
            raise ValueError("pose_frame_limit")
        if (type(frame_index) is not int or frame_index <= previous_index
                or frame_index < 0 or frame_index >= len(manifest.frames)):
            raise ValueError("invalid_source_frame_index")
        source = manifest.frames[frame_index]
        row = adapter.infer(image, frame_index=frame_index, pts=source.pts,
                            time_base=manifest.time_base)
        if (type(row) is not dict or type(row.get("frame_index")) is not int
                or type(row.get("pts")) is not int
                or row["frame_index"] != frame_index or row["pts"] != source.pts):
            raise ValueError("adapter_evidence_mismatch")
        inferred.append(row)
        previous_index = frame_index
    if not inferred:
        raise ValueError("empty_pose_sequence")
    provenance = dict(adapter.provenance())
    provenance["transforms"] = [*provenance.get("transforms", []), *transforms]
    return PoseArtifact.model_validate({
        "pose_schema_version": "0.1.0",
        "asset_id": manifest.asset_id,
        "time_base": manifest.time_base,
        "coordinate_space": "display_pixels",
        "keypoint_schema": "coco17",
        "frames": inferred,
        "provenance": provenance,
        "validation_ref": None,
        "measurement_status": "research_only",
    }).model_dump(mode="json")


def prepare_pose_review(artifact: dict, *, seed_frame_index: int,
                        seed_detection_id: str) -> dict:
    """Produce selection and empty reference labels, never invented accuracy."""
    from tennis_backend.pose import PoseArtifact
    from tennis_backend.selection import select_target
    from tennis_backend.evaluation import make_annotation_template, evaluate_keypoints

    poses = PoseArtifact.model_validate(artifact).model_dump(mode="json")
    selection = select_target(poses, seed_frame_index=seed_frame_index,
                              seed_detection_id=seed_detection_id)
    annotations = make_annotation_template(poses, selection)
    evaluation = evaluate_keypoints(poses, annotations)
    if evaluation["status"] != "not_evaluated":
        raise ValueError("unreviewed_reference_cannot_establish_accuracy")
    return {"poses": poses, "selection": selection,
            "annotations": annotations, "evaluation": evaluation}


def write_pose_review(bundle: dict, output_dir: Path) -> dict[str, str]:
    """Write a new private research directory; checksums last mark completion."""
    if type(bundle) is not dict or set(bundle) != {
        "poses", "selection", "annotations", "evaluation"
    }:
        raise ValueError("invalid_pose_review_bundle")
    payloads = {
        name + ".json": (json.dumps(value, ensure_ascii=False, indent=2,
                                    allow_nan=False) + "\n").encode("utf-8")
        for name, value in bundle.items()
    }
    hashes = {name: hashlib.sha256(data).hexdigest()
              for name, data in payloads.items()}
    # Validate serialization before creating anything. A partial failed directory
    # intentionally lacks checksums.json and must never be published as complete.
    output_dir.mkdir(parents=True, exist_ok=False)
    for name, data in payloads.items():
        with (output_dir / name).open("xb") as stream:
            stream.write(data)
    with (output_dir / "checksums.json").open("x", encoding="utf-8") as stream:
        json.dump(hashes, stream, indent=2)
        stream.write("\n")
    return hashes

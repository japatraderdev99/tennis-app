"""Private local PNG -> unvalidated 2D body points. No video clocks or storage.

The PNG itself is the evidence: results bind its SHA256 and dimensions. IMAGE mode
does not fabricate source PTS. Filtering is only a drawing rule, not accuracy.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import struct
import sys

MAX_BYTES = 4 * 1024 * 1024
MAX_EDGE = 1280
NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear", "left_shoulder",
    "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
    "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
)
MP_INDICES = (0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)


def png_dimensions(data: bytes) -> tuple[int, int]:
    if not isinstance(data, bytes) or len(data) > MAX_BYTES:
        raise ValueError("image_too_large")
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[8:16] != b"\0\0\0\rIHDR":
        raise ValueError("invalid_png")
    width, height = struct.unpack(">II", data[16:24])
    if not 1 <= width <= MAX_EDGE or not 1 <= height <= MAX_EDGE:
        raise ValueError("invalid_dimensions")
    return width, height


def finite(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def visible_point(point: object, width: int, height: int) -> tuple[float | None, float | None]:
    x, y = getattr(point, "x", None), getattr(point, "y", None)
    visibility, presence = getattr(point, "visibility", None), getattr(point, "presence", None)
    if not all(finite(v) for v in (x, y, visibility, presence)):
        return None, None
    if not 0 <= x < 1 or not 0 <= y < 1 or not 0.5 <= visibility <= 1 or not 0.5 <= presence <= 1:
        return None, None
    return float(x) * width, float(y) * height


def make_result(data: bytes, poses: list, *, model_sha256: str, runtime: str) -> dict:
    width, height = png_dimensions(data)
    people = []
    for landmarks in poses[:4]:
        if len(landmarks) != 33:
            raise ValueError("invalid_model_output")
        keypoints = []
        for name, index in zip(NAMES, MP_INDICES):
            x, y = visible_point(landmarks[index], width, height)
            keypoints.append({"name": name, "x": x, "y": y})
        visible = [(p["x"], p["y"]) for p in keypoints if p["x"] is not None]
        if len(visible) < 2:
            continue
        x1, x2 = min(p[0] for p in visible), max(p[0] for p in visible)
        y1, y2 = min(p[1] for p in visible), max(p[1] for p in visible)
        if x1 >= x2 or y1 >= y2:
            continue
        people.append({"id": f"person-{len(people) + 1}", "bbox": {
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
        }, "keypoints": keypoints})
    return {
        "schema_version": "single-frame-pose/1", "scope": "single_image",
        "status": "estimated" if people else "no_person",
        "image_sha256": hashlib.sha256(data).hexdigest(), "width": width, "height": height,
        "model": {"name": "MediaPipe Pose Landmarker", "sha256": model_sha256, "runtime": runtime},
        "drawing_policy": "mediapipe-visible-v1", "validation": "not_validated", "people": people,
    }


def analyze(data: bytes, model: Path, expected_sha256: str) -> dict:
    width, height = png_dimensions(data)  # Guard memory allocation before native image decoding.
    if not model.is_file() or model.is_symlink() or model.stat().st_size > 100 * 1024 * 1024:
        raise ValueError("model_unavailable")
    with model.open("rb") as stream:
        model_bytes = stream.read(100 * 1024 * 1024 + 1)
    if len(model_bytes) > 100 * 1024 * 1024 or hashlib.sha256(model_bytes).hexdigest() != expected_sha256:
        raise ValueError("model_changed")
    import cv2
    import numpy as np
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    bgr = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if bgr is None or bgr.shape != (height, width, 3):
        raise ValueError("invalid_png")
    rgb = np.ascontiguousarray(bgr[:, :, ::-1])
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_buffer=model_bytes, delegate=python.BaseOptions.Delegate.CPU),
        running_mode=vision.RunningMode.IMAGE, num_poses=4,
        min_pose_detection_confidence=0.5, min_pose_presence_confidence=0.5,
        output_segmentation_masks=False,
    )
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        output = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    return make_result(data, output.pose_landmarks, model_sha256=expected_sha256,
                       runtime=f"mediapipe/{importlib.metadata.version('mediapipe')}; CPU; IMAGE")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--expected-sha256", required=True)
    args = parser.parse_args()
    try:
        data = sys.stdin.buffer.read(MAX_BYTES + 1)
        with contextlib.redirect_stdout(sys.stderr):
            result = analyze(data, Path(args.model), args.expected_sha256)
        sys.stdout.write(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return 0
    except Exception:
        # Native/library errors may contain private filenames. Never expose them.
        sys.stdout.write('{"error":{"code":"frame_analysis_failed"}}')
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

"""Local-only, lazy pose adapters. Inputs are already corrected display pixels.

Private factories return the backend bundles below for offline synthetic tests.
An adapter is sequential and belongs to one timeline; it is not thread safe.
"""
from __future__ import annotations

import copy
import hashlib
import importlib.metadata
import math
import os
import platform
import stat
from dataclasses import dataclass
from numbers import Real
from pathlib import Path
from typing import Any, Callable

from .models import BoundingBox, COCO17_NAMES, PoseFrame, PoseProvenance, parse_time_base

_ADAPTER_VERSION = "0.1.0"
_MP_TO_COCO = (0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)


@dataclass
class _MediaPipeBackend:
    landmarker: Any
    make_image: Callable
    runtime: dict[str, str]


@dataclass
class _RTMPoseBackend:
    detector: Any
    pose: Any
    make_image: Callable
    runtime: dict[str, str]


def _versions(*packages: str) -> dict[str, str]:
    return {"python": platform.python_version(), **{
        package: importlib.metadata.version(package) for package in packages
    }}


def _mediapipe_factory(path, *, mode, num_poses):
    try:
        import numpy as np
        import mediapipe as mp
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
    except ImportError as exc:
        raise ImportError("MediaPipeAdapter requires optional mediapipe and numpy dependencies") from exc
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(
            model_asset_path=str(path), delegate=python.BaseOptions.Delegate.CPU,
        ),
        running_mode=vision.RunningMode.VIDEO if mode == "video" else vision.RunningMode.IMAGE,
        num_poses=num_poses,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    runtime = {**_versions("mediapipe", "numpy"), "delegate": "CPU"}
    landmarker = vision.PoseLandmarker.create_from_options(options)

    def make_image(image_bgr):
        rgb = np.ascontiguousarray(np.asarray(image_bgr)[:, :, ::-1])
        return mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    return _MediaPipeBackend(landmarker, make_image, runtime)


def _rtmpose_factory(detector_path, pose_path, *, detector_input_size, pose_input_size):
    try:
        import numpy as np
        import cv2
        import onnxruntime as ort
        from rtmlib import YOLOX, RTMPose
    except ImportError as exc:
        raise ImportError(
            "RTMPoseAdapter requires optional rtmlib, numpy, opencv and onnxruntime dependencies"
        ) from exc
    ort.disable_telemetry_events()
    runtime = {**_versions("rtmlib", "numpy", "onnxruntime"), "opencv": cv2.__version__}
    # Validated absolute local files are always supplied; no model name/URL default.
    detector = YOLOX(
        onnx_model=str(detector_path), model_input_size=detector_input_size,
        backend="onnxruntime", device="cpu", nms_thr=0.45, score_thr=0.7,
    )
    pose = RTMPose(
        onnx_model=str(pose_path), model_input_size=pose_input_size,
        to_openpose=False, backend="onnxruntime", device="cpu",
    )
    runtime.update(
        detector_providers=",".join(detector.session.get_providers()),
        pose_providers=",".join(pose.session.get_providers()),
    )
    return _RTMPoseBackend(detector, pose, lambda image: np.ascontiguousarray(image), runtime)


def _local_weight(value, role):
    try:
        raw = os.fspath(value)
    except TypeError as exc:
        raise ValueError(f"{role} weights require a local regular file") from exc
    if not isinstance(raw, str) or "://" in raw or not raw.strip():
        raise ValueError(f"{role} weights require a local regular file, never a URL")
    try:
        path = Path(raw).resolve(strict=True)
        info = path.stat()
        if not stat.S_ISREG(info.st_mode):
            raise ValueError(f"{role} weights must be a local regular file")
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            before = os.fstat(stream.fileno())
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
            after = os.fstat(stream.fileno())
        signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
        if signature(info) != signature(before) or signature(before) != signature(after):
            raise ValueError(f"{role} weights changed during hashing")
    except OSError as exc:
        raise ValueError(f"{role} weights must be an accessible local regular file") from exc
    return path, {"role": role, "sha256": digest.hexdigest()}, signature(after)


def _check_weight_unchanged(path, signature):
    try:
        info = path.stat()
        current = (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
    except OSError as exc:
        raise ValueError("weights changed during runtime initialization") from exc
    if current != signature:
        raise ValueError("weights changed during runtime initialization")


def _image_dimensions(image):
    # Buffer validation is dependency free and also accepts NumPy uint8 arrays.
    try:
        view = memoryview(image)
    except (TypeError, ValueError) as exc:
        raise ValueError("image_bgr must be a uint8 HxWx3 image buffer") from exc
    if view.format != "B" or view.ndim != 3 or view.shape[2] != 3 or min(view.shape[:2]) <= 0:
        raise ValueError("image_bgr must be a nonempty uint8 HxWx3 image buffer")
    return view.shape[1], view.shape[0]


def _number(value, *, nullable=False):
    if value is None and nullable:
        return None
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError("model output must contain finite numbers or explicit nullable coordinates")
    try:
        result = float(value)
    except OverflowError as exc:
        raise ValueError("model output number exceeds finite range") from exc
    if not math.isfinite(result):
        raise ValueError("model output contains a nonfinite number")
    return result


def _probability(value):
    result = _number(value, nullable=True)
    if result is not None and not 0 <= result <= 1:
        raise ValueError("model visibility/presence must be in [0,1]")
    return result


def _sequence(value, label):
    # RTMLib emits NumPy arrays; convert numeric scalars without importing NumPy.
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, (tuple, list)):
        raise ValueError(f"{label} must be an array")
    return value


def _size(value, label):
    if type(value) is not tuple or len(value) != 2 or any(type(v) is not int or v <= 0 for v in value):
        raise ValueError(f"{label} must be a pair of positive integers")
    return value


class _Adapter:
    def _start(self, provenance):
        self._provenance = PoseProvenance.model_validate(provenance).model_dump(mode="json")
        self._previous = None
        self._closed = False

    def provenance(self) -> dict:
        return copy.deepcopy(self._provenance)

    def _input(self, image, frame_index, pts, time_base):
        if self._closed:
            raise RuntimeError("pose adapter is closed")
        if type(frame_index) is not int or frame_index < 0 or type(pts) is not int:
            raise ValueError("frame_index must be a nonnegative integer and pts an original integer")
        base = parse_time_base(time_base)
        width, height = _image_dimensions(image)
        if self._previous is not None:
            index, previous_pts, previous_base, dimensions = self._previous
            if frame_index <= index or pts <= previous_pts:
                raise ValueError("frame_index and original pts must strictly increase")
            if base != previous_base or (width, height) != dimensions:
                raise ValueError("an adapter requires one time_base and consistent display dimensions")
        frame = dict(frame_index=frame_index, pts=pts, display_width=width,
                     display_height=height, detections=[])
        return frame, base

    def _consume(self, frame, base):
        # Consume before native inference: a failed native call may advance a tracker.
        self._previous = (frame["frame_index"], frame["pts"], base,
                          (frame["display_width"], frame["display_height"]))

    def close(self):
        if self._closed:
            return
        self._closed = True
        backend, self._backend = self._backend, None
        # RTMLib/ORT have no close method; releasing backend refs releases sessions.
        resources = [backend.landmarker] if isinstance(backend, _MediaPipeBackend) else [backend.detector, backend.pose]
        error = None
        for resource in resources:
            try:
                closer = getattr(resource, "close", None)
                if closer is not None:
                    closer()
            except Exception as exc:
                # Attempt every close even if one native resource fails to close.
                if error is None:
                    error = exc
        if error is not None:
            raise error

    def __enter__(self):
        if self._closed:
            raise RuntimeError("pose adapter is closed")
        return self

    def __exit__(self, *_):
        self.close()


class MediaPipeAdapter(_Adapter):
    def __init__(self, model_path, *, mode="video", num_poses=2, _factory=None):
        if type(mode) is not str or mode not in ("video", "image"):
            raise ValueError("mode must be video or image")
        if type(num_poses) is not int or num_poses <= 0:
            raise ValueError("num_poses must be a positive integer")
        path, model_file, signature = _local_weight(model_path, "pose_landmarker")
        self._mode = mode
        self._num_poses = num_poses
        self._last_ms = None
        self._backend = (_factory or _mediapipe_factory)(path, mode=mode, num_poses=num_poses)
        self._closed = False
        try:
            _check_weight_unchanged(path, signature)
            self._start(dict(
                kind="model_inference", adapter="mediapipe", adapter_version=_ADAPTER_VERSION,
                model_files=[model_file], runtime=self._backend.runtime,
                parameters=dict(mode=mode, num_poses=num_poses,
                                min_pose_detection_confidence=0.5,
                                min_pose_presence_confidence=0.5, min_tracking_confidence=0.5,
                                coco17_source_indices=list(_MP_TO_COCO),
                                bbox_method="extent_of_all_finite_33_landmarks",
                                timestamp_rounding="nearest_millisecond_ties_to_even"),
                transforms=["bgr_to_rgb", "mediapipe_normalized_xy_to_display_pixels", "mediapipe33_to_coco17"],
            ))
        except Exception:
            self.close()
            raise

    def infer(self, image_bgr, *, frame_index, pts, time_base) -> dict:
        frame, base = self._input(image_bgr, frame_index, pts, time_base)
        timestamp_ms = round(pts * base * 1000)
        if self._mode == "video" and self._last_ms is not None and timestamp_ms <= self._last_ms:
            raise ValueError("MediaPipe VIDEO timestamp collision or backwards milliseconds")
        image = self._backend.make_image(image_bgr)
        self._consume(frame, base)
        if self._mode == "video":
            self._last_ms = timestamp_ms
            result = self._backend.landmarker.detect_for_video(image, timestamp_ms)
        else:
            result = self._backend.landmarker.detect(image)
        poses = _sequence(result.pose_landmarks, "MediaPipe poses")
        if len(poses) > self._num_poses:
            raise ValueError("MediaPipe returned more than num_poses")
        width, height = frame["display_width"], frame["display_height"]
        for detection_index, landmarks in enumerate(poses):
            landmarks = _sequence(landmarks, "MediaPipe landmarks")
            if len(landmarks) != 33:
                raise ValueError("MediaPipe must return exactly 33 landmarks per pose")
            points = []
            for point in landmarks:
                x, y = _number(point.x, nullable=True), _number(point.y, nullable=True)
                if (x is None) != (y is None):
                    raise ValueError("MediaPipe coordinates must be paired")
                points.append(dict(x=None if x is None else x * width,
                                   y=None if y is None else y * height,
                                   score=None, visibility=_probability(point.visibility),
                                   presence=_probability(point.presence)))
            finite_points = [p for p in points if p["x"] is not None]
            if not finite_points:
                raise ValueError("MediaPipe pose has no finite landmarks for bbox")
            bbox = dict(x1=min(p["x"] for p in finite_points), y1=min(p["y"] for p in finite_points),
                        x2=max(p["x"] for p in finite_points), y2=max(p["y"] for p in finite_points))
            frame["detections"].append(dict(
                detection_id=str(detection_index), bbox=bbox,
                keypoints=[dict(name=name, **points[index]) for name, index in zip(COCO17_NAMES, _MP_TO_COCO)],
            ))
        return PoseFrame.model_validate(frame).model_dump(mode="json")


class RTMPoseAdapter(_Adapter):
    def __init__(self, detector_path, pose_path, *, detector_input_size=(640, 640),
                 pose_input_size=(288, 384), _factory=None):
        detector_input_size = _size(detector_input_size, "detector_input_size")
        pose_input_size = _size(pose_input_size, "pose_input_size")
        detector_path, detector_file, detector_sig = _local_weight(detector_path, "detector")
        pose_path, pose_file, pose_sig = _local_weight(pose_path, "pose")
        self._backend = (_factory or _rtmpose_factory)(
            detector_path, pose_path, detector_input_size=detector_input_size, pose_input_size=pose_input_size,
        )
        self._closed = False
        try:
            _check_weight_unchanged(detector_path, detector_sig)
            _check_weight_unchanged(pose_path, pose_sig)
            self._start(dict(
                kind="model_inference", adapter="rtmpose", adapter_version=_ADAPTER_VERSION,
                model_files=[detector_file, pose_file], runtime=self._backend.runtime,
                parameters=dict(detector="YOLOX", detector_input_size=list(detector_input_size),
                                pose_input_size=list(pose_input_size), to_openpose=False,
                                backend="onnxruntime", device="cpu", nms_thr=0.45, score_thr=0.7,
                                keypoint_mapping="native_coco17", score_semantics="model_native_uncalibrated"),
                transforms=["rtmlib_detector_letterbox_and_pose_affine_to_display_pixels"],
            ))
        except Exception:
            self.close()
            raise

    def infer(self, image_bgr, *, frame_index, pts, time_base) -> dict:
        frame, base = self._input(image_bgr, frame_index, pts, time_base)
        image = self._backend.make_image(image_bgr)
        self._consume(frame, base)
        boxes = _sequence(self._backend.detector(image), "detector boxes")
        # Critical: RTMLib otherwise invents a full-image person crop for [].
        if not boxes:
            return PoseFrame.model_validate(frame).model_dump(mode="json")
        validated_boxes = []
        for box in boxes:
            box = _sequence(box, "detector bbox")
            if len(box) != 4:
                raise ValueError("detector bbox must have exactly four xyxy coordinates")
            values = [_number(v) for v in box]
            validated_boxes.append(BoundingBox.model_validate(dict(zip(("x1", "y1", "x2", "y2"), values))).model_dump())
        output = self._backend.pose(image, bboxes=boxes)
        if not isinstance(output, (tuple, list)) or len(output) != 2:
            raise ValueError("RTMPose output must contain keypoints and scores")
        poses, scores = (_sequence(v, "RTMPose output") for v in output)
        if len(poses) != len(boxes) or len(scores) != len(boxes):
            raise ValueError("RTMPose output count must match detector boxes")
        for index, (points, point_scores, bbox) in enumerate(zip(poses, scores, validated_boxes)):
            points, point_scores = _sequence(points, "keypoints"), _sequence(point_scores, "scores")
            if len(points) != 17 or len(point_scores) != 17:
                raise ValueError("RTMPose requires exactly 17 COCO keypoints and scores")
            keypoints = []
            for name, xy, score in zip(COCO17_NAMES, points, point_scores):
                xy = _sequence(xy, "keypoint xy")
                if len(xy) != 2:
                    raise ValueError("RTMPose keypoint needs exactly x and y")
                keypoints.append(dict(name=name, x=_number(xy[0], nullable=True),
                                      y=_number(xy[1], nullable=True), score=_number(score, nullable=True),
                                      visibility=None, presence=None))
            frame["detections"].append(dict(detection_id=str(index), bbox=bbox, keypoints=keypoints))
        return PoseFrame.model_validate(frame).model_dump(mode="json")

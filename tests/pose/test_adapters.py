import builtins
import copy
import hashlib
import json
import subprocess
import sys
from types import SimpleNamespace

import pytest

from tennis_backend.pose import COCO17_NAMES, MediaPipeAdapter, PoseFrame, RTMPoseAdapter
from tennis_backend.pose.adapters import _MP_TO_COCO


def mp(weights, backend, **kwargs):
    return MediaPipeAdapter(weights[1], _factory=lambda *a, **kw: backend, **kwargs)


def rtm(weights, backend, **kwargs):
    return RTMPoseAdapter(*weights, _factory=lambda *a, **kw: backend, **kwargs)


def infer(adapter, image, **kwargs):
    return adapter.infer(image, **dict(frame_index=0, pts=100, time_base="1/90000", **kwargs))


def test_base_import_does_not_load_optional_cv_modules():
    code = '''
import builtins, sys
original = builtins.__import__
def guarded(name, *args, **kwargs):
    if name.split('.')[0] in {'numpy', 'cv2', 'mediapipe', 'rtmlib', 'onnxruntime'}:
        raise AssertionError('optional import at base boundary: ' + name)
    return original(name, *args, **kwargs)
builtins.__import__ = guarded
from tennis_backend.pose import (PoseArtifact, PoseFrame, PoseDetection, Keypoint,
                                COCO17_NAMES, MediaPipeAdapter, RTMPoseAdapter)
assert len(COCO17_NAMES) == 17
'''
    subprocess.run([sys.executable, "-c", code], check=True, capture_output=True, timeout=15)


@pytest.mark.parametrize("adapter", ["mp", "rtm"])
def test_missing_optional_dependencies_fail_explicitly(weights, monkeypatch, adapter):
    original = builtins.__import__

    def missing(name, *args, **kwargs):
        if name.split(".")[0] in {"numpy", "mediapipe", "rtmlib", "onnxruntime"}:
            raise ModuleNotFoundError("synthetic missing optional dependency")
        return original(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", missing)
    with pytest.raises(ImportError, match="requires optional"):
        MediaPipeAdapter(weights[1]) if adapter == "mp" else RTMPoseAdapter(*weights)


@pytest.mark.parametrize("bad", ["https://invalid/weights.onnx", "file:///tmp/model", "", "missing.onnx", None])
@pytest.mark.parametrize("adapter", ["mp", "rtm"])
def test_rejects_remote_or_absent_weights_before_factory(weights, bad, adapter):
    def forbidden(*args, **kwargs):
        pytest.fail("factory must not be called for invalid weights")

    with pytest.raises(ValueError, match="local regular file"):
        if adapter == "mp":
            MediaPipeAdapter(bad, _factory=forbidden)
        else:
            RTMPoseAdapter(weights[0], bad, _factory=forbidden)


def test_rejects_directory_and_fifo_without_opening_them(tmp_path):
    import os
    fifo = tmp_path / "weights.pipe"
    os.mkfifo(fifo)
    for path in (tmp_path, fifo):
        with pytest.raises(ValueError, match="regular file"):
            MediaPipeAdapter(path, _factory=lambda *a, **kw: pytest.fail("invalid file"))


def test_hashes_local_weights_and_provenance_is_defensive(weights, mp_backend, rtm_backend):
    for adapter in (mp(weights, mp_backend), rtm(weights, rtm_backend)):
        provenance = adapter.provenance()
        hashes = [f["sha256"] for f in provenance["model_files"]]
        assert hashes == [hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in (weights[1:] if provenance["adapter"] == "mediapipe" else weights)]
        text = json.dumps(provenance, allow_nan=False)
        assert all(str(p) not in text for p in weights)
        assert "synthetic" in text
        provenance["parameters"]["mutated"] = True
        provenance["model_files"].clear()
        assert "mutated" not in adapter.provenance()["parameters"]
        assert adapter.provenance()["model_files"]
        adapter.close()
        assert adapter.provenance()["model_files"]


def test_factory_receives_local_resolved_paths_and_exact_constructor_options(weights, mp_backend, rtm_backend):
    calls = []

    def factory(*args, **kwargs):
        calls.append((args, kwargs))
        return mp_backend if len(args) == 1 else rtm_backend

    MediaPipeAdapter(weights[1], mode="image", num_poses=3, _factory=factory).close()
    RTMPoseAdapter(*weights, detector_input_size=(320, 320), pose_input_size=(192, 256), _factory=factory).close()
    assert calls == [((weights[1].resolve(),), dict(mode="image", num_poses=3)),
                     (tuple(p.resolve() for p in weights), dict(detector_input_size=(320, 320), pose_input_size=(192, 256)))]


def test_weights_changed_during_loading_closes_runtime(weights, mp_backend):
    def factory(*args, **kwargs):
        weights[1].write_bytes(b"changed synthetic weights")
        return mp_backend

    with pytest.raises(ValueError, match="weights changed"):
        MediaPipeAdapter(weights[1], _factory=factory)
    assert mp_backend.landmarker.closed == 1


def test_mediapipe_maps_all_people_without_clamping_or_score(weights, image, mp_backend, landmarks):
    landmarks[0].x, landmarks[0].y = -0.25, 1.5
    other = copy.deepcopy(landmarks)
    other[11].x = 1.25
    mp_backend.landmarker.result.pose_landmarks = [landmarks, other]
    adapter = mp(weights, mp_backend)
    frame = infer(adapter, image)
    assert PoseFrame.model_validate(frame)
    assert frame["pts"] == 100 and frame["frame_index"] == 0
    assert (frame["display_width"], frame["display_height"]) == (4, 3)
    assert len(frame["detections"]) == 2
    assert [d["detection_id"] for d in frame["detections"]] == ["0", "1"]
    assert mp_backend.landmarker.calls[0] == ("video", image, 1)
    for point, name, source_index in zip(frame["detections"][0]["keypoints"], COCO17_NAMES, _MP_TO_COCO):
        source = landmarks[source_index]
        assert point == dict(name=name, x=source.x * 4, y=source.y * 3,
                             score=None, visibility=0.3, presence=0.8)
    assert frame["detections"][0]["bbox"] == dict(x1=-1., y1=3 / 64, x2=4., y2=4.5)
    assert frame["detections"][1]["keypoints"][5]["x"] == 5.
    assert adapter.provenance()["parameters"]["mode"] == "video"
    assert adapter.provenance()["parameters"]["coco17_source_indices"] == list(_MP_TO_COCO)


def test_video_collision_fails_before_native_call_preserves_original_time(weights, image, mp_backend):
    adapter = mp(weights, mp_backend)
    first = adapter.infer(image, frame_index=10, pts=90000, time_base="1/90000")
    assert first["pts"] == 90000 and first["frame_index"] == 10
    with pytest.raises(ValueError, match="collision"):
        adapter.infer(image, frame_index=11, pts=90001, time_base="1/90000")
    assert len(mp_backend.landmarker.calls) == 1
    second = adapter.infer(image, frame_index=14, pts=90100, time_base="1/90000")
    assert second["pts"] == 90100 and second["frame_index"] == 14
    assert mp_backend.landmarker.calls[-1][-1] == 1001


def test_exact_fraction_rounding_at_half_millisecond(weights, image, mp_backend):
    adapter = mp(weights, mp_backend)
    adapter.infer(image, frame_index=0, pts=1, time_base="1/2000")
    adapter.infer(image, frame_index=1, pts=3, time_base="1/2000")
    assert [call[-1] for call in mp_backend.landmarker.calls] == [0, 2]


def test_image_mode_allows_sparse_samples_with_same_api_millisecond(weights, image, mp_backend):
    adapter = mp(weights, mp_backend, mode="image")
    adapter.infer(image, frame_index=5, pts=-2, time_base="1/90000")
    adapter.infer(image, frame_index=99, pts=2, time_base="1/90000")
    assert [call[0] for call in mp_backend.landmarker.calls] == ["image", "image"]


@pytest.mark.parametrize("kind", ["mp", "rtm"])
def test_empty_detections_is_an_observed_failure(weights, image, mp_backend, rtm_backend, kind):
    adapter = mp(weights, mp_backend) if kind == "mp" else rtm(weights, rtm_backend)
    assert infer(adapter, image)["detections"] == []
    if kind == "rtm":
        assert rtm_backend.detector.calls == 1
        assert rtm_backend.pose.calls == []


def test_rtmpose_uses_detector_boxes_and_retains_native_scores(weights, image, rtm_backend):
    rtm_backend.detector.boxes = [[-10., -20., 8., 7.], [1., 2., 50., 80.]]
    adapter = rtm(weights, rtm_backend)
    frame = infer(adapter, image)
    assert len(frame["detections"]) == 2
    assert rtm_backend.pose.calls == [rtm_backend.detector.boxes]
    assert frame["detections"][0]["bbox"]["x1"] == -10.
    assert frame["detections"][0]["keypoints"][0] == dict(
        name="nose", x=0., y=0., score=1.4, visibility=None, presence=None)
    assert frame["detections"][1]["keypoints"][-1]["score"] < 0


@pytest.mark.parametrize("bad_box", [[0, 0, 0, 1], [0, 0, 1], [0, 0, float("nan"), 1], [True, 0, 1, 1]])
def test_invalid_detector_boxes_never_reach_pose(weights, image, rtm_backend, bad_box):
    rtm_backend.detector.boxes = [bad_box]
    with pytest.raises(ValueError):
        infer(rtm(weights, rtm_backend), image)
    assert rtm_backend.pose.calls == []


@pytest.mark.parametrize("kind", ["mp", "rtm"])
@pytest.mark.parametrize("field,value", [("frame_index", True), ("frame_index", -1), ("pts", 1.),
                                         ("pts", False), ("time_base", "1/0"), ("time_base", "-1/90"),
                                         ("time_base", "0.04"), ("time_base", 0.04)])
def test_invalid_infer_inputs_do_not_run_native_code(weights, image, mp_backend, rtm_backend, kind, field, value):
    adapter = mp(weights, mp_backend) if kind == "mp" else rtm(weights, rtm_backend)
    kwargs = dict(frame_index=0, pts=1, time_base="1/90000")
    kwargs[field] = value
    with pytest.raises(ValueError):
        adapter.infer(image, **kwargs)
    assert mp_backend.landmarker.calls == [] and rtm_backend.detector.calls == 0


@pytest.mark.parametrize("kind", ["mp", "rtm"])
@pytest.mark.parametrize("bad_image", [None, [[[0, 1, 2]]], b"abc", memoryview(b"abc"),
                                        memoryview(bytearray(4)).cast("B", shape=(2, 2)),
                                        memoryview(bytearray(8)).cast("B", shape=(2, 2, 2)),
                                        memoryview(bytearray(24)).cast("f", shape=(1, 2, 3))])
def test_image_type_shape_and_dtype_are_checked(weights, mp_backend, rtm_backend, kind, bad_image):
    adapter = mp(weights, mp_backend) if kind == "mp" else rtm(weights, rtm_backend)
    with pytest.raises(ValueError, match="image_bgr"):
        infer(adapter, bad_image)
    assert mp_backend.landmarker.calls == [] and rtm_backend.detector.calls == 0


@pytest.mark.parametrize("kind", ["mp", "rtm"])
@pytest.mark.parametrize("change", ["pts", "index", "base", "dimensions"])
def test_adapter_rejects_time_regression_and_changed_timeline(weights, image, mp_backend, rtm_backend, kind, change):
    adapter = mp(weights, mp_backend) if kind == "mp" else rtm(weights, rtm_backend)
    infer(adapter, image)
    kwargs = dict(frame_index=1, pts=200, time_base="1/90000")
    if change == "pts":
        kwargs["pts"] = 99
    elif change == "index":
        kwargs["frame_index"] = 0
    elif change == "base":
        kwargs["time_base"] = "1/1000"
    else:
        image = memoryview(bytearray(18)).cast("B", shape=(2, 3, 3))
    with pytest.raises(ValueError):
        adapter.infer(image, **kwargs)


@pytest.mark.parametrize("kind", ["mp", "rtm"])
def test_close_is_idempotent_context_managed_and_final(weights, image, mp_backend, rtm_backend, kind):
    adapter = mp(weights, mp_backend) if kind == "mp" else rtm(weights, rtm_backend)
    with adapter:
        infer(adapter, image)
    adapter.close()
    with pytest.raises(RuntimeError, match="closed"):
        adapter.infer(image, frame_index=1, pts=200, time_base="1/90000")
    with pytest.raises(RuntimeError, match="closed"):
        adapter.__enter__()
    if kind == "mp":
        assert mp_backend.landmarker.closed == 1
    else:
        assert rtm_backend.detector.closed == rtm_backend.pose.closed == 1
    assert adapter._backend is None


@pytest.mark.parametrize("mode,num_poses", [("VIDEO", 2), (False, 2), ("video", True), ("video", 0), ("video", 1.)])
def test_mediapipe_constructor_options_are_strict(weights, mp_backend, mode, num_poses):
    with pytest.raises(ValueError):
        mp(weights, mp_backend, mode=mode, num_poses=num_poses)


@pytest.mark.parametrize("size", [(0, 640), (True, 640), (640., 640), [640, 640], (640,)])
def test_rtmpose_constructor_sizes_are_strict(weights, rtm_backend, size):
    with pytest.raises(ValueError):
        rtm(weights, rtm_backend, detector_input_size=size)


@pytest.mark.parametrize("failure", ["degenerate", "count", "nan", "bool", "probability", "paired", "no_finite"])
def test_invalid_mediapipe_output_fails_explicitly(weights, image, mp_backend, landmarks, failure):
    if failure == "degenerate":
        for point in landmarks:
            point.x = point.y = 0.5
    elif failure == "count":
        landmarks.pop()
    elif failure == "nan":
        landmarks[0].x = float("nan")
    elif failure == "bool":
        landmarks[0].x = True
    elif failure == "probability":
        landmarks[0].visibility = 1.1
    elif failure == "paired":
        landmarks[0].x = None
    else:
        for point in landmarks:
            point.x = point.y = None
    mp_backend.landmarker.result.pose_landmarks = [landmarks]
    with pytest.raises(ValueError):
        infer(mp(weights, mp_backend), image)


@pytest.mark.parametrize("failure", ["count", "points", "scores", "nan", "bool", "paired", "xy_shape", "output_shape"])
def test_invalid_rtmpose_output_fails_explicitly(weights, image, rtm_backend, failure):
    rtm_backend.detector.boxes = [[0, 0, 1, 1]]
    points, scores = [[[1., 2.] for _ in range(17)]], [[1.5] * 17]
    if failure == "count":
        points.clear()
    elif failure == "points":
        points[0].pop()
    elif failure == "scores":
        scores[0].pop()
    elif failure == "nan":
        scores[0][0] = float("nan")
    elif failure == "bool":
        scores[0][0] = True
    elif failure == "paired":
        points[0][0][0] = None
    elif failure == "xy_shape":
        points[0][0].append(3.)
    rtm_backend.pose.output = (points, scores) if failure != "output_shape" else (points,)
    with pytest.raises(ValueError):
        infer(rtm(weights, rtm_backend), image)


def test_visibility_is_validated_even_on_unmapped_mediapipe_landmark(weights, image, mp_backend, landmarks):
    assert 1 not in _MP_TO_COCO
    landmarks[1].presence = -0.1
    mp_backend.landmarker.result.pose_landmarks = [landmarks]
    with pytest.raises(ValueError, match="visibility/presence"):
        infer(mp(weights, mp_backend), image)


def test_null_points_are_preserved_in_both_adapters(weights, image, mp_backend, rtm_backend, landmarks):
    landmarks[0].x = landmarks[0].y = None
    landmarks[0].visibility = landmarks[0].presence = None
    mp_backend.landmarker.result.pose_landmarks = [landmarks]
    mp_point = infer(mp(weights, mp_backend), image)["detections"][0]["keypoints"][0]
    assert mp_point == dict(name="nose", x=None, y=None, score=None, visibility=None, presence=None)
    rtm_backend.detector.boxes = [[0, 0, 1, 1]]
    rtm_backend.pose.output = ([[[None, None]] + [[1., 2.]] * 16], [[None] + [1.] * 16])
    rtm_point = infer(rtm(weights, rtm_backend), image)["detections"][0]["keypoints"][0]
    assert rtm_point == mp_point


def test_native_failure_consumes_tracker_timestamp_and_context_still_closes(weights, image, mp_backend):
    def broken(image, timestamp_ms):
        raise RuntimeError("synthetic native failure")

    mp_backend.landmarker.detect_for_video = broken
    adapter = mp(weights, mp_backend)
    with pytest.raises(RuntimeError, match="synthetic native failure"):
        infer(adapter, image)
    with pytest.raises(ValueError, match="strictly increase"):
        infer(adapter, image)
    adapter.close()
    assert mp_backend.landmarker.closed == 1


def test_close_releases_all_resources_even_when_one_close_fails(weights, rtm_backend):
    adapter = rtm(weights, rtm_backend)

    def broken():
        raise RuntimeError("synthetic close failure")

    rtm_backend.detector.close = broken
    with pytest.raises(RuntimeError, match="close failure"):
        adapter.close()
    assert rtm_backend.pose.closed == 1
    assert adapter._backend is None
    adapter.close()


def test_array_outputs_convert_to_plain_finite_json(weights, image, rtm_backend):
    class Array:
        def __init__(self, values):
            self.values = values

        def tolist(self):
            return copy.deepcopy(self.values)

    rtm_backend.detector.boxes = Array([[0., 0., 2., 3.]])
    rtm_backend.pose.output = (Array([[[1., 2.]] * 17]), Array([[1.5] * 17]))
    frame = infer(rtm(weights, rtm_backend), image)
    assert json.loads(json.dumps(frame, allow_nan=False)) == frame
    assert len(frame["detections"]) == 1

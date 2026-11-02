"""Check the optional API boundary with synthetic module doubles, never models."""
import sys
from types import SimpleNamespace

from tennis_backend.pose import MediaPipeAdapter, RTMPoseAdapter
from tennis_backend.pose import adapters


def test_default_mediapipe_factory_wires_cpu_options_rgb_and_video_api(weights, image, monkeypatch, mp_backend):
    calls = {}

    class Array:
        def __init__(self, data):
            self.data = data

        def __getitem__(self, slices):
            assert slices == (slice(None), slice(None), slice(None, None, -1))
            return [[list(reversed(pixel)) for pixel in row] for row in self.data]

    np = SimpleNamespace(asarray=lambda buffer: Array(buffer.tolist()), ascontiguousarray=lambda value: value)

    class BaseOptions:
        Delegate = SimpleNamespace(CPU="CPU")

        def __init__(self, **kwargs):
            calls["base_options"] = kwargs

    def options(**kwargs):
        calls["options"] = kwargs
        return kwargs

    def create(options):
        calls["create"] = options
        return mp_backend.landmarker

    def make_image(**kwargs):
        calls["image"] = kwargs
        return "synthetic_mp_image"

    vision = SimpleNamespace(
        PoseLandmarkerOptions=options, PoseLandmarker=SimpleNamespace(create_from_options=create),
        RunningMode=SimpleNamespace(VIDEO="VIDEO", IMAGE="IMAGE"),
    )
    python = SimpleNamespace(BaseOptions=BaseOptions, vision=vision)
    monkeypatch.setitem(sys.modules, "numpy", np)
    monkeypatch.setitem(sys.modules, "mediapipe", SimpleNamespace(Image=make_image, ImageFormat=SimpleNamespace(SRGB="SRGB")))
    monkeypatch.setitem(sys.modules, "mediapipe.tasks", SimpleNamespace(python=python))
    monkeypatch.setitem(sys.modules, "mediapipe.tasks.python", python)
    monkeypatch.setattr(adapters.importlib.metadata, "version", lambda name: "synthetic-version")
    with MediaPipeAdapter(weights[1]) as adapter:
        result = adapter.infer(image, frame_index=12, pts=90000, time_base="1/90000")
        assert result["detections"] == []
        assert adapter.provenance()["runtime"]["delegate"] == "CPU"
    assert calls["base_options"] == dict(model_asset_path=str(weights[1].resolve()), delegate="CPU")
    assert calls["options"]["running_mode"] == "VIDEO"
    assert calls["options"]["num_poses"] == 2
    assert calls["options"]["min_tracking_confidence"] == 0.5
    assert calls["image"]["image_format"] == "SRGB"
    assert calls["image"]["data"][0][0] == [2, 1, 0]
    assert mp_backend.landmarker.calls == [("video", "synthetic_mp_image", 1000)]
    assert mp_backend.landmarker.closed == 1


def test_default_rtmlib_factory_wires_only_local_weights_and_coco17(weights, image, monkeypatch, rtm_backend):
    calls = {}
    rtm_backend.detector.session = SimpleNamespace(get_providers=lambda: ["CPUExecutionProvider"])
    rtm_backend.pose.session = SimpleNamespace(get_providers=lambda: ["CPUExecutionProvider"])
    rtm_backend.detector.boxes = [[0., 0., 4., 3.]]

    def detector(**kwargs):
        calls["detector"] = kwargs
        return rtm_backend.detector

    def pose(**kwargs):
        calls["pose"] = kwargs
        return rtm_backend.pose

    def disable():
        calls["telemetry_disabled"] = True

    monkeypatch.setitem(sys.modules, "numpy", SimpleNamespace(ascontiguousarray=lambda image: image))
    monkeypatch.setitem(sys.modules, "cv2", SimpleNamespace(__version__="synthetic-opencv"))
    monkeypatch.setitem(sys.modules, "onnxruntime", SimpleNamespace(disable_telemetry_events=disable))
    monkeypatch.setitem(sys.modules, "rtmlib", SimpleNamespace(YOLOX=detector, RTMPose=pose))
    monkeypatch.setattr(adapters.importlib.metadata, "version", lambda name: "synthetic-version")
    with RTMPoseAdapter(*weights) as adapter:
        result = adapter.infer(image, frame_index=12, pts=-9, time_base="1/90000")
        assert len(result["detections"]) == 1
        assert adapter.provenance()["runtime"]["pose_providers"] == "CPUExecutionProvider"
        assert adapter.provenance()["runtime"]["opencv"] == "synthetic-opencv"
    assert calls == dict(
        telemetry_disabled=True,
        detector=dict(onnx_model=str(weights[0].resolve()), model_input_size=(640, 640),
                      backend="onnxruntime", device="cpu", nms_thr=0.45, score_thr=0.7),
        pose=dict(onnx_model=str(weights[1].resolve()), model_input_size=(288, 384),
                  to_openpose=False, backend="onnxruntime", device="cpu"),
    )
    assert rtm_backend.pose.calls == [rtm_backend.detector.boxes]
    assert rtm_backend.detector.closed == rtm_backend.pose.closed == 1

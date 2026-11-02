import copy
from types import SimpleNamespace

import pytest

from tennis_backend.pose import COCO17_NAMES
from tennis_backend.pose.adapters import _MediaPipeBackend, _RTMPoseBackend


@pytest.fixture
def image():
    # Real PEP-3118 uint8 HWC buffer; no optional array package needed.
    return memoryview(bytearray(range(36))).cast("B", shape=(3, 4, 3))


@pytest.fixture
def weights(tmp_path):
    detector, pose = tmp_path / "local detector.onnx", tmp_path / "local pose.task"
    detector.write_bytes(b"synthetic detector, not a model")
    pose.write_bytes(b"synthetic pose, not a model")
    return detector, pose


@pytest.fixture
def mp_backend():
    class Landmarker:
        def __init__(self):
            self.result = SimpleNamespace(pose_landmarks=[])
            self.calls = []
            self.closed = 0

        def detect_for_video(self, image, timestamp_ms):
            self.calls.append(("video", image, timestamp_ms))
            return self.result

        def detect(self, image):
            self.calls.append(("image", image))
            return self.result

        def close(self):
            self.closed += 1

    return _MediaPipeBackend(Landmarker(), lambda image: image, {"test_runtime": "synthetic"})


def mp_landmarks():
    return [SimpleNamespace(x=i / 32, y=i / 64, visibility=0.3, presence=0.8) for i in range(33)]


@pytest.fixture
def landmarks():
    return mp_landmarks()


@pytest.fixture
def rtm_backend():
    class Detector:
        def __init__(self):
            self.boxes = []
            self.calls = 0
            self.closed = 0

        def __call__(self, image):
            self.calls += 1
            return copy.deepcopy(self.boxes)

        def close(self):
            self.closed += 1

    class Pose:
        def __init__(self):
            self.calls = []
            self.output = None
            self.closed = 0

        def __call__(self, image, *, bboxes):
            self.calls.append(copy.deepcopy(bboxes))
            if self.output is not None:
                return self.output
            return ([[[i * 2., i * 3.] for i in range(17)] for _ in bboxes],
                    [[1.4 - i / 10 for i in range(17)] for _ in bboxes])

        def close(self):
            self.closed += 1

    return _RTMPoseBackend(Detector(), Pose(), lambda image: image, {"test_runtime": "synthetic"})


@pytest.fixture
def frame():
    return dict(frame_index=7, pts=-40, display_width=640, display_height=360, detections=[dict(
        detection_id="person-0", bbox=dict(x1=-20., y1=1., x2=180., y2=400.),
        keypoints=[dict(name=name, x=float(i), y=float(i + 1), score=1.5,
                        visibility=None, presence=None) for i, name in enumerate(COCO17_NAMES)],
    )])


@pytest.fixture
def artifact(frame):
    return dict(
        pose_schema_version="0.1.0", asset_id="sha256:" + "a" * 64, time_base="1/90000",
        coordinate_space="display_pixels", keypoint_schema="coco17", frames=[frame],
        provenance=dict(kind="model_inference", adapter="rtmpose", adapter_version="0.1.0",
                        model_files=[dict(role="pose", sha256="b" * 64)],
                        runtime={"test_runtime": "synthetic"}, parameters={"nested": [None, 4., True]},
                        transforms=[]), validation_ref=None, measurement_status="research_only",
    )

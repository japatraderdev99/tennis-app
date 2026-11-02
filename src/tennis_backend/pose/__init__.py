"""Optional local pose inference for unvalidated, image-plane research only.

Importing this package requires no NumPy, MediaPipe, RTMLib, OpenCV or ONNX runtime.
"""
from .models import COCO17_NAMES, Keypoint, PoseArtifact, PoseDetection, PoseFrame
from .adapters import MediaPipeAdapter, RTMPoseAdapter

__all__ = [
    "PoseArtifact", "PoseFrame", "PoseDetection", "Keypoint", "COCO17_NAMES",
    "MediaPipeAdapter", "RTMPoseAdapter",
]

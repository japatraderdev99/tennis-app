import shutil
import subprocess

import pytest


@pytest.fixture
def make_video(tmp_path):
    """Only temporary, synthetic frames; no original/user media is opened."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg or not shutil.which("ffprobe"):
        pytest.skip("FFmpeg and FFprobe are required for synthetic media tests")

    def make(name="tiny video.mp4", *, extra=(), codec="mpeg4", source=None):
        path = tmp_path / name
        command = [ffmpeg, "-v", "error", "-nostdin", "-f", "lavfi", "-i",
                   source or "testsrc2=size=32x24:rate=10:duration=0.6",
                   "-an", "-c:v", codec, *extra, "-y", str(path)]
        subprocess.run(command, check=True, capture_output=True, timeout=15)
        return path

    return make

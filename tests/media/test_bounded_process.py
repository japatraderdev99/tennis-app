"""Exercise real child processes to prove limits apply before their exit."""

import os
import sys
import time
from dataclasses import replace
from fractions import Fraction

import pytest

from tennis_backend.media import MediaError, MediaLimits
from tennis_backend.media import _inspect


@pytest.mark.parametrize("pipe", ["stdout", "stderr"])
def test_output_is_bounded_during_live_child_and_child_is_reaped(tmp_path, monkeypatch, pipe):
    path = tmp_path / "fd"
    path.write_bytes(b"x")
    fd = os.open(path, os.O_RDONLY)
    children = []
    popen = _inspect.subprocess.Popen

    def observe(*args, **kwargs):
        assert kwargs["shell"] is False
        assert kwargs["stdin"] is _inspect.subprocess.DEVNULL
        child = popen(*args, **kwargs)
        children.append(child)
        return child

    monkeypatch.setattr(_inspect.subprocess, "Popen", observe)
    budget = _inspect._Budget(replace(MediaLimits(), max_output_bytes=1024, timeout_seconds=3))
    script = f"import sys,time; sys.{pipe}.buffer.write(b'x'*4096); sys.{pipe}.flush(); time.sleep(20)"
    start = time.monotonic()
    try:
        with pytest.raises(MediaError) as caught:
            _inspect._run([sys.executable, "-c", script], budget, fd)
        assert caught.value.code == "output_limit"
        assert budget.output == 1025  # read budget + one byte, never 4096 or EOF
        assert time.monotonic() - start < 3
        assert children[0].poll() is not None
    finally:
        os.close(fd)


def test_timeout_kills_and_reaps_a_silent_child(tmp_path, monkeypatch):
    path = tmp_path / "fd"
    path.write_bytes(b"x")
    fd = os.open(path, os.O_RDONLY)
    children = []
    popen = _inspect.subprocess.Popen

    def observe(*args, **kwargs):
        child = popen(*args, **kwargs)
        children.append(child)
        return child

    monkeypatch.setattr(_inspect.subprocess, "Popen", observe)
    budget = _inspect._Budget(replace(MediaLimits(), timeout_seconds=0.1))
    try:
        with pytest.raises(MediaError) as caught:
            _inspect._run([sys.executable, "-c", "import time; time.sleep(20)"], budget, fd)
        assert caught.value.code == "timeout"
        assert children[0].poll() is not None
    finally:
        os.close(fd)


def test_error_diagnostics_cannot_be_silently_accepted(tmp_path):
    path = tmp_path / "fd"
    path.write_bytes(b"x")
    fd = os.open(path, os.O_RDONLY)
    try:
        with pytest.raises(MediaError) as caught:
            _inspect._run([sys.executable, "-c", "import sys; sys.stderr.write('private decoder detail')"],
                          _inspect._Budget(MediaLimits()), fd)
        assert caught.value.code == "invalid_media"
        assert "decoder detail" not in str(caught.value.to_dict())
    finally:
        os.close(fd)


def test_frame_parser_never_uses_best_effort_or_fps():
    parser = _inspect._Frames(Fraction(1, 100), 2, _inspect._Budget(MediaLimits()))
    # Split through a line to exercise incremental streaming; unknown PTS stay null.
    parser.feed(b"frame|stream_index=2|pts=200\nframe|stream_index=2|pt")
    parser.feed(b"s=N/A\nframe|stream_index=2|pts=200\nframe|stream_index=2|pts=150")
    parser.finish()
    assert [f["pts"] for f in parser.frames] == [200, None, 200, 150]
    assert [f["time_seconds"] for f in parser.frames] == [2.0, None, 2.0, 1.5]
    assert parser.reasons == ["missing_pts", "nonmonotonic_pts"]


def test_frame_limit_is_applied_while_stdout_is_streaming(tmp_path):
    path = tmp_path / "fd"
    path.write_bytes(b"x")
    fd = os.open(path, os.O_RDONLY)
    budget = _inspect._Budget(replace(MediaLimits(), max_frames=1, timeout_seconds=3))
    parser = _inspect._Frames(Fraction(1, 10), 0, budget)
    script = "import sys,time; print('frame|stream_index=0|pts=0\\nframe|stream_index=0|pts=1',flush=True); time.sleep(20)"
    try:
        with pytest.raises(MediaError) as caught:
            _inspect._run([sys.executable, "-c", script], budget, fd, parser.feed)
        assert caught.value.code == "frame_limit"
        assert len(parser.frames) == 1
    finally:
        os.close(fd)


def test_observed_pts_span_enforces_duration_even_without_metadata():
    parser = _inspect._Frames(Fraction(1, 10), 0,
                             _inspect._Budget(replace(MediaLimits(), max_duration_seconds=0.2)))
    with pytest.raises(MediaError) as caught:
        parser.feed(b"frame|stream_index=0|pts=200\nframe|stream_index=0|pts=203\n")
    assert caught.value.code == "duration_limit"


def test_ambiguous_rotation_is_not_guessed():
    assert _inspect._rotation({"side_data_list": [{"rotation": 90}], "tags": {"rotate": "-90"}}) is None
    assert _inspect._rotation({"tags": {"rotate": "NaN"}}) is None
    assert _inspect._rotation({}) is None

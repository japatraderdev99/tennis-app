import hashlib
import json
import os
import struct
import subprocess
from dataclasses import replace
from fractions import Fraction

import pytest

from tennis_backend.media import MediaError, MediaLimits, inspect_media
from tennis_backend.media import _inspect


MANIFEST_FIELDS = {
    "schema_version", "asset_id", "sha256", "byte_size", "source_name", "stream_index",
    "codec_name", "coded_width", "coded_height", "sample_aspect_ratio", "rotation_degrees",
    "time_base", "duration_seconds", "nominal_fps", "average_fps", "frames", "quality_reasons",
    "timing_basis", "temporal_resolution", "tool",
}


def test_real_video_manifest_hash_and_preservation(make_video):
    path = make_video("name with spaces and 'quotes'.mp4")
    original = path.read_bytes()
    before = path.stat()
    result = inspect_media(path)
    after = path.stat()
    assert set(result) == MANIFEST_FIELDS
    assert result["schema_version"] == "0.1.0"
    assert result["sha256"] == hashlib.sha256(original).hexdigest()
    assert result["asset_id"] == "sha256:" + result["sha256"]
    assert result["byte_size"] == len(original)
    assert result["source_name"] == path.name
    assert result["stream_index"] == 0
    assert (result["coded_width"], result["coded_height"]) == (32, 24)
    assert result["sample_aspect_ratio"] == "1/1"
    assert result["rotation_degrees"] is None  # absence is not an inferred zero
    assert result["nominal_fps"] == result["average_fps"] == 10
    assert result["duration_seconds"] == pytest.approx(0.6)
    assert result["timing_basis"] == "original_pts"
    assert result["temporal_resolution"] == "not_established"
    assert result["tool"]["name"] == "ffprobe" and result["tool"]["version"]
    assert result["quality_reasons"] == []
    assert len(result["frames"]) == 6
    for i, frame in enumerate(result["frames"]):
        assert set(frame) == {"frame_index", "pts", "time_seconds"}
        assert frame["frame_index"] == i
        assert frame["time_seconds"] == float(frame["pts"] * Fraction(result["time_base"]))
    assert path.read_bytes() == original
    assert (before.st_size, before.st_ino, before.st_mtime_ns, before.st_ctime_ns) == (
        after.st_size, after.st_ino, after.st_mtime_ns, after.st_ctime_ns)
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize(("name", "codec"), [("tiny.mov", "mpeg4"), ("tiny.mkv", "ffv1"),
                                               ("tiny.avi", "mpeg4"), ("tiny.webm", "libvpx")])
def test_supported_self_contained_containers(make_video, name, codec):
    manifest = inspect_media(make_video(name, codec=codec))
    assert len(manifest["frames"]) == 6
    assert manifest["codec_name"]


def test_variable_intervals_and_nonzero_start_are_not_rebuilt_from_fps(make_video):
    path = make_video(extra=("-vf", r"select=eq(n\,0)+eq(n\,2)+eq(n\,5),setpts=PTS+2/TB",
                             "-fps_mode", "vfr"))
    result = inspect_media(path)
    seconds = [frame["time_seconds"] for frame in result["frames"]]
    assert seconds == pytest.approx([2.0, 2.2, 2.5])
    assert result["frames"][0]["pts"] != 0
    assert seconds[1] - seconds[0] != pytest.approx(seconds[2] - seconds[1])
    assert result["quality_reasons"] == []


def test_non_square_sample_aspect_ratio(make_video):
    result = inspect_media(make_video(extra=("-vf", "setsar=4/3")))
    assert result["sample_aspect_ratio"] == "4/3"
    assert (result["coded_width"], result["coded_height"]) == (32, 24)


def test_b_frames_stay_in_presentation_order(make_video):
    result = inspect_media(make_video(codec="libx264", extra=("-bf", "2")))
    timestamps = [frame["time_seconds"] for frame in result["frames"]]
    assert timestamps == pytest.approx([0, 0.1, 0.2, 0.3, 0.4, 0.5])
    assert result["quality_reasons"] == []


def test_first_video_selected_after_audio_and_other_videos_ignored(tmp_path):
    path = tmp_path / "multiple.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-nostdin",
                    "-f", "lavfi", "-i", "sine=duration=0.3",
                    "-f", "lavfi", "-i", "testsrc2=size=32x24:rate=10:duration=0.3",
                    "-f", "lavfi", "-i", "testsrc2=size=48x32:rate=10:duration=0.3",
                    "-map", "0:a", "-map", "1:v", "-map", "2:v", "-c:a", "aac", "-c:v", "mpeg4", str(path)],
                   check=True, capture_output=True, timeout=15)
    result = inspect_media(path)
    assert result["stream_index"] == 1
    assert (result["coded_width"], result["coded_height"]) == (32, 24)
    assert len(result["frames"]) == 3


def test_attached_picture_is_not_a_video_stream(tmp_path):
    path = tmp_path / "cover-only.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-nostdin",
                    "-f", "lavfi", "-i", "sine=duration=0.3",
                    "-f", "lavfi", "-i", "testsrc2=size=32x24:rate=10:duration=0.1",
                    "-map", "0:a", "-map", "1:v", "-c:a", "aac", "-c:v", "mjpeg",
                    "-frames:v", "1", "-disposition:v", "attached_pic", str(path)],
                   check=True, capture_output=True, timeout=15)
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "no_video_stream"


def test_native_command_restricts_protocols_demuxer_and_external_tracks(make_video, monkeypatch):
    path = make_video()
    popen = _inspect.subprocess.Popen
    commands = []

    def observe(args, **kwargs):
        commands.append(args)
        assert isinstance(args, list) and kwargs["shell"] is False
        return popen(args, **kwargs)

    monkeypatch.setattr(_inspect.subprocess, "Popen", observe)
    inspect_media(path)
    for args in commands[1:]:
        assert args[args.index("-protocol_whitelist") + 1] == "file"
        assert args[args.index("-format_whitelist") + 1] == "mov,matroska,webm,avi"
        assert args[args.index("-enable_drefs") + 1] == "0"
        assert args[args.index("-use_absolute_path") + 1] == "0"
        assert args[args.index("-f") + 1] == "mov"
        assert args[args.index("-i") + 1].startswith("/dev/fd/")
        assert "best_effort_timestamp" not in " ".join(args)
        assert str(path) not in args


def test_rotation_metadata_is_recorded_without_rotating_pixels(make_video, tmp_path):
    source = make_video()
    rotated = tmp_path / "rotation.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-display_rotation", "90",
                    "-i", str(source), "-c", "copy", str(rotated)],
                   check=True, capture_output=True, timeout=15)
    result = inspect_media(rotated)
    assert result["rotation_degrees"] in (90.0, -90.0)
    assert (result["coded_width"], result["coded_height"]) == (32, 24)


@pytest.mark.parametrize(("change", "code"), [
    ({"max_bytes": 1}, "byte_limit"),
    ({"max_duration_seconds": 0.1}, "duration_limit"),
    ({"max_frames": 2}, "frame_limit"),
    ({"max_output_bytes": 16}, "output_limit"),
    ({"timeout_seconds": 1e-9}, "timeout"),
])
def test_real_limits_never_return_truncated_success(make_video, change, code):
    path = make_video()
    original = path.read_bytes()
    with pytest.raises(MediaError) as caught:
        inspect_media(path, limits=replace(MediaLimits(), **change))
    assert caught.value.code == code
    assert path.read_bytes() == original


def test_exact_limits_are_inclusive(make_video):
    path = make_video()
    result = inspect_media(path, limits=replace(MediaLimits(), max_bytes=path.stat().st_size,
                                               max_frames=6, max_duration_seconds=0.6))
    assert len(result["frames"]) == 6


@pytest.mark.parametrize("data", [b"", b"not a video", b"\x00\x00\x00\x20ftypisom", b"\x1aE\xdf\xa3\xff"])
def test_corrupt_or_incomplete_files(tmp_path, data):
    path = tmp_path / "corrupt.mp4"
    path.write_bytes(data)
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code in {"invalid_media", "unsupported_container"}


def test_valid_container_header_but_corrupt_video_reaches_native_failure(tmp_path):
    path = tmp_path / "corrupt.avi"
    path.write_bytes(b"RIFF\x04\x00\x00\x00AVI ")
    with pytest.raises(MediaError, match="FFprobe") as caught:
        inspect_media(path)
    assert caught.value.code == "invalid_media"


def test_damaged_encoded_payload_is_not_a_short_success(make_video):
    path = make_video()
    data = bytearray(path.read_bytes())
    marker = data.index(b"mdat")
    length = int.from_bytes(data[marker - 4:marker], "big")
    data[marker + 4:marker - 4 + length] = b"\0" * (length - 8)
    path.write_bytes(data)
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code in {"invalid_media", "no_video_frames"}


@pytest.mark.parametrize("path", ["https://example.com/video.mp4", "file:/tmp/video.mp4",
                                "concat:first|second", "pipe:0", "data:video/mp4;base64,AA", "", "a\x00b"])
def test_protocol_paths_rejected_before_open(path, monkeypatch):
    def no_open(*args, **kwargs):
        pytest.fail("URL/protocol path must not be opened")
    monkeypatch.setattr(_inspect.os, "open", no_open)
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "invalid_path"


def test_playlists_rejected_even_with_video_extension(tmp_path, monkeypatch):
    path = tmp_path / "disguised.mp4"
    path.write_text("#EXTM3U\nhttps://example.com/video.ts\n")
    monkeypatch.setattr(_inspect.subprocess, "Popen", lambda *a, **kw: pytest.fail("native process started"))
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "unsupported_container"


def test_regular_files_only_no_symlink_or_fifo(tmp_path, make_video):
    source = make_video()
    link = tmp_path / "link.mp4"
    link.symlink_to(source)
    fifo = tmp_path / "pipe.mp4"
    os.mkfifo(fifo)
    for path in (tmp_path, link, fifo):
        with pytest.raises(MediaError):
            inspect_media(path)


def test_error_envelope_is_safe_and_exact(tmp_path):
    secret = tmp_path / "private-name.mp4"
    with pytest.raises(MediaError) as caught:
        inspect_media(secret)
    error = caught.value.to_dict()
    assert set(error) == {"schema_version", "code", "message", "retryable", "details"}
    assert error["schema_version"] == "0.1.0" and error["details"] == {}
    assert isinstance(error["retryable"], bool)
    assert str(secret) not in json.dumps(error)
    assert "private-name" not in json.dumps(error)


def test_mov_external_data_reference_rejected_before_native_process(make_video, monkeypatch):
    path = make_video()
    data = bytearray(path.read_bytes())
    # Generated FFmpeg URL entry is self-contained. Turn its flag to external.
    marker = data.index(b"url ")
    assert data[marker + 4:marker + 8] == b"\0\0\0\1"
    data[marker + 7] = 0
    path.write_bytes(data)
    monkeypatch.setattr(_inspect.subprocess, "Popen", lambda *a, **kw: pytest.fail("native process started"))
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "external_reference"


def test_reference_movie_rejected(tmp_path):
    path = tmp_path / "reference.mov"
    path.write_bytes(struct.pack(">I4sI4s", 16, b"moov", 8, b"rmra"))
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "external_reference"


def test_quicktime_empty_self_reference_preserves_source_timeline(make_video):
    path = make_video("self-reference.mov")
    expected = inspect_media(path)
    data = bytearray(path.read_bytes())
    marker = data.index(b"url ")
    data[marker:marker + 4] = b"alis"
    path.write_bytes(data)
    result = inspect_media(path)
    assert result["frames"] == expected["frames"]
    assert result["time_base"] == expected["time_base"]
    assert result["sha256"] == hashlib.sha256(data).hexdigest()
    assert path.read_bytes() == data


@pytest.mark.parametrize("kind,version,flags,payload", [
    (b"alis", 0, 0, b""),
    (b"alis", 0, 1, b"private-file.mov"),
    (b"alis", 0, 3, b""),
    (b"alis", 1, 1, b""),
    (b"url ", 1, 1, b""),
    (b"urn ", 0, 1, b""),
])
def test_unsupported_dref_never_reaches_native_decoder(tmp_path, monkeypatch,
                                                     kind, version, flags, payload):
    entry = (struct.pack(">I4sB", 12 + len(payload), kind, version)
             + flags.to_bytes(3, "big") + payload)
    dref = struct.pack(">I4sII", 16 + len(entry), b"dref", 0, 1) + entry
    path = tmp_path / "reference.mov"
    path.write_bytes(struct.pack(">I4s", 8 + len(dref), b"moov") + dref)
    monkeypatch.setattr(_inspect.subprocess, "Popen", lambda *a, **kw: pytest.fail("native process started"))
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "external_reference"


def test_matroska_external_segment_link_rejected(tmp_path):
    path = tmp_path / "linked.mkv"
    path.write_bytes(bytes.fromhex("1a45dfa38018538067891549a966843cb92380"))
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "external_reference"


@pytest.mark.parametrize("mutation", ["write", "replace", "delete"])
def test_change_during_inspection_is_rejected(make_video, monkeypatch, mutation):
    path = make_video()
    run = _inspect._run
    changed = False

    def mutate(*args, **kwargs):
        nonlocal changed
        result = run(*args, **kwargs)
        if not changed:
            changed = True
            if mutation == "write":
                with path.open("r+b") as file:
                    file.seek(-1, os.SEEK_END)
                    file.write(b"x")
            elif mutation == "replace":
                other = path.with_suffix(".replacement")
                other.write_bytes(path.read_bytes())
                other.replace(path)
            else:
                path.unlink()
        return result

    monkeypatch.setattr(_inspect, "_run", mutate)
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "file_changed"


@pytest.mark.parametrize("kwargs", [dict(max_bytes=True), dict(max_frames=0),
                                     dict(max_output_bytes=1.2), dict(timeout_seconds=float("nan")),
                                     dict(max_duration_seconds=float("inf")), dict(timeout_seconds=False)])
def test_limits_are_strict(kwargs):
    with pytest.raises(ValueError):
        MediaLimits(**kwargs)


def test_missing_ffprobe_is_explicit(make_video, monkeypatch):
    path = make_video()
    monkeypatch.setattr(_inspect.shutil, "which", lambda _: None)
    with pytest.raises(MediaError) as caught:
        inspect_media(path)
    assert caught.value.code == "tool_unavailable"

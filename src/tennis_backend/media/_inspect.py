"""Bounded FFprobe orchestration for the frozen v0.1 media interface."""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import selectors
import shutil
import stat
import subprocess
import time
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Callable

from ._containers import container_format
from ._errors import MediaError


@dataclass(frozen=True)
class MediaLimits:
    """Technical ceilings; no scientific eligibility is implied.

    Output budget includes stdout AND stderr across all FFprobe invocations.
    Timeout covers opening, hashing, container checks and native subprocesses.
    """

    max_bytes: int = 512 * 1024 * 1024
    max_duration_seconds: float = 600.0
    max_frames: int = 36_000
    timeout_seconds: float = 30.0
    max_output_bytes: int = 8 * 1024 * 1024

    def __post_init__(self) -> None:
        for name in ("max_bytes", "max_frames", "max_output_bytes"):
            value = getattr(self, name)
            if type(value) is not int or value <= 0:
                raise ValueError(f"{name} must be a positive integer")
        for name in ("max_duration_seconds", "timeout_seconds"):
            value = getattr(self, name)
            if type(value) not in (int, float) or not math.isfinite(value) or value <= 0:
                raise ValueError(f"{name} must be finite and positive")


class _Budget:
    def __init__(self, limits: MediaLimits):
        self.limits = limits
        self.deadline = time.monotonic() + limits.timeout_seconds
        self.output = 0

    def check(self) -> None:
        if time.monotonic() >= self.deadline:
            raise MediaError("timeout", "Media inspection exceeded its time limit.", retryable=True)

    def consume(self, count: int) -> None:
        self.output += count
        if self.output > self.limits.max_output_bytes:
            raise MediaError("output_limit", "Media inspection exceeded its output limit.")


def _run(args: list[str], budget: _Budget, fd: int, on_chunk: Callable[[bytes], None] | None = None) -> bytes:
    """Drain both pipes concurrently with bounded reads, kill/reap on every exit.

    Do not use communicate/capture_output: limits apply before storing output.
    stderr shares the byte budget and is discarded, never exposed in errors.
    """
    budget.check()
    try:
        proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, pass_fds=(fd,), shell=False)
    except OSError:
        raise MediaError("tool_unavailable", "FFprobe could not be started.", retryable=True) from None
    output = bytearray()
    had_stderr = False
    try:
        with selectors.DefaultSelector() as selector:
            for pipe in (proc.stdout, proc.stderr):
                os.set_blocking(pipe.fileno(), False)
                selector.register(pipe, selectors.EVENT_READ)
            while selector.get_map():
                budget.check()
                events = selector.select(min(0.05, max(0, budget.deadline - time.monotonic())))
                for key, _ in events:
                    chunk = os.read(key.fd, min(65_536, budget.limits.max_output_bytes - budget.output + 1))
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    budget.consume(len(chunk))
                    if key.fileobj is proc.stdout:
                        if on_chunk is None:
                            output.extend(chunk)
                        else:
                            on_chunk(chunk)
                    else:
                        had_stderr = True
            while proc.poll() is None:
                budget.check()
                try:
                    proc.wait(timeout=min(0.05, max(0.001, budget.deadline - time.monotonic())))
                except subprocess.TimeoutExpired:
                    pass
        if proc.returncode or had_stderr:
            raise MediaError("invalid_media", "FFprobe could not inspect the media.")
        return bytes(output)
    finally:
        if proc.poll() is None:
            proc.kill()
        proc.wait()
        proc.stdout.close()
        proc.stderr.close()


def _fingerprint(info: os.stat_result) -> tuple:
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def _ratio(value: object, *, positive: bool = False) -> Fraction | None:
    if not isinstance(value, str) or not re.fullmatch(r"-?\d+[/:]-?\d+", value):
        return None
    try:
        ratio = Fraction(value.replace(":", "/"))
    except (ValueError, ZeroDivisionError):
        return None
    return None if positive and ratio <= 0 else ratio


def _ratio_text(value: Fraction | None) -> str | None:
    return None if value is None else f"{value.numerator}/{value.denominator}"


def _number(value: object, *, positive: bool = False) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return None
    try:
        number = float(value)
    except ValueError:
        return None
    if not math.isfinite(number) or number < 0 or (positive and number == 0):
        return None
    return number


def _rotation(stream: dict) -> float | None:
    candidates = []
    for side in stream.get("side_data_list", []):
        if "rotation" in side:
            candidates.append(side["rotation"])
    if "rotate" in stream.get("tags", {}):
        candidates.append(stream["tags"]["rotate"])
    values = []
    for item in candidates:
        try:
            number = float(item)
        except (ValueError, TypeError):
            return None
        if not math.isfinite(number):
            return None
        values.append(number)
    if not values or any(value != values[0] for value in values):
        return None
    return values[0]


class _Frames:
    def __init__(self, time_base: Fraction, stream_index: int, budget: _Budget):
        self.time_base, self.stream_index, self.budget = time_base, stream_index, budget
        self.pending = b""
        self.frames: list[dict] = []
        self.reasons: list[str] = []
        self.previous: int | None = None
        self.lowest: int | None = None
        self.highest: int | None = None

    def add_reason(self, reason: str) -> None:
        if reason not in self.reasons:
            self.reasons.append(reason)

    def feed(self, chunk: bytes) -> None:
        self.pending += chunk
        while b"\n" in self.pending:
            line, self.pending = self.pending.split(b"\n", 1)
            self.line(line)

    def finish(self) -> None:
        if self.pending:
            self.line(self.pending)
            self.pending = b""
        if not self.frames:
            raise MediaError("no_video_frames", "No decodable video frames were found.")

    def line(self, line: bytes) -> None:
        self.budget.check()
        if not line.strip():
            return
        try:
            fields = line.decode("ascii").split("|")
            if fields[0] != "frame":
                raise ValueError
            pairs = dict(field.split("=", 1) for field in fields[1:] if field)
            if int(pairs["stream_index"]) != self.stream_index:
                raise ValueError
            raw = pairs.get("pts", "N/A")
            pts = None if raw == "N/A" else int(raw)
        except (ValueError, KeyError, UnicodeDecodeError):
            raise MediaError("invalid_tool_output", "FFprobe returned invalid frame metadata.") from None
        if len(self.frames) >= self.budget.limits.max_frames:
            raise MediaError("frame_limit", "Media inspection exceeded its frame limit.")
        seconds = float(pts * self.time_base) if pts is not None else None
        if seconds is not None and not math.isfinite(seconds):
            raise MediaError("invalid_tool_output", "A timestamp cannot be represented as finite seconds.")
        if pts is None:
            self.add_reason("missing_pts")
        else:
            if self.previous is not None and pts <= self.previous:
                self.add_reason("nonmonotonic_pts")
            self.lowest = pts if self.lowest is None else min(pts, self.lowest)
            self.highest = pts if self.highest is None else max(pts, self.highest)
            # Presentation span; does not interpret an offset start as duration.
            span = float((self.highest - self.lowest) * self.time_base)
            if span > self.budget.limits.max_duration_seconds:
                raise MediaError("duration_limit", "Media exceeds the duration limit.")
            self.previous = pts
        self.frames.append({"frame_index": len(self.frames), "pts": pts, "time_seconds": seconds})


def inspect_media(path: str | os.PathLike, *, limits: MediaLimits | None = None) -> dict:
    """Inspect the first non-attached-picture video stream, preserving original PTS.

    Local regular files only; symlinks, URLs and indirect formats are rejected.
    The input is held open read-only; identity, size and modification timestamps
    are compared before and after inspection, including on unsuccessful probes.
    """
    limits = MediaLimits() if limits is None else limits
    if not isinstance(limits, MediaLimits):
        raise TypeError("limits must be MediaLimits or None")
    budget = _Budget(limits)
    try:
        raw_path = os.fspath(path)
    except TypeError:
        raise MediaError("invalid_path", "A local file path is required.") from None
    if not isinstance(raw_path, str) or not raw_path or "\x00" in raw_path or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", raw_path):
        raise MediaError("invalid_path", "A local file path without a URL or protocol is required.")
    local = Path(raw_path)
    fd = None
    try:
        # NONBLOCK prevents a FIFO open from blocking before regular-file checks.
        fd = os.open(local, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode):
            raise MediaError("invalid_path", "The input must be a regular local file.")
        if before.st_size > limits.max_bytes:
            raise MediaError("byte_limit", "Media exceeds the file size limit.")
        if before.st_size == 0:
            raise MediaError("invalid_media", "The media file is empty.")
        try:
            result = _inspect_open(fd, local.name, before.st_size, budget)
        finally:
            try:
                unchanged = (_fingerprint(before) == _fingerprint(os.fstat(fd))
                             == _fingerprint(os.stat(local, follow_symlinks=False)))
            except OSError:
                unchanged = False
            if not unchanged:
                raise MediaError("file_changed", "The media file changed during inspection.", retryable=True)
        budget.check()
        return result
    except OSError:
        raise MediaError("file_unavailable", "The local media file could not be read.", retryable=True) from None
    finally:
        if fd is not None:
            os.close(fd)


def _inspect_open(fd: int, source_name: str, size: int, budget: _Budget) -> dict:
    hasher = hashlib.sha256()
    total = 0
    while True:
        budget.check()
        chunk = os.read(fd, min(1024 * 1024, budget.limits.max_bytes - total + 1))
        if not chunk:
            break
        total += len(chunk)
        if total > budget.limits.max_bytes:
            raise MediaError("byte_limit", "Media exceeds the file size limit.")
        hasher.update(chunk)
    if total != size:
        raise MediaError("file_changed", "The media file changed during inspection.", retryable=True)
    demuxer = container_format(fd, size, budget.check)
    tool = shutil.which("ffprobe")
    if tool is None:
        raise MediaError("tool_unavailable", "FFprobe is not installed.", retryable=True)
    version_raw = _run([tool, "-version"], budget, fd)
    first_line = version_raw.decode("utf-8", errors="replace").splitlines()
    match = re.match(r"ffprobe version (\S+)", first_line[0] if first_line else "")
    if not match:
        raise MediaError("invalid_tool_output", "FFprobe did not report a version.")
    base = [tool, "-v", "error"]
    base += ["-max_alloc", str(64 * 1024 * 1024), "-threads", "1",
             "-protocol_whitelist", "file", "-format_whitelist", "mov,matroska,webm,avi",
             "-probesize", "5000000", "-analyzeduration", "5000000",
             "-err_detect", "explode", "-f", demuxer]
    if demuxer == "mov":
        base += ["-enable_drefs", "0", "-use_absolute_path", "0"]
    base += ["-i", f"/dev/fd/{fd}", "-select_streams", "V:0"]
    os.lseek(fd, 0, os.SEEK_SET)
    metadata = _run(base + ["-show_streams", "-show_format", "-of", "json"], budget, fd)
    try:
        parsed = json.loads(metadata, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        streams = parsed["streams"]
        if not isinstance(streams, list):
            raise ValueError
        if not streams:
            raise MediaError("no_video_stream", "No video stream other than attached pictures was found.")
        stream = streams[0]
        index = stream["index"]
        width = stream.get("coded_width") or stream["width"]
        height = stream.get("coded_height") or stream["height"]
        codec = stream["codec_name"]
        time_base = _ratio(stream.get("time_base"), positive=True)
        if (any(type(value) is not int for value in (index, width, height))
                or index < 0 or width <= 0 or height <= 0 or not isinstance(codec, str)
                or not codec or time_base is None):
            raise ValueError
    except (ValueError, KeyError, TypeError, IndexError):
        raise MediaError("invalid_tool_output", "FFprobe returned incomplete video metadata.") from None
    duration = _number(stream.get("duration"))
    format_duration = _number(parsed.get("format", {}).get("duration"))
    # Both ceilings matter: a non-selected track may advertise a longer file.
    if any(value is not None and value > budget.limits.max_duration_seconds
           for value in (duration, format_duration)):
        raise MediaError("duration_limit", "Media exceeds the duration limit.")
    frames = _Frames(time_base, index, budget)
    os.lseek(fd, 0, os.SEEK_SET)
    _run(base + ["-show_frames", "-show_entries", "frame=stream_index,pts:frame_side_data=",
                 "-of", "compact=p=1:nk=0"], budget, fd, frames.feed)
    frames.finish()
    sar = _ratio(stream.get("sample_aspect_ratio"), positive=True)
    nominal = _ratio(stream.get("r_frame_rate"), positive=True)
    average = _ratio(stream.get("avg_frame_rate"), positive=True)
    digest = hasher.hexdigest()
    return {
        "schema_version": "0.1.0", "asset_id": f"sha256:{digest}", "sha256": digest,
        "byte_size": size, "source_name": source_name, "stream_index": index,
        "codec_name": codec, "coded_width": width, "coded_height": height,
        "sample_aspect_ratio": _ratio_text(sar), "rotation_degrees": _rotation(stream),
        "time_base": _ratio_text(time_base), "duration_seconds": duration if duration is not None else format_duration,
        "nominal_fps": float(nominal) if nominal is not None else None,
        "average_fps": float(average) if average is not None else None,
        "frames": frames.frames, "quality_reasons": frames.reasons,
        "timing_basis": "original_pts", "temporal_resolution": "not_established",
        "tool": {"name": "ffprobe", "version": match.group(1)},
    }

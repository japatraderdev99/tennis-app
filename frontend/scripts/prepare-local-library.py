"""Prepare a private, read-only video library; never uploads or modifies sources.

From frontend: python3 scripts/prepare-local-library.py --output
artifacts/local-library.json --video /absolute/path/to/export.mp4 [--video ...]
The output must not already exist. Keep its directory outside version control.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import subprocess
import sys


def regular_without_symlinks(path: Path) -> Path:
    path = Path(os.path.abspath(path))
    for candidate in (path, *path.parents):
        if candidate.is_symlink():
            raise ValueError("Symlinks are not accepted")
    if not stat.S_ISREG(path.stat().st_mode):
        raise ValueError("A regular local file is required")
    return path


def stat_identity(value: os.stat_result) -> dict:
    return {"size_bytes": value.st_size, "mtime_ns": str(value.st_mtime_ns),
            "ctime_ns": str(value.st_ctime_ns), "dev": str(value.st_dev), "ino": str(value.st_ino)}


def digest_fd(fd: int) -> str:
    os.lseek(fd, 0, os.SEEK_SET)
    digest = hashlib.sha256()
    while block := os.read(fd, 2 * 1024 * 1024):
        digest.update(block)
    os.lseek(fd, 0, os.SEEK_SET)
    return digest.hexdigest()


def run(command: list[str], fd: int, timeout: int) -> bytes:
    result = subprocess.run(command, shell=False, check=True, capture_output=True,
                            timeout=timeout, pass_fds=(fd,))
    if len(result.stdout) > 1024 * 1024:
        raise ValueError("Unexpectedly large tool output")
    return result.stdout


def prepare(source: Path, poster_directory: Path) -> dict:
    source = regular_without_symlinks(source)
    if source.suffix.lower() not in {".mp4", ".mov"}:
        raise ValueError("Only local MP4/MOV files are supported")
    fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = stat_identity(os.fstat(fd))
        if not before["size_bytes"]:
            raise ValueError("Empty video")
        digest = digest_fd(fd)
        opened_path = f"/dev/fd/{fd}"
        metadata = json.loads(run([
            "ffprobe", "-v", "error", "-protocol_whitelist", "file", "-format_whitelist", "mov",
            "-show_entries", "format=duration:stream=codec_type,width,height,duration:stream_side_data=rotation",
            "-of", "json", opened_path,
        ], fd, 30))
        videos = [s for s in metadata.get("streams", []) if s.get("codec_type") == "video"]
        if len(videos) != 1:
            raise ValueError("Exactly one video stream is required")
        video = videos[0]
        duration = float(metadata.get("format", {}).get("duration", video.get("duration", "nan")))
        width, height = int(video.get("width", 0)), int(video.get("height", 0))
        if not math.isfinite(duration) or duration <= 0 or width <= 0 or height <= 0:
            raise ValueError("Missing finite video dimensions/duration")
        rotations = [float(s["rotation"]) for s in video.get("side_data_list", []) if "rotation" in s]
        if rotations and int(round(rotations[0])) % 180 == 90:
            width, height = height, width
        video_id = digest[:24]
        poster = poster_directory / f"{video_id}.jpg"
        if poster.exists():
            raise ValueError("Duplicate media or output already exists")
        os.lseek(fd, 0, os.SEEK_SET)
        run([
            "ffmpeg", "-nostdin", "-v", "error", "-n", "-protocol_whitelist", "file", "-format_whitelist", "mov",
            "-ss", str(min(8.0, duration / 2)), "-i", opened_path, "-map", "0:v:0",
            "-frames:v", "1", "-vf", "scale=960:-2", "-q:v", "3", str(poster),
        ], fd, 60)
        if stat_identity(os.fstat(fd)) != before or stat_identity(source.stat()) != before:
            raise ValueError("Video changed during preparation")
        poster_fd = os.open(poster, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            poster_identity = stat_identity(os.fstat(poster_fd))
            poster_identity["sha256"] = digest_fd(poster_fd)
        finally:
            os.close(poster_fd)
        title = re.sub(r"[\x00-\x1f]+", " ", source.stem).replace("_", " ").strip()[:180]
        return {
            "id": video_id, "title": title or "Vídeo local", "path": str(source),
            "poster_path": str(poster), "duration_seconds": duration,
            "width": width, "height": height, "size_bytes": before["size_bytes"], "edited": True,
            "identity": {**before, "sha256": digest}, "poster_identity": poster_identity,
        }
    finally:
        os.close(fd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--video", required=True, action="append", type=Path)
    args = parser.parse_args()
    if len(args.video) > 256:
        parser.error("At most 256 videos may be prepared together")
    output = Path(os.path.abspath(args.output))
    if output.exists() or output.is_symlink():
        parser.error("Output exists; use a new manifest path, never overwrite evidence")
    output.parent.mkdir(parents=True, exist_ok=True)
    for parent in (output.parent, *output.parents):
        if parent.is_symlink():
            parser.error("Output directory cannot use symlinks")
    posters = output.parent / (output.stem + "-posters")
    posters.mkdir(mode=0o700, exist_ok=False)
    try:
        videos = [prepare(source, posters) for source in args.video]
        # The manifest is the completion marker; partially generated posters are
        # never offered by the bridge if preparation fails.
        fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump({"version": 1, "videos": videos}, file, ensure_ascii=False, allow_nan=False, indent=2)
            file.write("\n")
        print(f"Prepared {len(videos)} local videos. Private manifest and posters written; no upload.")
        return 0
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        # Native-tool stderr may include personal paths. Keep console errors terse.
        print(f"Preparation failed ({type(error).__name__}); no complete manifest was published.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

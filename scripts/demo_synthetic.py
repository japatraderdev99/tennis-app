"""Make a tiny non-human video and explicit synthetic annotations, then analyze.

Run with: uv run --frozen python scripts/demo_synthetic.py NEW_OUTPUT_DIRECTORY
The video is a solid color. Points are supplied mathematically, NOT inferred.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

from tennis_backend.media import inspect_media
from tennis_backend.pipeline import analyze_local, write_bundle


def synthetic_annotation(media: dict) -> dict:
    frames = [{"frame_index": f["frame_index"], "pts": f["pts"]}
              for f in media["frames"]]
    return {
        "schema_version": "0.1.0", "asset_id": media["asset_id"],
        "time_base": media["time_base"],
        "display_width": 160, "display_height": 120,
        "coordinate_space": "display_pixels", "transforms": [],
        "body_side": "left", "phase_id": "serve_preparation",
        "phase_window": {"start_pts": frames[0]["pts"], "end_pts": frames[-1]["pts"]},
        "timeline": frames,
        "observations": [{**frame, "hip": {"x": 80.0, "y": 20.0},
                          "knee": {"x": 80.0, "y": 60.0},
                          "ankle": {"x": 120.0, "y": 60.0}}
                         for frame in frames],
        "provenance": {"kind": "synthetic", "protocol_id": "technical-right-angle-v0",
                       "annotation_ref": "synthetic:constant-90deg-not-athlete-data"},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        parser.error("ffmpeg is required to create the synthetic fixture")
    with tempfile.TemporaryDirectory(prefix="tennis-demo-") as temporary:
        video = Path(temporary) / "synthetic solid color.mp4"
        subprocess.run([ffmpeg, "-v", "error", "-nostdin", "-f", "lavfi", "-i",
                        "color=c=blue:s=160x120:r=5:d=1", "-an", "-c:v", "mpeg4",
                        "-y", str(video)], check=True, timeout=15)
        media = inspect_media(video)
        annotation = synthetic_annotation(media)
        bundle = analyze_local(video, annotation)
        write_bundle(bundle, args.output, source_video=video)
    print("Demonstração sintética concluída. Não houve inferência de pose.")
    print("Número experimental em research.json; report.json mantém value=null.")


if __name__ == "__main__":
    main()

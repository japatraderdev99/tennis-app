"""Command-line entry point for the local research foundation."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import stat
import sys

from tennis_backend.contracts import MediaManifest
from tennis_backend.media import MediaError, inspect_media
from tennis_backend.pipeline import analyze_local, write_bundle


def _reject_constant(value: str) -> None:
    raise ValueError("non_finite_json_number")


def _read_annotation(path: Path) -> object:
    limit = 16 * 1024 * 1024
    descriptor = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
    with os.fdopen(descriptor, "rb") as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError("annotation_file_not_regular")
        raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("annotation_file_too_large")
    return json.loads(raw.decode("utf-8"), parse_constant=_reject_constant)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Bancada local de pesquisa. Não estima pose nem valida técnica."
    )
    sub = parser.add_subparsers(dest="command", required=True)
    inspect = sub.add_parser("inspect", help="Inspecionar vídeo local sem alterá-lo")
    inspect.add_argument("video", type=Path)
    research = sub.add_parser("research", help="Calcular M01 com anotações explícitas")
    research.add_argument("video", type=Path)
    research.add_argument("--annotations", required=True, type=Path)
    research.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "inspect":
            manifest = MediaManifest.model_validate(inspect_media(args.video))
            print(manifest.model_dump_json(indent=2))
        else:
            payload = _read_annotation(args.annotations)
            bundle = analyze_local(args.video, payload)
            write_bundle(bundle, args.output_dir)
            print(json.dumps({"report_id": bundle["report"]["report_id"],
                              "is_demo": bundle["report"]["is_demo"],
                              "message": bundle["report"]["message"]},
                             ensure_ascii=False, allow_nan=False))
    except MediaError as error:
        print(json.dumps(error.to_dict(), ensure_ascii=False, allow_nan=False),
              file=sys.stderr)
        return 2
    except (OSError, ValueError, TypeError):
        # Do not expose private paths, validation payloads or subprocess stderr.
        print(json.dumps({"schema_version": "0.1.0", "code": "local_input_or_output_error",
                          "message": "Verifique arquivo, anotações e diretório de saída novo.",
                          "retryable": False, "details": {}}, ensure_ascii=False),
              file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

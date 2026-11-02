"""Confere os mocks contra o backend real. Uso, a partir da raiz do repositório:

    (cd frontend && npx tsx scripts/export-fixtures.ts <dir> --full)
    uv run --frozen python frontend/scripts/verify_against_backend.py <dir>

Valida PublicReport e PoseArtifact com os modelos estritos e compara a saída de
`select_target` com o porte em TypeScript. Comprova coerência de formato e de
lógica. Não diz nada sobre validade biomecânica: os dados são simulados.
"""
import json
import sys
from pathlib import Path

from tennis_backend.contracts import PublicReport
from tennis_backend.pose import PoseArtifact
from tennis_backend.selection import select_target

directory = Path(sys.argv[1])
failures = 0
for path in sorted(directory.glob("*.artifact.json")):
    name = path.name.removesuffix(".artifact.json")
    data = json.loads(path.read_text())
    PoseArtifact.model_validate(data["artifact"])
    result = select_target(
        data["artifact"],
        seed_frame_index=data["seed"]["frame_index"],
        seed_detection_id=data["seed"]["detection_id"],
    )
    same = result["frames"] == data["expected"]
    report = json.loads((directory / f"{name}.report.json").read_text())
    PublicReport.model_validate(report)
    numeric = [m for m in report["metrics"] if m["value"] is not None]
    counts = {}
    for frame in result["frames"]:
        counts[frame["status"]] = counts.get(frame["status"], 0) + 1
    ok = same and not numeric
    failures += 0 if ok else 1
    print(f"{'OK ' if ok else 'ERRO'} {name}: selecao_igual={same} {counts}")
sys.exit(1 if failures else 0)

"""Confere os mocks contra o backend real. Uso, a partir da raiz do repositório:

    (cd frontend && npx tsx scripts/export-fixtures.ts <dir> --full)
    uv run --frozen python frontend/scripts/verify_against_backend.py <dir>

Valida PublicReport e PoseArtifact com os modelos estritos e compara a saída de
`select_target` com o porte em TypeScript. Comprova coerência de formato e de
lógica. Não diz nada sobre validade biomecânica: os dados são simulados.
"""
import argparse
import json
import sys
from pathlib import Path

from tennis_backend.contracts import PublicReport
from tennis_backend.pose import PoseArtifact
from tennis_backend.selection import select_target

# Deliberately explicit: changing the seedable fixture inventory is a reviewed
# change, not an accidental reduction in the number of checked scenarios.
EXPECTED_SCENARIOS = frozenset({"limpo", "perda", "cruzamento", "pes", "falha", "conexao"})


def reject_nonfinite(value: str):
    raise ValueError(f"JSON não finito: {value}")


def read_json(path: Path):
    return json.loads(path.read_text(), parse_constant=reject_nonfinite)


def verify_directory(directory: Path) -> int:
    artifacts = {p.name.removesuffix(".artifact.json") for p in directory.glob("*.artifact.json")}
    reports = {p.name.removesuffix(".report.json") for p in directory.glob("*.report.json")}
    expected = len(EXPECTED_SCENARIOS)
    if not directory.is_dir() or artifacts != EXPECTED_SCENARIOS or reports != EXPECTED_SCENARIOS:
        print(f"ERRO conjunto de fixtures: esperados={expected}, artefatos={len(artifacts)}, relatórios={len(reports)}")
        for label, found in (("artefatos", artifacts), ("relatórios", reports)):
            missing, extra = EXPECTED_SCENARIOS - found, found - EXPECTED_SCENARIOS
            if missing: print(f"  {label} ausentes: {', '.join(sorted(missing))}")
            if extra: print(f"  {label} inesperados: {', '.join(sorted(extra))}")
        print(f"Verificados=0/{expected}; verificação recusada.")
        return 2

    failures = 0
    for name in sorted(EXPECTED_SCENARIOS):
        try:
            data = read_json(directory / f"{name}.artifact.json")
            if not isinstance(data, dict) or set(data) != {"artifact", "seed", "expected"}:
                raise ValueError("envelope de fixture inválido")
            if not isinstance(data["seed"], dict) or set(data["seed"]) != {"frame_index", "detection_id"}:
                raise ValueError("envelope de semente inválido")
            PoseArtifact.model_validate(data["artifact"])
            result = select_target(
                data["artifact"],
                seed_frame_index=data["seed"]["frame_index"],
                seed_detection_id=data["seed"]["detection_id"],
            )
            # Serialized comparison distinguishes JSON booleans from integers.
            same = json.dumps(result["frames"], sort_keys=True, allow_nan=False) == json.dumps(data["expected"], sort_keys=True, allow_nan=False)
            report = read_json(directory / f"{name}.report.json")
            PublicReport.model_validate(report)
            if report["is_demo"] is not True or report["asset_id"] != data["artifact"]["asset_id"]:
                raise ValueError("relatório deve ser simulado e corresponder ao artefato")
            numeric = [m for m in report["metrics"] if m["value"] is not None]
            counts: dict[str, int] = {}
            for frame in result["frames"]:
                counts[frame["status"]] = counts.get(frame["status"], 0) + 1
            ok = same and not numeric
            failures += 0 if ok else 1
            print(f"{'OK ' if ok else 'ERRO'} {name}: selecao_igual={same} {counts}")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            failures += 1
            print(f"ERRO {name}: {type(exc).__name__}")
    print(f"Verificados={expected}/{expected}; aprovados={expected - failures}; falhas={failures}.")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    return verify_directory(parser.parse_args().directory)


if __name__ == "__main__":
    sys.exit(main())

"""CLI acceptance checks for full synthetic fixtures; no real media or network."""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys

import pytest

FRONTEND = Path(__file__).resolve().parents[1]
SCRIPT = FRONTEND / "scripts/verify_against_backend.py"
SCENARIOS = ("conexao", "cruzamento", "falha", "limpo", "perda", "pes")


def run_check(directory: Path):
    return subprocess.run([sys.executable, str(SCRIPT), str(directory)],
                          capture_output=True, text=True, check=False, timeout=30)


@pytest.fixture(scope="module")
def full_fixtures(tmp_path_factory):
    target = tmp_path_factory.mktemp("frontend-full-fixtures")
    subprocess.run(["node", "--import", "tsx", "scripts/export-fixtures.ts", str(target), "--full"],
                   cwd=FRONTEND, capture_output=True, text=True, check=True, timeout=30)
    return target


def placeholder_set(directory: Path):
    for name in SCENARIOS:
        for suffix in ("artifact", "report"):
            (directory / f"{name}.{suffix}.json").write_text("{}")


def test_complete_export_checks_all_six_real_backend_scenarios(full_fixtures):
    result = run_check(full_fixtures)
    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.count("OK ") == 6
    assert "Verificados=6/6; aprovados=6; falhas=0" in result.stdout


@pytest.mark.parametrize("existing", [False, True])
def test_missing_or_empty_directory_cannot_pass(tmp_path, existing):
    target = tmp_path / "fixtures"
    if existing:
        target.mkdir()
    result = run_check(target)
    assert result.returncode == 2
    assert "Verificados=0/6" in result.stdout
    assert "artefatos=0" in result.stdout


@pytest.mark.parametrize("suffix", ["artifact", "report"])
def test_missing_pair_member_is_rejected_before_validation(tmp_path, suffix):
    placeholder_set(tmp_path)
    (tmp_path / f"limpo.{suffix}.json").unlink()
    result = run_check(tmp_path)
    assert result.returncode == 2
    assert "limpo" in result.stdout
    assert "Verificados=0/6" in result.stdout


@pytest.mark.parametrize("suffix", ["artifact", "report"])
def test_unexpected_case_is_not_silently_accepted(tmp_path, suffix):
    placeholder_set(tmp_path)
    (tmp_path / f"unexpected.{suffix}.json").write_text("{}")
    result = run_check(tmp_path)
    assert result.returncode == 2
    assert "inesperados: unexpected" in result.stdout


def test_matching_count_with_wrong_names_cannot_pass(tmp_path):
    placeholder_set(tmp_path)
    for suffix in ("artifact", "report"):
        (tmp_path / f"limpo.{suffix}.json").rename(tmp_path / f"other.{suffix}.json")
    result = run_check(tmp_path)
    assert result.returncode == 2
    assert "artefatos=6" in result.stdout and "relatórios=6" in result.stdout
    assert "ausentes: limpo" in result.stdout and "inesperados: other" in result.stdout


@pytest.mark.parametrize("mutation", ["selection", "boolean_index", "not_demo", "wrong_asset", "invalid_json", "nonfinite"])
def test_invalid_case_fails_and_prints_checked_counts(tmp_path, full_fixtures, mutation):
    for path in full_fixtures.glob("*.artifact.json"):
        shutil.copyfile(path, tmp_path / path.name)
    for path in full_fixtures.glob("*.report.json"):
        shutil.copyfile(path, tmp_path / path.name)
    path = tmp_path / ("limpo.report.json" if mutation in {"not_demo", "wrong_asset"} else "limpo.artifact.json")
    data = json.loads(path.read_text())
    if mutation == "selection":
        data["expected"][0]["detection_id"] = "another-player"
    elif mutation == "boolean_index":
        # False compares equal to Python 0; the verifier must compare JSON types.
        data["expected"][0]["frame_index"] = False
    elif mutation == "not_demo":
        data["is_demo"] = False
    elif mutation == "wrong_asset":
        data["asset_id"] = "sha256:" + "f" * 64
    elif mutation == "nonfinite":
        data["expected"][0]["pts"] = float("nan")
    path.write_text("{bad" if mutation == "invalid_json" else json.dumps(data))
    result = run_check(tmp_path)
    assert result.returncode == 1, result.stdout + result.stderr
    assert "ERRO limpo" in result.stdout
    assert "Verificados=6/6; aprovados=5; falhas=1" in result.stdout


def test_missing_cli_argument_has_usage_error():
    result = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True, timeout=10)
    assert result.returncode == 2
    assert "usage:" in result.stderr
    assert "Traceback" not in result.stderr

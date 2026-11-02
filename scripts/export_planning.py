"""Publish a bounded, portable planning mirror without changing the local vault.

Usage: python scripts/export_planning.py --vault PATH [--check]
Only explicitly selected approved notes and historical JSON discussion fixtures
are exported. Videos, detailed metadata, transcripts and Claude drafts are not.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from urllib.parse import quote

REPO = Path(__file__).resolve().parents[1]
DESTINATION = REPO / "docs" / "planning"
NOTES = (
    "00-Inicio/Leia-primeiro.md",
    "01-Referencias/Analise-dos-sete-videos.md",
    "02-Pesquisa/Validade-cientifica.md",
    "02-Pesquisa/Stack-e-modelos.md",
    "02-Pesquisa/Produto-mercado-e-privacidade.md",
    "03-Produto/Proposta-integrada.md",
    "04-Arquitetura/Arquitetura-e-contratos.md",
    "04-Arquitetura/Catalogo-de-metricas.md",
    "05-Validacao/Plano-de-validacao.md",
    "06-Decisoes/Registro-de-decisoes.md",
    "06-Decisoes/Aprovacao-Gabriel-v0.1.md",
    "07-Claude/Handoff-Claude-Opus.md",
    "08-Operacao/Equipe-e-operacao.md",
    "08-Operacao/Preparacao-P0-P1.md",
    "08-Operacao/Plano-de-implementacao-backend-v0.1.md",
    "08-Operacao/Quadro-operacional-backend.md",
    "08-Operacao/Checkpoint-P1-fundacao-2026-11-01.md",
    "08-Operacao/Backup-e-proveniencia.md",
    "08-Operacao/Registro-da-entrega-2026-11-01.md",
    "09-Templates/Template-experimento.md",
)
FIXTURES = tuple("04-Arquitetura/exemplos/" + filename for filename in (
    "01-replay-pesquisa.json", "02-evidencia-insuficiente.json",
    "03-historico-incompativel.json", "04-falha-tecnica.json",
))
CHAT_ID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)
HOME_PATH = re.compile(r"/Users/[^/\s`]+")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def portable_note(text: str, source: str, vault: Path) -> str:
    workspace = str(vault.parent)
    text = text.replace(str(vault), "[vault-local]")
    text = text.replace(workspace, "[workspace-local]")
    text = text.replace("/private/tmp/tennis-uv-cache", "[cache-uv-local]")
    text = text.replace("/private/tmp/tennis-asr-libs", "[ambiente-asr-local]")
    text = HOME_PATH.sub("[home-local]", text)
    text = CHAT_ID.sub("[chat-local]", text)
    targets = {Path(path).stem: Path(path) for path in NOTES}

    def wiki(match: re.Match) -> str:
        reference = match.group(1)
        target, _, alias = reference.partition("|")
        label = alias or target
        key, _, anchor = target.partition("#")
        resolved = targets.get(Path(key).stem)
        if resolved is None:
            return label + " (material local não incluído)"
        relative = Path(os.path.relpath(resolved, Path(source).parent)).as_posix()
        url = quote(relative, safe="/")
        if anchor:
            url += "#" + quote(anchor.lower().replace(" ", "-"), safe="-")
        return f"[{label}]({url})"

    return re.sub(r"\[\[([^\]]+)\]\]", wiki, text).rstrip() + "\n"


def export(vault: Path, *, check: bool = False) -> int:
    vault = vault.resolve(strict=True)
    generated: dict[str, bytes] = {}
    entries = []
    for relative in (*NOTES, *FIXTURES):
        source = vault / relative
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Expected regular source file: {relative}")
        data = source.read_bytes()
        if relative.endswith(".md"):
            rendered = portable_note(data.decode("utf-8"), relative, vault).encode("utf-8")
        else:
            parsed = json.loads(data)
            if parsed.get("is_demo") is not True:
                raise ValueError("Discussion fixtures must be explicitly marked as demos")
            rendered = data
        generated[relative] = rendered
        entries.append({"file": relative, "source_sha256": sha(data),
                        "published_sha256": sha(rendered)})
    index = [
        "# Planejamento do Tennis App\n",
        "Cópia portátil de notas selecionadas do vault Obsidian, com links navegáveis no GitHub. "
        "O vault local continua sendo a fonte editorial; esta pasta é um espelho gerado. "
        "Caminhos pessoais e IDs de chats foram substituídos.\n",
        "Os documentos registram decisões históricas de 01/11/2026. Frases como ‘sem remoto’ "
        "descrevem o checkpoint anterior à publicação. O estado atual do código está no "
        "[README principal](../../README.md) e em [HEAD-P1](../deliveries/HEAD-P1.md).\n",
        "## Índice\n",
    ]
    index.extend(f"- [{Path(path).stem}]({quote(path, safe='/')})" for path in NOTES)
    index.extend([
        "\n## Contratos e material omitido\n",
        "Os JSONs de `04-Arquitetura/exemplos/` são **rascunhos históricos de discussão**; "
        "não são o contrato executável. Consulte [CONTRACTS_V0](../CONTRACTS_V0.md), "
        "[schemas atuais](../../schemas/README.md) e as fixtures em `tests/contracts/`.\n",
        "Mídias, frames, folhas de contato, transcrições integrais, inventário detalhado, "
        "configurações do Obsidian, scripts do vault e pesquisa/conceito/experimentos "
        "preliminares do Claude permanecem somente no workspace. Referências a esses "
        "materiais nas notas não significam que estejam neste repositório.\n",
        "## Atualização\n",
        "```sh\npython scripts/export_planning.py --vault /caminho/do/vault\n"
        "python scripts/export_planning.py --vault /caminho/do/vault --check\n```\n",
        "O exportador usa uma lista explícita de arquivos, não altera o vault e não remove "
        "arquivos inesperados silenciosamente. `manifest.json` registra hashes da origem "
        "e da cópia portátil. Alterações editoriais voltam ao vault antes da exportação.\n",
    ])
    generated["README.md"] = ("\n".join(index).rstrip() + "\n").encode("utf-8")
    generated["manifest.json"] = (json.dumps({
        "format_version": "1.0", "exporter": "scripts/export_planning.py",
        "source": "local Obsidian vault (path withheld)", "files": entries,
        "excludes": ["media", "raw transcripts", "detailed inventory", "Claude drafts",
                     "local configuration", "snapshots", "vault scripts"],
    }, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    actual = {path.relative_to(DESTINATION).as_posix() for path in DESTINATION.rglob("*")
              if path.is_file()} if DESTINATION.exists() else set()
    unexpected = actual - generated.keys()
    if unexpected:
        raise ValueError("Unexpected mirror files; review before removing: " + ", ".join(sorted(unexpected)))
    if check:
        different = [name for name, data in generated.items()
                     if not (DESTINATION / name).is_file() or (DESTINATION / name).read_bytes() != data]
        if different:
            raise ValueError("Planning mirror differs: " + ", ".join(different))
    else:
        for name, data in generated.items():
            target = DESTINATION / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    print(f"Planning mirror {'verified' if check else 'exported'}: {len(entries)} source files")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    raise SystemExit(export(args.vault, check=args.check))

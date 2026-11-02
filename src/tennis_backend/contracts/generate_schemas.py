"""Run from the checkout: python -m tennis_backend.contracts.generate_schemas."""

import json
from pathlib import Path

from . import ErrorEnvelope, MediaManifest, PublicReport, ResearchInput, ResearchResult

MODELS = (MediaManifest, ResearchInput, ResearchResult, PublicReport, ErrorEnvelope)


def generate(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for model in MODELS:
        schema = model.model_json_schema(mode="validation")
        schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
        (output_dir / f"{model.__name__}.schema.json").write_text(
            json.dumps(schema, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    generate(Path("schemas"))

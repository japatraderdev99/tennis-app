# Trabalho no repositório

Leia [AGENTS.md](AGENTS.md), [contratos](docs/CONTRACTS_V0.md) e
[operação](docs/OPERATIONS.md) antes de implementar.

## Branches e revisão

- `main`: integração aceita pelo head, com testes passando.
- `feat/contracts-v0`, `feat/media-ingest-v0`, `feat/research-metrics-v0`:
  entregas originais de P1, preservadas como histórico.
- `integrate/p1-foundation`: checkpoint técnico integrado, também marcado pela
  tag `p1-foundation-v0.1.0`.
- Novas tarefas partem de `main`, com branch própria e escopo explícito.
  Integração passa por PR/revisão; não reescrever branches compartilhadas.

UX/UI/frontend pertencem ao Claude. A ausência atual de uma pasta de frontend
é intencional; o contrato de serviço será estabilizado antes dessa etapa.

## Verificação

```sh
uv sync --frozen
uv run --frozen pytest -q
uv run --frozen python scripts/demo_synthetic.py artifacts/nova-demonstracao
```

FFmpeg e FFprobe devem estar instalados. Os testes usam arquivos sintéticos
temporários; não incluir dados de atletas ou referências pessoais nas fixtures.
O CI executa a suíte em Ubuntu/Python 3.12 e 3.13, sem serviços externos de IA.
Um CI verde verifica comportamento de código; não libera métricas biomecânicas.

## Documentação e dados

O vault Obsidian local é a fonte editorial. `docs/planning/` é sua cópia portátil
selecionada; use `scripts/export_planning.py`, sem editar o espelho manualmente.
Contratos executáveis e suas versões vivem neste repositório. Registre divergências
e decisões no vault antes de ampliar o escopo científico.

Não versionar vídeos, transcrições integrais, frames, credenciais, consentimentos,
dados identificáveis, pesos de modelo, ambientes, caches ou snapshots binários.
Dados sintéticos devem ser identificados. Preservar os originais fora do Git.

Uma PR deve explicar problema/comportamento resultante, escopo, testes efetivamente
executados e limites. Downloads de modelos precisam de licença/proveniência
verificadas; não presumir aprovação científica por disponibilidade de software.

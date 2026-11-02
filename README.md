# Tennis App

Fundação de pesquisa para ajudar tenistas que treinam sozinhos a observar seus
movimentos a partir de vídeos de celular. A proposta combina evidência rastreável
com uma experiência simples; Codex lidera backend/data science e Claude liderará
UX/UI/frontend na etapa posterior.

**Estado atual:** biblioteca Python e CLI local de P1, integradas e verificadas
com 674 testes e uma demonstração sintética. Ainda não há API HTTP, inferência
de pose, aplicativo visual ou métrica biomecânica validada em atletas.

## Comece por aqui

- [Planejamento e spec](docs/planning/README.md): cópia portátil selecionada do vault Obsidian.
- [Plano de implementação](docs/planning/08-Operacao/Plano-de-implementacao-backend-v0.1.md): ondas, responsabilidades e critérios de avanço.
- [Contrato executável](docs/CONTRACTS_V0.md) e [JSON Schemas](schemas/README.md).
- [Entrega integrada de P1](docs/deliveries/HEAD-P1.md): testes, decisões e limites.
- [Handoff para Claude](docs/FRONTEND_HANDOFF_GATE.md): requisitos para UX/UI/frontend.
- [Organização do repositório](docs/REPOSITORY.md) e [contribuição](CONTRIBUTING.md).

## Executar localmente

Requisitos: Python 3.12 ou 3.13, uv, FFmpeg e FFprobe. A implementação de mídia usa
APIs POSIX; Windows não foi validado. As dependências Python estão em `uv.lock`.

```sh
git clone https://github.com/japatraderdev99/tennis-app.git
cd tennis-app
uv sync --frozen
uv run --frozen pytest -q

# Demonstração inteiramente sintética; o diretório precisa ser novo.
uv run --frozen python scripts/demo_synthetic.py artifacts/synthetic-demo
```

A demonstração cria um vídeo de cor sólida e usa pontos definidos matematicamente.
Ela **não extrai landmarks do vídeo**. `research.json` contém o número experimental;
`report.json` mantém `value: null`. Isso verifica o percurso do software e não a
qualidade técnica de um tenista.

```sh
# Inspeção de arquivo local, sem modificar o vídeo.
uv run --frozen python -m tennis_backend inspect /caminho/video.mp4

# Cálculo com anotações explícitas no formato ResearchInput.
uv run --frozen python -m tennis_backend research /caminho/video.mp4 --annotations /caminho/anotacoes.json --output-dir artifacts/nova-execucao
```

O pacote contém manifesto de mídia, anotações, resultado interno, relatório e
checksums SHA-256. A demo também preserva seu vídeo sintético. `checksums.json`
é gravado por último; sem ele, o diretório está incompleto. Saídas existentes não
são sobrescritas. Execuções repetidas recebem IDs novos.

## Estrutura

```text
src/tennis_backend/   contratos, mídia, métricas e pipeline local
tests/               testes e fixtures sintéticas
schemas/             JSON Schemas reproduzíveis
docs/planning/       espelho portátil selecionado do Obsidian
docs/deliveries/     entregas das frentes e aceite do head
scripts/             demonstração e exportação da spec
.github/             workflow de testes e modelo de PR
```

O vault original permanece no workspace, sem movimentação ou sobrescrita.
`docs/planning/` é gerado por uma lista explícita de notas, com caminhos pessoais
e IDs de chats removidos. Vídeos originais, frames, transcrições, pesos, ambientes
locais e materiais preliminares do Claude permanecem fora do Git.

## Limites e próxima etapa

O cálculo atual é flexão **projetada em 2D**, com lado e fase fornecidos. Lacunas
de evidência anulam o pico. Não há score de técnica, ângulo ideal, diagnóstico,
detector de melhora ou orientação personalizada validada.

A inspeção limita formatos, referências externas, tempo, bytes, frames e saída
do processo. FFprobe continua sendo um processo nativo local: esses controles
não constituem isolamento de produção para uploads não confiáveis.

A próxima onda planejada cobre API/persistência e um experimento de pose com
licença, proveniência e protocolo de validação. Claude recebe os contratos e
estados estabilizados para conduzir UX/UI/frontend. Nenhum serviço foi implantado.

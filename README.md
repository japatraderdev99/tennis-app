# Tennis App

Fundação de pesquisa para ajudar tenistas que treinam sozinhos a observar seus
movimentos a partir de vídeos de celular. A proposta combina evidência rastreável
com uma experiência simples; Codex lidera backend/data science e Claude liderará
UX/UI/frontend na etapa posterior.

**Estado atual:** biblioteca/CLI local de P1 e laboratório de pose P2 integrado.
MediaPipe e RTMPose têm adaptadores opcionais, seleção explícita do jogador e
anotação/avaliação independente. Ainda não há API HTTP, aplicativo visual,
implantação cloud ou métrica biomecânica validada em atletas. Veja a evidência e
os limites no [checkpoint P2](docs/deliveries/HEAD-P2.md).

## Comece por aqui

- [Planejamento e spec](docs/planning/README.md): cópia portátil selecionada do vault Obsidian.
- [Plano de implementação](docs/planning/08-Operacao/Plano-de-implementacao-backend-v0.1.md): ondas, responsabilidades e critérios de avanço.
- [Contrato executável](docs/CONTRACTS_V0.md) e [JSON Schemas](schemas/README.md).
- [Entrega integrada de P1](docs/deliveries/HEAD-P1.md): testes, decisões e limites.
- [Laboratório P2](docs/P2_POSE_LAB.md) e [operação paralela](docs/P2_OPERATIONS.md).
- [Arquitetura cloud proposta](docs/architecture/ADR-0001-pilot-cloud.md): Supabase Auth/PostgreSQL e Google Cloud Storage/Run/Tasks.
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

## Protótipo de interface

Esta branch inclui a [versão Codex V2 do Quadro](frontend/README.md), baseada na
entrega de Claude e autorizada enquanto ele está indisponível. React/TypeScript,
vídeo sintético, seleção explícita e replay; sem upload real ou medição validada.
O [laboratório de avaliação](docs/UI_AGENT_EVALUATION.md) mantém testes automáticos,
agentes externos e usabilidade humana como evidências distintas.

## Estrutura do repositório

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

## Laboratório de pose opcional

O pacote base não importa bibliotecas de visão computacional. Para o ambiente
experimental separado, com versões do lockfile:

```sh
UV_PROJECT_ENVIRONMENT=.venv-pose uv sync --frozen --extra pose
```

`MediaPipeAdapter` e `RTMPoseAdapter` recebem pesos **locais**, sem download
automático. O detector RTMPose deve ser YOLOX somente de pessoas; pesos COCO
multiclasse não são compatíveis com essa interface. O perfil testado usa HumanArt
e RTMPose-x COCO17 384×288. Termos dos checkpoints precisam ser fechados antes
de distribuição comercial. A instalação real foi exercitada em macOS arm64;
inferência em container Linux ainda precisa de verificação própria.

`infer_pose_frames` recebe manifesto de mídia, adaptador e frames decodificados
com índices da origem. O chamador declara transformações de imagem e fecha o
adaptador. `prepare_pose_review` exige um jogador escolhido explicitamente e cria
referências **em branco**. `write_pose_review` grava um diretório novo com hashes.
Veja [o protocolo de anotação](docs/research/P2_ANNOTATION_PROTOCOL.md).

Essas funções não implementam upload, decodificador arbitrário nem serviço HTTP.
O overlay ajuda a inspecionar o modelo; não estabelece precisão. A seleção por
caixas é uma heurística e interrompe em perda, lacuna ou ambiguidade. Sem
referências humanas independentes, a avaliação fica `not_evaluated`.

## Limites e próxima etapa

O cálculo atual é flexão **projetada em 2D**, com lado e fase fornecidos. Lacunas
de evidência anulam o pico. Não há score de técnica, ângulo ideal, diagnóstico,
detector de melhora ou orientação personalizada validada.

A inspeção limita formatos, referências externas, tempo, bytes, frames e saída
do processo. FFprobe continua sendo um processo nativo local: esses controles
não constituem isolamento de produção para uploads não confiáveis.

A próxima onda cobre API/persistência local, ciclo de uploads/jobs e adaptadores
de provedores, antes de provisionamento cloud. Em paralelo, a pesquisa exige
anotações independentes e testes de captura. Claude recebe os contratos e estados
estabilizados para conduzir UX/UI/frontend. Nenhum serviço foi implantado.

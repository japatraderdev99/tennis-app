# Quadro — revisão local de vídeos, V3

Versão isolada em `feat/ux-real-video-v3`. As versões de Claude e Codex V2 ficam
preservadas. Esta versão abre vídeos reais locais, permite repetir trechos e guardar
observações manuais. Com o motor local configurado, estima pontos 2D de um quadro
real escolhido pelo usuário. Não calcula biomecânica, placar ou evolução.

Percurso do saque para celular: entender a proposta, posicionar o celular, importar, escolher o jogador, acompanhar o processamento, rever com esqueleto, entender limitações, reencontrar no histórico e excluir.

Na raiz (`/`), a revisão usa vídeos reais. A demonstração anterior, inteiramente
sintética, continua em `/?demo=1`. Os modos não compartilham mídia, esqueleto ou notas.

```sh
npm ci
npm run dev        # http://127.0.0.1:5185
npm test           # unitários
npm run test:e2e   # percursos em viewport de celular (npx playwright install chromium)
npm run build
```

A biblioteca privada é restrita ao loopback: não exponha o servidor na rede.
O seletor “Abrir vídeo” usa uma URL blob do arquivo, sem upload. A reprodução depende
do codec aceito pelo navegador. Testes de aparelho físico continuam pendentes.
Portas: V1 5183, V2 5184, V3 5185.

## Análise operacional de um quadro real

Abra o vídeo, pause no instante desejado e use **Analisar este quadro**. Escolha
explicitamente uma pessoa na imagem resultante para ver os pontos. O esqueleto
fica apenas nessa imagem congelada, mesmo se o vídeo continuar a reprodução.

O navegador reduz a imagem a até 1280 px de maior dimensão e envia somente um PNG
ao processo Python neste computador. O resultado precisa corresponder ao SHA-256
e às dimensões desse PNG. Não há upload externo, PTS inventado, acompanhamento
temporal, análise do golpe inteiro, medida validada ou avaliação de técnica.
Imagem e resultado ficam em memória e são descartados ao sair da revisão.

Preparação do motor, a partir da raiz do repositório:

```sh
uv sync --extra pose --frozen
```

Crie `frontend/artifacts/local-pose.json` (privado, ignorado pelo Git):

```json
{
  "python_path": "/caminho/absoluto/do/checkout/.venv/bin/python",
  "model_path": "/caminho/privado/pose_landmarker_heavy.task",
  "model_sha256": "sha256 completo de 64 caracteres hexadecimais do modelo local"
}
```

Use pesos locais do [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).
O worker nunca baixa modelos; verifica o hash antes de carregar os mesmos bytes.
O fluxo opera em `npm run dev` restrito ao loopback. Build estático e `preview`
não incluem o motor. A falta de configuração aparece como indisponibilidade,
nunca como resultado simulado. Limites: PNG até 4 MiB, 90 segundos, uma análise
por vez e até quatro candidatos; a seleção é sempre manual. A regra de desenho
omite pontos fora da imagem ou com visibilidade/presença abaixo do limiar técnico.
Esse limiar não estabelece precisão ou validade biomecânica.

## Biblioteca local privada

```sh
python3 scripts/prepare-local-library.py --output artifacts/local-library.json \
  --video /caminho/para/um-video.mp4 --video /caminho/para/outro-video.mp4
```

O script gera hashes, metadados e miniaturas em `artifacts/` (ignorado pelo Git);
não altera originais. O manifesto deve ser novo. Para outra biblioteca, use
`TENNIS_LOCAL_LIBRARY=/caminho/manifesto.json npm run dev`. Não use uma variável
`VITE_*` com caminhos pessoais. A ponte só serve IDs permitidos e recusa arquivos
que mudaram desde a preparação. Detalhes em [local media](../docs/deliveries/UX-V3-LOCAL-MEDIA.md).

Marcas usam segundos de reprodução do arquivo editado, não PTS do original ou
quadros exatos. Anotações do catálogo ficam no localStorage deste navegador; as de
arquivos escolhidos pelo seletor ficam na aba. “Exportar meus momentos” salva um
JSON local. Fechar uma revisão não altera nem apaga o vídeo original.

Smoke com vídeos reais, exclusivamente local e num novo diretório privado:

```sh
node scripts/smoke-real-library.mjs /caminho/privado/nova-rodada
```

O script abre navegador isolado, testa playback/busca/velocidade/notas e salva
capturas privadas. Nunca use seus resultados como validação de biomecânica.

Demo: `/?demo=1#/estados` abre os estados sintéticos. `?demo=1&velocidade=rapida`
encurta as esperas. Esses atalhos não analisam vídeos reais.

## Estrutura

- `src/api`: tipos, `ApiClient` e limite assíncrono de apresentação de frames. Campos ainda inexistentes no backend estão marcados como PROPOSTA. O adaptador implementado ainda desenha apenas vídeo sintético.
- `src/local`: biblioteca/revisão real e observações manuais, separadas do contrato científico.
- `dev/localMedia.ts`: transporte local de arquivos conhecidos com Range/HEAD, somente leitura.
- `src/domain`: tempo por PTS, rotas e todas as frases ligadas a estados.
- `src/screens`, `src/ui`, `src/styles`: apresentação. Não importam mocks, exceto os atalhos de revisão em `Lab.tsx`.
- `src/mocks`: vídeo sintético, poses e porte de `select_target`.
- `fixtures/`: exemplos simulados para o handoff (`npm run fixtures`).

Para conferir os mocks contra o backend:

```sh
node --import tsx scripts/export-fixtures.ts /tmp/mocks --full
(cd .. && uv run --frozen python frontend/scripts/verify_against_backend.py /tmp/mocks)
```

A escolha desta stack vale para o protótipo e não decide a plataforma do produto.
Pesquisa de ferramentas e limites: [laboratório de avaliação](../docs/UI_AGENT_EVALUATION.md).
Execução das seis tarefas e formato de resultados: [benchmarks](benchmarks/README.md).
Decisões originais ficam no vault `07-Claude/UX-UI-V1/`; a entrega desta versão fica
em `07-Claude/UX-UI-Codex-V2/`; a rodada com vídeos reais fica em `07-Claude/UX-Real-V3/`.

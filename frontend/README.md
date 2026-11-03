# Quadro — melhorias Codex V2, dados simulados

Versão isolada em `feat/ux-codex-v2`, baseada na entrega de Claude `b84fa3a`.
A versão original continua em `feat/ux-ui-v1`; esta branch permite comparar as duas.

Percurso do saque para celular: entender a proposta, posicionar o celular, importar, escolher o jogador, acompanhar o processamento, rever com esqueleto, entender limitações, reencontrar no histórico e excluir.

**Tudo é simulado.** Não há API, atleta, vídeo real nem inferência, e nada sai do aparelho. Não representa medição nem validação.

```sh
npm ci
npm run dev        # http://127.0.0.1:5184
npm test           # unitários
npm run test:e2e   # percursos em viewport de celular (npx playwright install chromium)
npm run build
```

Para abrir num celular na mesma rede, inicie explicitamente `npm run dev -- --host 0.0.0.0`
e use o endereço Network exibido. Isso não publica o app na internet. A porta 5183
continua reservada ao protótipo original. Testes de aparelho físico ainda estão pendentes.

Revisores: `/#/estados` abre qualquer estado. `?velocidade=rapida` encurta as esperas.

## Estrutura

- `src/api`: tipos, `ApiClient` e limite assíncrono de apresentação de frames. Campos ainda inexistentes no backend estão marcados como PROPOSTA. O adaptador implementado ainda desenha apenas vídeo sintético.
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
em `07-Claude/UX-UI-Codex-V2/`.

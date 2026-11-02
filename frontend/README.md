# Protótipo de UX/UI: dados simulados

Percurso do saque para celular: entender a proposta, posicionar o celular, importar, escolher o jogador, acompanhar o processamento, rever com esqueleto, entender limitações, reencontrar no histórico e excluir.

**Tudo é simulado.** Não há API, atleta, vídeo real nem inferência, e nada sai do aparelho. Não representa medição nem validação.

```sh
npm install
npm run dev        # http://localhost:5183 e endereço de rede para o celular
npm test           # unitários
npm run test:e2e   # percursos em viewport de celular (npx playwright install chromium)
npm run build
```

Revisores: `/#/estados` abre qualquer estado. `?velocidade=rapida` encurta as esperas.

## Estrutura

- `src/api`: tipos e interface `ApiClient`. Campos ainda inexistentes no backend estão marcados como PROPOSTA.
- `src/domain`: tempo por PTS, rotas e todas as frases ligadas a estados.
- `src/screens`, `src/ui`, `src/styles`: apresentação. Não importam mocks, exceto os atalhos de revisão em `Lab.tsx`.
- `src/mocks`: vídeo sintético, poses e porte de `select_target`.
- `fixtures/`: exemplos simulados para o handoff (`npm run fixtures`).

Para conferir os mocks contra o backend:

```sh
npx tsx scripts/export-fixtures.ts /tmp/mocks --full
(cd .. && uv run --frozen python frontend/scripts/verify_against_backend.py /tmp/mocks)
```

A escolha desta stack vale para o protótipo e não decide a plataforma do produto. Decisões e handoff ficam no vault: `07-Claude/UX-UI-V1/`.

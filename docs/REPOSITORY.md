# Organização e publicação

Destino autorizado por Gabriel: <https://github.com/japatraderdev99/tennis-app>.
O repositório remoto estava vazio e público antes desta publicação.

O código permanece na raiz deste repositório, mantendo os commits e checkouts
existentes. No workspace original, esse repositório é a subpasta `tennis-backend`;
não foi necessário mover o vault, alterar worktrees ou reescrever histórico.

| Caminho | Papel |
|---|---|
| `src/tennis_backend/` | Contratos, mídia, métrica de pesquisa e integração local |
| `tests/` | Casos sintéticos, invariantes e integração |
| `schemas/` | Contratos JSON gerados e limites de validação |
| `docs/planning/` | Espelho portátil selecionado do vault Obsidian |
| `docs/deliveries/` | Entregas de cada frente e aceite técnico do head |
| `docs/CONTRACTS_V0.md` | Adendo executável da fundação |
| `docs/FRONTEND_HANDOFF_GATE.md` | Dependências para o trabalho do Claude |
| `scripts/` | Demo sintética e exportação da documentação |
| `.github/` | CI e modelo de PR |

A publicação inclui `main`, as três branches de implementação, a branch de
integração e a tag `p1-foundation-v0.1.0`. Os commits originais e os metadados Git
foram preservados; não foi feito force push nem reescrita de autores.

Na onda P2, `feat/p2-pose-adapters`, `feat/p2-target-selection` e
`feat/p2-pose-evaluation` preservam as entregas isoladas. `integrate/p2-pose-lab`
reúne os merges, revisão e ajustes do head antes da promoção para `main`.
O checkpoint técnico está em `docs/deliveries/HEAD-P2.md`; vídeos, pesos e
artefatos reais continuam somente no workspace privado.

O espelho remove caminhos pessoais e IDs de chats, converte wikilinks em links
Markdown e registra hashes. Não inclui mídia, inventário detalhado, transcrições,
pesquisa/experimentos/conceito preliminares do Claude ou configurações pessoais.
Referências a artefatos locais em notas históricas não significam disponibilidade
desses arquivos no GitHub. O histórico editorial original permanece no vault.

O remoto preserva código e planejamento selecionado fora do dispositivo, mas não
substitui backup dos vídeos ou do vault completo. Não foi configurada publicação
de pacote, aplicativo, site ou serviço cloud.

O workflow usa actions fixadas por commit, permissões de leitura e dependências
Python do lockfile. Referências de configuração: [GitHub — testes Python](https://docs.github.com/en/actions/tutorials/build-and-test-code/python)
e [uv — GitHub Actions](https://docs.astral.sh/uv/guides/integration/github/), consultadas
em 01/11/2026. Resultados locais e resultados remotos de CI são registros distintos.

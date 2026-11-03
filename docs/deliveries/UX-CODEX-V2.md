# Quadro — entrega Codex V2

2026-11-02, branch `feat/ux-codex-v2`. Autorizada pelo usuário enquanto Claude está
indisponível; original `feat/ux-ui-v1` / `b84fa3a` preservado e checkout limpo.
Head integra; colaboradores revisaram integridade, ferramentas e benchmark.

## Resultado

- Mesmos componentes React/TypeScript/CSS, fontes e identidade de quadra do Claude.
  Revisão em duas colunas no desktop, uma no celular; abertura com movimento
  acionado pelo usuário; ações no fluxo sem cobrir opções.
- Replay explícito após falha e cancelamento, sem esqueleto inventado. Bloqueios
  conhecidos de captura continuam explicados; acompanhamento não vira nota técnica.
- Nova seleção mantém autoridade mesmo quando perdida/ambígua; não recupera
  silenciosamente a identidade antiga. Fixtures vazias/incompletas falham.
- Carregamento/erro/tentativa de novo em candidatos e revisão. Limite assíncrono
  de frames descarta respostas atrasadas, confirma o índice e permite nova tentativa.
  Apenas o adaptador sintético está implementado; decodificador real e mapa PTS
  continuam em P3. Excluir bloqueia novos acessos/mutações do mock e é idempotente.
- CI inclui interface, acessibilidade automatizada, fixtures e seis tarefas do
  laboratório. [Pesquisa e arquitetura](../UI_AGENT_EVALUATION.md) documentam sete
  repositórios, critérios de escolha e comparativo futuro de 36 tentativas.

## Evidência executada localmente

| Verificação | Resultado observado |
| --- | --- |
| Vitest da interface | 73 aprovados |
| Normalizador de benchmark | 9 aprovados |
| Verificador de fixtures (pytest) | 15 aprovados |
| Porte TS versus backend Python | 6/6 cenários com seleção idêntica e contratos válidos |
| TypeScript + build Vite | Aprovados |
| Percursos de UI + novos checks de alvos/movimento | 13 aprovados na revisão anterior desta rodada |
| Benchmark determinístico final local | 6/6 tarefas e 6/6 conjuntos de invariantes de apresentação |
| QA visual | Abertura, revisão desktop/mobile, perda em 320 px, paisagem, tempo indisponível; sem overflow horizontal observado nas vistas verificadas |

O benchmark aprovado usa commit `104e1f5657121f0377bbc2dd0a45150cb7becf03`, fontes
limpas, Node 22.17.1, Chromium 156.0.8078.4, viewport Pixel 7 (412 × 839).
A soma das durações dos testes foi 73.880 ms; isso é tempo de scripts/esperas,
não velocidade humana nem desempenho de um agente. Depois desta execução houve
um ajuste de texto para o replay sem esqueleto, registrado no diff; o CI verifica
o HEAD publicado. Esta nota não antecipa seu resultado.

Todas as tentativas são distinguidas:

1. `benchmark-run-01`: runner não iniciou por import JSON sem atributo de tipo.
2. [benchmark-run-02](../evidence/ux-codex-v2/benchmark-run-02.json): 5/6; roteiro
   pulava abertura e procurava histórico na tela inicial. Preservado como falha.
3. [benchmark-run-03](../evidence/ux-codex-v2/benchmark-run-03.json): 6/6, com início
   do percurso corrigido e sem retries. **Não é uma avaliação de agentes externos.**

Os JSONs normalizados não contêm caminhos pessoais. Relatórios brutos, traces e
capturas locais ficam fora do Git; CI publica apenas evidências sintéticas por
14 dias. O vault guarda a leitura consolidada e capturas desta versão.

## Aceite e próximos gates

Aceite técnico limitado ao protótipo sintético e seus testes. Nenhum vídeo real
entra nesta interface. Sem provisionamento, deploy, serviço HTTP, medição validada,
score de técnica, inferência em produção ou alteração de contratos congelados.
Nenhum agente externo, reconstrução automática, benchmark de acurácia, praticante,
celular físico, Safari/iOS, leitor de tela real ou teste sob sol foi avaliado aqui.

Próximos gates: validar compreensão com praticantes; decidir captura por EXP-001;
implementar candidatos imutáveis, contratos de replay e mídia P3; só então integrar
vídeos reais. Comparar ferramentas de agentes em origem local isolada, com modelo,
orçamento e avaliador independente definidos antes da execução.

Abrir: seguir [frontend/README](../../frontend/README.md), porta 5184. A porta 5183
e a worktree do Claude continuam disponíveis para comparação.

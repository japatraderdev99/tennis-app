---
tipo: plano-operacional
versao: 0.1.0
data: 2026-11-01
status: implementacao-autorizada
responsavel: Codex
---

# Implementação backend e data science

Gabriel autorizou nesta conversa o início da implementação, a criação de chats
operacionais com **Sol 6.1 / high**, a organização em branches e a manutenção de
UX/UI/frontend com Claude nas etapas posteriores. Este plano concretiza esse pedido.

**Prontidão:** sim para a fundação de P1; ainda não para produto com medições
validadas, análise automática de movimentos ou operação com usuários reais.
[Preparacao-P0-P1](Preparacao-P0-P1.md) continua como mapa de descoberta e validação.

## Base de código e fonte de verdade

- Vault: planejamento, decisões, evidências, entregas e critérios de avanço.
- Repositório local separado: `../tennis-backend` relativo à raiz deste vault.
- Checkouts de trabalho: `../backend-worktrees/`, uma branch por frente.
- Contrato executável congelado: `tennis-backend/docs/CONTRACTS_V0.md`.
- Regras de propriedade: `tennis-backend/AGENTS.md` e `docs/OPERATIONS.md`.
- Vídeos originais, anotações do Claude, pesos e dados pessoais ficam fora do Git.
- Não há remote, publicação, infraestrutura contratada ou backup independente
  implícito na criação de um repositório local.

## Onda 1 — fundação verificável

| Chat | Escopo | Branch | Aceitação |
|---|---|---|---|
| BE-01 Contratos | Modelos estritos, JSON Schema, estados, erros e fixtures | `feat/contracts-v0` | Rejeita números públicos sem validação, contagens incoerentes e estados impossíveis |
| BE-02 Mídia | Arquivo local, hash, manifesto FFprobe e timestamps originais | `feat/media-ingest-v0` | Preserva original; limita recursos; rejeita arquivos inválidos; não inventa tempo |
| DS-01 Métricas | Flexão projetada 2D de joelho com landmarks explícitos | `feat/research-metrics-v0` | Geometria conhecida, aspecto correto, ausência explícita, lacuna invalida pico |
| Codex head | Revisão e integração | `integrate/p1-foundation` | Percurso sintético completo e evidência resolvível no mesmo asset/PTS |

Cada chat escreve apenas os seus módulos, testes e nota de entrega. Não altera
contratos compartilhados, lockfile, vault, frontend ou checkout de outro chat.
Cada entrega gera commit próprio. O head integra em ordem BE-01 → BE-02 → DS-01,
verifica os cruzamentos e só depois promove a branch de integração para `main`.
Sem force push, squash automático, reset destrutivo ou limpeza de arquivos alheios.

### Entrega observável

Arquivo de vídeo **sintético** → manifesto real do FFprobe → landmarks
**sintéticos identificados** → resultado interno M01 → relatório com `value:null`.
Os landmarks não são extraídos do vídeo nesta onda. Testes comprovarão propriedades
de código, não acurácia biomecânica em tenistas. A interface de integração pode
começar como CLI local; não se simula fila durável ou segurança multiusuário.

### Lacunas fechadas para permitir paralelismo

1. Estados de asset, execução e elegibilidade separados; importação local não é upload.
2. Artefato numérico de pesquisa separado do contrato apresentado pelo produto.
3. Contrato de PTS, `time_base`, dimensões, aspecto e rotação explicitado.
4. Janela manual inclusiva e cobertura integral para M01; sem filtro/interpolação.
5. `not_evaluated` representa comparação ainda não implementada; sem limiar de progresso.

O adendo técnico tem precedência sobre ambiguidades do texto v0.1 para esta bancada.
Não substitui nem apaga a proposta original. Alterações futuras exigem versão,
compatibilidade, motivo e registro no vault.

## Onda 2 — serviço e experimento de visão

**Entrada:** fundação integrada e testes aceitos pelo head.

Dois trilhos futuros: (a) API local e persistência de sessões/assets/jobs/relatórios,
com idempotência, cancelamento e exclusão testáveis; (b) adaptadores de pose e
benchmark, começando por licença e proveniência dos pesos, dados anotados e
avaliação por pessoa/captura. A escolha do provedor cloud e o orçamento permanecem
abertos. Não há razão para provisionar infraestrutura antes dessas evidências.

Dependências de banco, fila e infraestrutura serão decididas em ADR antes da
implementação respectiva. Supabase/Postgres, se escolhidos, exigirão revisão de
schema/RLS e as skills correspondentes. Não são dependências desta onda inicial.

## Onda 3 — entrada do Claude

**Entrada:** contrato do backend estabilizado, fixtures completas e estados de
ausência/erro/replay reproduzíveis. O handoff terá exemplos versionados, mensagens
didáticas, restrições de captura e campos que podem ou não aparecer na tela.

Claude lidera UX/UI/frontend, incluindo captura solo, compreensão e acessibilidade.
Gabriel decide a experiência com os dois heads. A validação científica pode bloquear
exibição de uma métrica sem bloquear protótipo de captura/replay com dados simulados.
Nenhum score técnico, ângulo ideal ou promessa de evolução será criado por conveniência visual.

## Critérios e limites

- Execução: testes reproduzíveis e integração aceita; não usar volume de linhas como sucesso.
- Rastreabilidade: versão de método, hash, PTS e evidência consistentes em toda a cadeia.
- Ciência: nenhum número experimental promovido por passar teste de software.
- Produto: simplicidade e compreensão serão avaliadas com Claude/Gabriel depois.
- Operação: branch, chat, commit, testes, dono e pendências registrados em [Quadro-operacional-backend](Quadro-operacional-backend.md).

Sem prazo ou custo prometido antes de observar as primeiras entregas. Os resultados
de pesquisa do Claude são insumos preliminares: a leitura estática encontrou uma
confirmação bilateral que perde o sinal em `progress_sim.py`; isso será registrado
para revisão, sem editar o trabalho dele nem importar taxas simuladas como parâmetros.

Relacionados: [Registro-de-decisoes](../06-Decisoes/Registro-de-decisoes.md), [Catalogo-de-metricas](../04-Arquitetura/Catalogo-de-metricas.md),
[Arquitetura-e-contratos](../04-Arquitetura/Arquitetura-e-contratos.md), [Handoff-Claude-Opus](../07-Claude/Handoff-Claude-Opus.md).

---
title: Onda P2 — pose, seleção, avaliação e arquitetura cloud
date: 2026-11-01
status: aceite-tecnico-local
owner: Codex - head backend e data science
tags: [operacao, p2, chats, arquitetura]
---

# Onda P2 — pose, seleção, avaliação e arquitetura cloud

O usuário autorizou novos chats paralelos em Sol 6.1 alto, com Codex orquestrando e
revisando. UX/UI/frontend permanecem com Claude. O primeiro gate é um laboratório
local integrado e testável, sem declarar validação biomecânica.

## Chats e branches

Todos criados no projeto App Tennis, host local, modelo `gpt-6.1-sol`, raciocínio
`high`. Cada chat recebe checkout e caminhos exclusivos.

| Frente | Chat | Branch | Checkout abaixo de backend-worktrees |
|---|---|---|---|
| CV-02 — adaptadores de pose | [chat-local] | feat/p2-pose-adapters | p2-pose |
| BE-03 — seleção do jogador | [chat-local] | feat/p2-target-selection | p2-selection |
| DS-02 — anotação e avaliação | [chat-local] | feat/p2-pose-evaluation | p2-evaluation |
| Head — integração e aceite | chat principal | integrate/p2-pose-lab | tennis-backend |

Base comum dos builders: `61915c7`. A revisão do contrato em `f692945` vincula
seleção ao asset/time_base e fecha estados de avaliação sem referência/predição.
Os builders receberam instrução de ler o contrato atualizado do checkout do head.

## Entregas e limites

1. CV-02: artefato de pesquisa estrito, mapeamento COCO17, MediaPipe/RTMPose opcionais,
   pesos locais identificados, PTS e imports sem dependências pesadas na base.
2. BE-03: seed explícito, associação geométrica conservadora, perda/ambiguidade
   visíveis e nenhum retorno automático para outro jogador.
3. DS-02: templates sem referência inventada, protocolo de anotação e avaliador
   com erro e cobertura separados. Sem anotações revisadas, não há acurácia real.
4. Head: revisão, integração, dependências, teste local privado, preservação dos
   originais, documentação e checkpoint. Aceite técnico não é aceite científico.

Não há treinamento de modelo, liberação da M01 automática, score ideal,
reconhecimento facial, frontend, provisionamento cloud ou upload dos vídeos.
O contrato do laboratório não se disfarça de proveniência manual/sintética da P1.

## Direção cloud proposta

**Supabase Auth + PostgreSQL; Google Cloud Storage + Cloud Run + Cloud Tasks.**
O vídeo fica próximo do processamento no GCP. A sugestão inicial de Supabase
Storage foi revista por localidade dos arquivos grandes; continua alternativa,
sem alegar comparação de custo ainda não medida. Cloudflare é opcional para DNS;
AWS/Firebase são alternativas de plataforma, não camadas adicionais do piloto.

API FastAPI e worker Python ficam separados. App autentica, recebe autorização
de upload privado retomável, envia direto ao storage, solicita análise e consulta
relatório. Fila recebe IDs, worker executa com limites, resultado é persistido com
idempotência. Postgres guarda metadados; buckets guardam vídeos e derivados.

Antes de provisionar: contas, região, teto de gasto, volume, retenção/backup e
modelo de custo. Antes do piloto externo: testes Linux, autorização, falhas,
cancelamento/exclusão, restauração e limites. Não foi provisionado nenhum serviço.

Especificações canônicas de execução no repositório `tennis-backend`:

- `docs/P2_POSE_LAB.md`: interfaces do laboratório.
- `docs/P2_OPERATIONS.md`: ownership e sequência.
- `docs/architecture/ADR-0001-pilot-cloud.md`: ADR cloud com fontes.
- `docs/deliveries/HEAD-P2.md`: revisão, execução real, testes e limites.

## Fechamento técnico em 02/11/2026

Três entregas concluídas e integradas. **1.077 testes passaram** no conjunto final.
MediaPipe/RTMPose executados em janelas reais limitadas; anotações independentes
continuam pendentes. Detalhes: [Checkpoint-P2-laboratorio-2026-11-02](Checkpoint-P2-laboratorio-2026-11-02.md).
Arquitetura organizada em [Arquitetura-cloud-do-piloto](../04-Arquitetura/Arquitetura-cloud-do-piloto.md).

Relacionadas: Prontidao-prototipo-videos-reais-2026-11-01 (material local não incluído),
Referencias-biomecanicas-e-KPIs-do-piloto (material local não incluído), [Plano-de-validacao](../05-Validacao/Plano-de-validacao.md).

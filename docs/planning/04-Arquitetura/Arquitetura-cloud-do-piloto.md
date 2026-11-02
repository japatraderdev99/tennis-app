---
title: Arquitetura cloud do piloto
date: 2026-11-02
status: proposta-tecnica
owner: Codex - head backend e data science
tags: [arquitetura, cloud, backend, piloto]
---

# Arquitetura cloud do piloto

Direção proposta: **Supabase Auth + PostgreSQL e Google Cloud Storage + Cloud Run
+ Cloud Tasks**. A implementação atual continua local. Nenhuma conta, recurso
pago, banco remoto, API ou bucket foi provisionado nesta onda.

## Responsabilidades

| Camada | Escolha | Papel |
|---|---|---|
| Identidade | Supabase Auth | Login e sessões; API verifica token e autorização |
| Dados do produto | Supabase PostgreSQL | Dono, sessão, vídeo, job, versão e referência do relatório |
| Arquivos | Google Cloud Storage privado | Originais, derivados e artefatos; acesso temporário autorizado |
| API | FastAPI + Pydantic no Cloud Run | Contratos, autorização, uploads, estado dos jobs e resultados |
| Fila | Cloud Tasks | Despacho com limites, retries e controle de concorrência |
| Processamento | Worker Python separado no Cloud Run | FFmpeg, MediaPipe/RTMPose, seleção e evidências |
| Execuções longas | Cloud Run Jobs, se necessário | Alternativa com reconciliação explícita da execução |
| Operação | Artifact Registry, Secret Manager, Logging/Monitoring | Imagens versionadas, segredos e diagnóstico |
| Código e CI | GitHub e Actions | Revisão e verificações reproduzíveis |

O PostgreSQL guarda metadados e referências; bytes de vídeo ficam no storage.
O núcleo científico Python não depende dos SDKs dos provedores.

## Caminho de uma análise

1. App autentica com Supabase e solicita upload à API.
2. API verifica usuário, reserva um objeto e inicia upload retomável privado.
3. Celular envia o vídeo diretamente ao GCS, sem passar os bytes pela API.
4. API confirma objeto/versão e persiste job com evento durável de despacho.
5. Cloud Tasks chama o worker privado usando identidade de serviço.
6. Worker adquire execução, verifica limites/cancelamento e processa o vídeo.
7. Derivados e hashes são gravados; uma referência final é publicada no banco.
8. App consulta estado e recebe acesso temporário aos próprios resultados.

Fila recebe identificadores, sem vídeo ou credenciais. Tentativas podem se
repetir: leases e idempotência evitam publicar resultados duplicados. Um evento
durável e reconciliador tratam a falha entre gravar no banco e enfileirar.

## Por que essa combinação

Supabase simplifica identidade e dados relacionais. GCP concentra o vídeo e o
processamento pesado, evitando trazer o original de outro provedor a cada análise.
A sugestão inicial de Supabase Storage foi refinada por esse motivo. Não há
medição que permita declarar um provedor mais barato neste momento.

Cloudflare fica opcional para DNS/edge. AWS é uma alternativa de plataforma;
Firebase Auth/Firestore duplicaria responsabilidades já escolhidas. Kubernetes,
Redis/Celery e banco vetorial não fazem parte do piloto proposto. Framework e
hospedagem do frontend serão definidos com Claude.

## Limites operacionais a fechar

- Avaliar São Paulo nos dois serviços; mesma cidade não significa rede privada
  comum nem tráfego gratuito. Confirmar disponibilidade e quotas das contas.
- Cloud Tasks tem deadline HTTP máximo de 30 minutos. O worker terá limite
  interno menor, medido e imposto também aos processos nativos.
- Começar em CPU, uma análise por instância e concorrência limitada na fila.
- RLS e autorização por dono; credencial privilegiada não substitui esse controle.
- Cancelamento/exclusão devem impedir retries antigos de recriarem resultados.
- Backup de PostgreSQL não contém os bytes dos objetos. Retenção, recuperação
  e exclusão do storage precisam de política e teste próprios.
- Custo por análise útil: banco/auth, armazenamento, replays, CPU/RAM, retries,
  inicialização de modelos, fila, logs e backup. Falhas de captura entram na conta.

## Sequência de implementação

| Onda | Entrega | Critério de avanço |
|---|---|---|
| P2 local | Pose, seleção e avaliação | Testes, revisão e inferência real limitada; sem validade científica presumida |
| P3 local | API versionada, persistência e ciclo de jobs | Autorização, idempotência, falhas, retry, cancelamento e exclusão verificáveis |
| P4 provedores | Integrações Supabase/GCP e container Linux | Conta/região/teto de gasto/retenção definidos; inferência e recuperação testadas |
| Piloto externo | Captura simples e experiência com Claude | Contratos estáveis, observabilidade, custo e critérios científicos explícitos |

Pesquisa prossegue em paralelo: anotar pontos independentemente, medir erro e
cobertura por condição de captura e só depois avaliar promoção de métricas.
O estado `not_evaluated` e `value: null` continua correto sem essa evidência.

## Fontes e decisão técnica

O ADR-0001 do repositório registra o detalhamento executável e os tradeoffs.
Fontes: [Supabase Auth](https://supabase.com/docs/guides/auth/jwts),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[GCS retomável](https://docs.cloud.google.com/storage/docs/resumable-uploads),
[Cloud Tasks com Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-tasks),
[deadline da fila](https://docs.cloud.google.com/tasks/docs/dual-overview),
[backups Supabase](https://supabase.com/docs/guides/platform/backups).

Relacionadas: [Onda-P2-pose-e-arquitetura-cloud](../08-Operacao/Onda-P2-pose-e-arquitetura-cloud.md), [Arquitetura-e-contratos](Arquitetura-e-contratos.md),
[Checkpoint-P2-laboratorio-2026-11-02](../08-Operacao/Checkpoint-P2-laboratorio-2026-11-02.md), [Plano-de-validacao](../05-Validacao/Plano-de-validacao.md).

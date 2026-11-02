---
title: Checkpoint P2 — laboratório integrado
date: 2026-11-02
status: aceite-tecnico-local
owner: Codex - head backend e data science
tags: [operacao, p2, checkpoint]
---

# Checkpoint P2 — laboratório integrado

As três frentes Sol 6.1 alto entregaram código em branches isoladas. O head
integrou e revisou as entregas, com revisão independente dos módulos. O laboratório
está funcional localmente; não é uma API implantada nem medição científica validada.

| Frente | Entrega | Commit de código | Testes do módulo |
|---|---|---|---|
| CV-02 | MediaPipe, RTMPose e contrato COCO17 | e3afb4c | 152 |
| BE-03 | Seed explícito e associação conservadora | 646d597 | 112 |
| DS-02 | Anotação independente e avaliador | 3b13c4e | 110 |
| Head | Integração da timeline e pacote de revisão | 02f5bc6 | 22 |

Suíte integrada: **1.077 testes passaram** no ambiente base, sem dependências CV.
Schemas públicos P1 continuam iguais. O pipeline não converte pose automática
em referência manual nem libera o número de M01 para o usuário.

## Evidência em vídeo real

Ambiente próprio `.venv-pose`, versões fixadas e pesos locais com hash. Executados
32 frames consecutivos com MediaPipe e 12 com RTMPose, em um prefixo de VT01.
Os dois encontraram detecções em todos esses frames. Isso não significa acurácia.

O head inspecionou o primeiro frame/caixas e escolheu explicitamente a detecção 0
do jogador próximo à câmera. A seleção permaneceu nos curtos intervalos testados.
Tempos vieram de PTS originais; o hash do vídeo permaneceu igual. Os pacotes de
revisão têm checksums, referências em branco e avaliação `not_evaluated`.

O vídeo expôs uma incompatibilidade do gate MOV: `alis` vazio, versão 0, flag 1
é uma autorreferência válida de QuickTime. Correção `d0a73b8`, com sete regressões
sintéticas. Referências externas continuam bloqueadas; nenhum original foi alterado.

Evidência privada em `experiments/p2-integration-2026-11-02/`: scripts, manifesto,
poses, seleção, anotações vazias, avaliação e verificação. Experimentos anteriores
e arquivos originais permanecem preservados. Não publicar vídeos/landmarks no Git.

## Pendências que continuam explícitas

- Anotações humanas independentes, erro por articulação/condição e repetibilidade.
- Revisão final de licença/checkpoints e armazenamento durável dos pesos.
- Inferência nativa em container Linux; Mac CPU não prova execução no Cloud Run.
- API HTTP, persistência, jobs, autenticação e integração com provedores.
- Conta, região, limite de gasto, retenção, recuperação e medição de custo.

Próxima onda técnica: API/persistência local e ciclo de jobs. UX/UI/frontend
permanecem com Claude; contratos e estados serão entregues antes de conexão real.
Proposta de infraestrutura: [Arquitetura-cloud-do-piloto](../04-Arquitetura/Arquitetura-cloud-do-piloto.md).
Coordenação/chats: [Onda-P2-pose-e-arquitetura-cloud](Onda-P2-pose-e-arquitetura-cloud.md).

O aceite aqui é local. Publicação Git/CI remoto devem ser registrados com evidência
própria; nenhum push representa implantação cloud ou validação em atletas.

## Publicação do código

Push confirmado em 02/11/2026: integração `f4f0aad` publicada em `main` e
`integrate/p2-pose-lab`, com as três branches de builders preservadas no remoto
`japatraderdev99/tennis-app`. O código mantém os commits originais; sem force push.
Esta anotação não afirma sucesso de CI remoto. Vídeos e artefatos reais não foram publicados.

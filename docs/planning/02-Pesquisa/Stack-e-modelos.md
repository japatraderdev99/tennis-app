---
title: Stack, modelos e operação do motor de análise
date: 2026-11-01
status: proposta-para-revisao
owner: Codex - arquitetura, CV e MLOps
tags: [arquitetura, pesquisa, visao-computacional, backend, licencas]
---

# Stack, modelos e operação do motor de análise

**Recomendação:** começar com um pipeline local, reproduzível e assíncrono para clipes de treino com captura controlada. Usar MediaPipe como baseline de pose e RTMPose como comparador. Medir primeiro a capacidade de extrair evidências confiáveis; acrescentar reconstrução 3D, bola, raquete e modelos multimodais somente quando resolverem uma limitação demonstrada.

Este documento contém escolhas propostas, não resultados de benchmark. Nenhum modelo de pose/biomecânica foi instalado ou executado nesta pesquisa; nenhum vídeo foi enviado a serviços externos. Frontend, UX e UI permanecem sob responsabilidade do Claude Opus. A plataforma do cliente deve ser escolhida em conjunto após o teste de captura em aparelhos reais.

**Diretriz confirmada pelo usuário durante a pesquisa:** o piloto é para tenistas que treinam sozinhos, sem treinador. Logo, gravação, recaptura, entendimento e repetição do treino precisam funcionar sem um segundo operador. Especialistas participam da validação e da curadoria do produto; a presença deles na quadra não é requisito da experiência final. A referência V01/SportArc foi identificada pelo head como animação de forehand, não demonstração de uma medição real por câmera; suas promessas não sustentam escolha de stack.

## 1. Separar seis problemas que uma demonstração costuma misturar

| Problema | Entrega verificável | O que não prova |
|---|---|---|
| Captura e qualidade | Vídeo íntegro, timestamps, corpo visível, enquadramento adequado | Que a cena permite qualquer medida biomecânica |
| Pose | Coordenadas estimadas e sua qualidade por articulação/frame | Anatomia exata, carga articular ou ausência de erro |
| Eventos | Intervalos temporais de preparação, ação e recuperação | Instante exato do contato se bola/raquete não forem observáveis |
| Medição | Cálculo versionado sobre evidências elegíveis | Valor biomecânico verdadeiro sem validação contra referência |
| Interpretação | Achado contextualizado e limite de interpretação | Relação causal entre movimento, lesão ou desempenho |
| Ensino | Explicação curta e exercício aprovado por profissional | Que uma recomendação automaticamente melhora o atleta |

O backend deve conseguir entregar um relatório útil sem chamada a um LLM: replay, marcações, evidência e mensagem determinística. A IA generativa é uma camada opcional de comunicação e investigação; ela não cria números ausentes nem corrige silenciosamente medições.

## 2. Matriz de tecnologias

“Baseline” significa candidato simples para o experimento inicial. “Pesquisa” significa que ainda há uma pergunta técnica, científica ou de licença antes de incorporá-lo ao produto.

| Tecnologia | Uso plausível | Estado proposto | Limitação que decide sua adoção |
|---|---|---|---|
| MediaPipe Pose Landmarker | Pose 2D e estimativa de landmarks 3D, enquadramento e replay | **Baseline** | Generalização ao saque/forehand, oclusão, punho e diferenças entre aparelhos precisam ser medidas |
| RTMPose / MMPose; RTMW quando mãos/pés forem necessários | Comparador de pose, treinamento e alternativas de keypoints | **Comparador** | Complexidade de dependências/exportação e licença do checkpoint exato; AP de benchmark geral não valida tênis |
| Apple Vision 3D Body Pose | Alternativa local em aparelhos Apple | **Spike condicionado à plataforma** | 17 articulações, pessoa mais proeminente; profundidade pode ajudar, mas estimativa monocular não vira laboratório |
| ML Kit Pose | Alternativa Android/iOS | **Reserva** | A documentação Android consultada mantém API beta sem SLA/política de depreciação; avaliar risco de dependência |
| ONNX Runtime + Core ML/XNNPACK ou LiteRT | Executar modelo validado em aparelho | **Otimização posterior** | Conversão, precisão numérica, operadores e consumo térmico precisam ser testados por modelo/aparelho |
| SAM 2 / SAM 3 | Máscaras, seleção de atleta/raquete e auxílio à anotação | **Pesquisa auxiliar** | Segmentação não é pose; bola pequena/oculta e contato não se resolvem automaticamente com uma máscara |
| SAM 3D Body | Reconstrução corporal monocular rica | **Pesquisa 3D** | Mesh plausível não garante ângulos anatômicos corretos ou estabilidade temporal no tênis |
| GVHMR | Recuperação temporal de movimento 3D | **Pesquisa com restrição de uso** | Licença pública limita uso a educação/pesquisa/não comercial; não entra no baseline comercial |
| TrackNet / TrackNetV4 | Localização temporal de bola e candidatos a eventos | **Pesquisa de bola** | Domínio broadcast/datasets específicos; transferência para celular, iluminação e bola minúscula deve ser demonstrada |
| Ultralytics YOLO pose/detecção | Comparador para atleta/raquete/bola com treinamento específico | **Alternativa sujeita a licença** | Modelo genérico não garante orientação da raquete nem contato; condições AGPL/Enterprise precisam caber no produto |

O [MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) oferece landmarks em imagem e coordenadas 3D estimadas. O [MMPose](https://github.com/open-mmlab/mmpose) fornece o ecossistema de pose; o [paper de RTMPose](https://arxiv.org/abs/2303.07399) é evidência do método, não de validade biomecânica no nosso contexto. As capacidades e limitações do [Apple Vision](https://developer.apple.com/documentation/vision/identifying-3d-human-body-poses-in-images) e o estado beta do [ML Kit](https://developers.google.com/ml-kit/vision/pose-detection/android) foram verificados em documentação dos fornecedores.

Há pesquisa recente pertinente: [SAM 3](https://github.com/facebookresearch/sam3) combina prompts textuais/visuais com segmentação e tracking; seu repositório também apresenta [notas SAM 3.1](https://github.com/facebookresearch/sam3/blob/main/RELEASE_SAM3p1.md). [SAM 3D Body](https://github.com/facebookresearch/sam-3d-body) recupera corpo/mãos/pés a partir de imagem usando representação corporal própria. Escolher esses componentes por ganho medido, sem converter “mais novo” em requisito de arquitetura.

## 3. Baseline e evolução

Nomenclatura comum à [Proposta-integrada](../03-Produto/Proposta-integrada.md): P0 descoberta/experiência; P1 laboratório; P2 piloto solo; P3 expansão. Abaixo detalhamos as etapas técnicas.

### P1 — laboratório técnico, sem dependência de nuvem

1. Python em ambiente isolado com lockfile; versões e hashes dos modelos fixados.
2. FFprobe para inventário e FFmpeg para decodificação/derivados, preservando o original e a relação temporal com ele.
3. MediaPipe em modo `VIDEO`; processar timestamps explícitos e registrar frames ausentes.
4. NumPy/SciPy para cálculos e filtragem especificados. Não suavizar através de uma oclusão sem marcar a lacuna. Guardar série bruta e filtrada.
5. Artefatos locais em JSON/Parquet e vídeos de overlay; manifesto por execução e identificadores estáveis.
6. Ferramenta de anotação para pessoa selecionada, eventos e landmarks de referência. A escolha de CVAT ou equivalente deve incluir auditoria da edição/licença e teste de exportação antes de implantação.
7. Relatório com elegibilidade por métrica. Se a métrica não for elegível, valor `null`, motivo específico e orientação de nova captura.

A documentação do [MediaPipe Python](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python) informa que o modo live pode ignorar novos frames quando ocupado. Por isso ele serve ao guia de enquadramento, mas não será a fonte canônica das medidas offline. O vídeo original e os timestamps, não o ritmo do callback, definem a sequência de análise.

### P2 — piloto solo com vários usuários

Proposta de um monólito modular, com processos separados para API e trabalho pesado:

- **FastAPI/Pydantic:** autenticação delegada a provedor OIDC, autorização por usuário/projeto, contratos e leitura do relatório.
- **PostgreSQL:** metadados transacionais, estado durável e auditoria; o desenho de tabelas e políticas fica para a especificação de dados. Não armazenar vídeos como blobs do banco.
- **Object storage privado compatível com S3:** originais, derivados e resultados, com referências imutáveis e política explícita de retenção.
- **Worker Python + fila durável:** Celery/RabbitMQ é uma opção de referência; sua adoção depende do ambiente de hospedagem. Workers CPU e GPU podem usar o mesmo contrato.
- **Uma única implantação modular inicial:** evitar Kubernetes, malha de agentes, banco vetorial e dezenas de microserviços antes de haver necessidade operacional.

Essa separação atende à recomendação do [FastAPI para computação pesada](https://fastapi.tiangolo.com/tutorial/background-tasks/). `BackgroundTasks` dentro do processo web não será tratado como fila durável de vídeos. O protótipo local pode usar execução por CLI; não precisa antecipar toda a infraestrutura do piloto.

### P3 — expansão do processamento híbrido e captura nativa

No aparelho: orientação de captura, checagem de corpo no quadro, armazenamento temporário e upload retomável. No backend: análise reproduzível, comparadores, histórico e controle de versões. Depois de validar equivalência numérica, mover operações selecionadas para o aparelho.

Para uso sozinho, testar suporte/tripé, temporizador, indicação legível/audível de início e uma curta captura de teste. O atleta deve descobrir que está cortando a cabeça/raquete antes de realizar a série completa. Nenhuma métrica pode depender de alguém seguindo o jogador com a câmera. Um retorno de recaptura traz uma ação concreta por vez, como afastar o celular ou incluir os pés; detalhes técnicos ficam disponíveis somente quando úteis.

[ONNX Runtime Mobile](https://onnxruntime.ai/docs/tutorials/mobile/) permite diferentes execution providers, mas desempenho depende de operadores e hardware. [LiteRT](https://developers.google.com/edge/litert) é outra rota para CPU/GPU/NPU. Não adotar NNAPI como investimento central novo: a própria [documentação Android o declara depreciado](https://developer.android.com/ndk/guides/neuralnetworks). Para Apple, avaliar Core ML e Vision em um spike, sem prender o contrato do backend a uma UI nativa específica.

## 4. Pipeline e contratos que protegem a UX

Fluxo proposto: `recebido → validando → pronto_para_fila → processando → concluido | parcial | precisa_nova_captura | falhou | cancelado`.

O estado de execução e a elegibilidade científica são campos diferentes: um job concluído pode produzir zero métricas elegíveis. O cliente deve explicar o motivo em linguagem simples; a API conserva a causa técnica para auditoria.

| Etapa | Entrada | Saída persistida | Possível interrupção |
|---|---|---|---|
| Ingestão | Arquivo e intenção de análise | Hash, mídia, dono, consentimento, original | Arquivo incompleto, limite de duração/tamanho, codec inválido |
| Qualidade | Frames, timestamps e protocolo | Qualidade por trecho e restrições | Corpo fora do quadro, movimento de câmera, blur excessivo |
| Alvo | Atleta escolhido | Identidade de tracking dentro do vídeo | Troca de pessoa/oclusão |
| Pose | Trechos elegíveis | Landmarks, scores e lacunas | Articulações essenciais não observáveis |
| Eventos | Pose, evidência visual e anotação | Intervalos e incerteza temporal | Contato não identificável |
| Métricas | Evidência elegível | Valor, unidade, definição, método e incerteza | Geometria/protocolo inadequados |
| Síntese | Métricas aprovadas e catálogo pedagógico | Achado ancorado no frame e uma ação | Evidência insuficiente ou instrução sem validação |
| Publicação | Relatório validado | Versão imutável exibível ao usuário | Inconsistência entre número, replay e texto |

Cada medida precisa carregar: identificador e versão da definição; espaço de coordenadas; unidade; instante/intervalo; lado corporal; protocolo; hash/versão do modelo e pós-processamento; flags de qualidade; elegibilidade; evidência de origem; natureza da incerteza. Um score de confiança do detector não é um intervalo de confiança da medida. Esta é uma decisão de arquitetura, a ser refinada com o protocolo de [Validade-cientifica](Validade-cientifica.md).

Comparações de evolução só são permitidas entre sessões compatíveis. Uma mudança de modelo ou definição pode exigir reprocessar ambos os vídeos. Mudanças incompatíveis de câmera, ângulo ou protocolo interrompem a comparação: reprocessar não recupera informação geométrica ausente; uma eventual ponte entre protocolos precisaria de validação própria. Não substituir o relatório anterior: publicar nova versão com linhagem.

## 5. Upload, fila e recuperação

**Upload:** o cliente recebe autorização curta para uma chave única; envia partes; confirma conclusão; o backend verifica integridade e metadados e marca o asset como pronto. A operação de solicitar análise é o único ponto que cria/enfileira a execução, conforme [Arquitetura-e-contratos](../04-Arquitetura/Arquitetura-e-contratos.md). Multipart permite reenviar apenas partes falhas, conforme a [documentação S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html). Limpar uploads abandonados por política, sem apagar originais confirmados por acidente.

URLs assinadas são credenciais temporárias. A documentação mostra que podem ser reutilizadas até expirar e que uma chave existente pode ser sobrescrita: portanto usar chaves novas, autorização por proprietário e não presumir consumo único. [Fonte S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html).

**Idempotência:** escopo por proprietário + mídia + configuração + versão do pipeline. Repetir uma requisição não duplica cobrança, trabalho publicado ou relatório. Não deduplicar silenciosamente vídeos de pessoas diferentes por hash global, pois isso pode vazar existência de arquivos.

**Execução:** assumir entrega ao menos uma vez. O [Celery](https://docs.celeryq.dev/en/stable/userguide/tasks.html) documenta redelivery, idempotência e nuances de `acks_late`; não oferece “exactly once” por mágica. Propor checkpoints, lease/heartbeat, tentativas limitadas, backoff e tratamento separado para falha transitória, mídia inválida e falta de memória.

**Commit de resultado:** gravar artefatos temporários, validar manifesto, promover uma referência final de modo atômico. Job reexecutado identifica artefatos concluídos. Um reconciliador recupera jobs órfãos; a ligação entre estado persistido e publicação na fila precisa de padrão outbox ou reconciliação equivalente.

**Cancelamento/exclusão:** verificar tombstone antes de cada etapa e antes da publicação; cancelamento deve impedir um retry tardio de recriar conteúdo excluído. Logs não contêm frames, tokens de acesso ou URLs assinadas. A política de retenção de backups deve tornar explícita a latência de eliminação.

## 6. Bola, raquete e 3D: sequência de investigação

**Bola:** o [TrackNet original](https://arxiv.org/abs/1907.03698) foi desenvolvido para vídeos de transmissão com objetos pequenos e rápidos. [TrackNetV4](https://github.com/TrackNetV4/TrackNetV4) é uma implementação oficial posterior com atenção ao movimento. Esses resultados não estabelecem desempenho em gravação lateral de celular. Construir primeiro avaliação própria com visibilidade anotada, erros de identidade, falsas detecções e lacunas; só então decidir treinamento/adaptação.

**Raquete:** bounding box ou máscara ajuda a localizar o objeto, mas não fornece por si só face da raquete, eixo do cabo e orientação 3D. Definir landmarks próprios e coletar rótulos. Ocultação e blur no impacto podem exigir frame rate/exposição diferentes; ausência de pixels não é resolvida adicionando um modelo maior. SAM pode acelerar anotação assistida, mas seus rótulos precisam de revisão humana independente.

**3D:** MediaPipe world landmarks, Apple Vision, SAM 3D Body e GVHMR produzem representações e convenções distintas. Criar adaptadores explícitos e comparar projeções/definições equivalentes. A [licença de GVHMR](https://github.com/zju3dv/GVHMR/blob/main/LICENSE) impede tratá-lo como componente comercial liberado. 3D só avança se reduzir erro de métricas escolhidas em referência adequada; animação mais convincente não é critério de aprovação.

## 7. Papel dos modelos multimodais

Proposta independente de fornecedor/modelo:

1. Receber JSON validado e apenas os frames/trechos necessários, após decisão explícita sobre processamento externo.
2. Recuperar explicações e exercícios de catálogo curado por especialista.
3. Produzir resposta estruturada: achado, evidências, limites, próxima ação e quando abster-se.
4. Validar que todos os números e comparações existem na entrada; bloquear criação de diagnóstico, dor inferida, personalidade ou estado psicológico presumido pela imagem.
5. Usar fallback determinístico quando falhar ou exceder custo/latência.

Escolher modelo por avaliação cega em português, ancoragem em evidência e taxa de afirmações sem suporte. Manter modelo/prompt/catálogo versionados. A aptidão do Claude para liderar frontend e a aptidão de um modelo para gerar orientações ao atleta são decisões diferentes; nenhuma marca recebe aprovação automática.

## 8. Licenças: código, pesos e dados separados

Inventário preliminar, **não liberação jurídica de distribuição**. Antes do piloto externo, arquivar licença e hash do artefato efetivamente utilizado. Um README de repositório não prova direitos de todos os datasets e checkpoints vinculados.

| Componente | Código | Pesos | Dados / ação pendente |
|---|---|---|---|
| MediaPipe | Repositório Apache-2.0 | Conferir termos/model card do `.task` escolhido; registrar hash | Direitos sobre dados de captura próprios e finalidade de uso precisam de registro |
| MMPose / RTMPose | Apache-2.0 do repositório | Licença do checkpoint específico e componentes associados deve ser verificada | COCO, AIC, WholeBody e outros têm origens/condições próprias; não generalizar Apache a tudo |
| SAM 2 | Código principal e treinamento Apache-2.0, componentes de terceiros separados | Checkpoints explicitamente Apache-2.0 no README | SA-V: vídeos e anotações CC BY 4.0; avaliação e terceiros têm licenças próprias |
| SAM 3 / SAM 3D Body | SAM License específica da Meta | Mesma família de licença nos materiais correspondentes | Dataset/artefato deve ser inspecionado individualmente; não herdar Apache do SAM 2 |
| GVHMR | Uso público restrito a educação/pesquisa/não comercial | Auditar pesos e dependências corporais separadamente | Excluir do produto comercial até direitos compatíveis documentados |
| TrackNetV4 | MIT no repositório | Não presumir que todo checkpoint vinculado herda a licença do código | Direitos de treino, vídeos de transmissão e redistribuição ainda precisam de verificação |
| Ultralytics | AGPL-3.0 ou termos Enterprise conforme uso | Revisar artefato e condições aplicáveis | Não presumir que dataset público autoriza todo treinamento/uso comercial |
| FFmpeg | LGPL-2.1+; opções/componentes podem tornar o build GPL | Não se aplica | Registrar build/configuração; codecs, distribuição e bibliotecas têm implicações próprias |

Fontes primárias: [MediaPipe LICENSE/repositório](https://github.com/google-ai-edge/mediapipe), [MMPose LICENSE](https://github.com/open-mmlab/mmpose/blob/main/LICENSE), [SAM 2](https://github.com/facebookresearch/sam2#license), [SA-V](https://github.com/facebookresearch/sam2/blob/main/sav_dataset/README.md), [SAM 3 LICENSE](https://github.com/facebookresearch/sam3/blob/main/LICENSE), [SAM 3D Body LICENSE](https://github.com/facebookresearch/sam-3d-body/blob/main/LICENSE), [TrackNetV4](https://github.com/TrackNetV4/TrackNetV4), [Ultralytics](https://www.ultralytics.com/license), [FFmpeg](https://ffmpeg.org/legal.html).

Não confundir AGPL com proibição absoluta de atividade comercial; a compatibilidade depende das obrigações e de como o produto é oferecido. Também não inferir direitos de uso de pesos exclusivamente a partir da licença do dataset: são artefatos distintos a revisar.

## 9. Custo e latência sem números inventados

Medir por sessão e por sessão **elegível**. Se muitos vídeos forem rejeitados depois de processamento caro, o custo por resultado útil cresce.

```text
N_frames = duração_s × fps_real
N_analisados = número efetivo de frames processados (registrado, não presumido)

C_sessão = CPU_s × tarifa_CPU_s
          + GPU_s_faturados × tarifa_GPU_s
          + GB_mês_retidos × tarifa_storage
          + GB_transferidos × tarifa_egress
          + requisições × tarifa_requisição
          + tokens_entrada/saída × respectivas_tarifas
          + minutos_revisão_humana × custo_minuto
          + parcela_de_infraestrutura_fixa

C_resultado_útil = custo_total_de_todas_as_tentativas / sessões_com_resultado_elegível

T_resultado = T_upload + T_fila + T_preprocessamento + T_inferência
            + T_métricas + T_render + T_síntese
```

Tarifas ficam como parâmetros até seleção de região/provedor e cotação datada. GPU faturada pode incluir inicialização, mínimo de cobrança e ociosidade; não usar apenas tempo do kernel. Medir p50/p95 por duração, aparelho, protocolo e concorrência. Reportar tempo de computação separado de upload e fila.

Orçamento de frames deve preservar eventos rápidos. Primeiro detectar regiões de interesse com custo baixo; avaliar alta resolução temporal no entorno do evento. Esse desenho só vale após verificar que o detector inicial não perde eventos importantes. Não reduzir fps globalmente e depois apresentar precisão de milissegundos incompatível com a amostragem.

## 10. Experimentos que autorizam a próxima etapa

| Experimento | Comparação | Evidência para decidir |
|---|---|---|
| E01 — qualidade de captura | Protocolos/aparelhos/luz | Proporção de clipes utilizáveis, causas de falha e tempo para recaptura |
| E02 — pose | MediaPipe × RTMPose sobre mesmo conjunto | Erro contra anotação de referência, falhas por articulação, cobertura elegível, custo e latência |
| E03 — estabilidade temporal | Série bruta × filtros definidos | Atraso introduzido, erro dos eventos, supressão indevida de picos e comportamento em lacunas |
| E04 — corpo em 3D | Baseline × candidato 3D | Ganho em medidas predefinidas contra referência; não apenas mesh visual |
| E05 — bola/raquete | Rótulo humano × candidato temporal | Recall por evento, falsas detecções, erro temporal e domínio de captura aceito |
| E06 — experiência operacional | Upload interrompido, retry, worker perdido, exclusão | Nenhuma duplicação/publicação indevida; recuperação rastreável; tempo e custo medidos |
| E07 — narrativa | Template × modelo multimodal | Fidelidade aos números, compreensão em PT-BR, utilidade da ação e afirmações sem evidência |

Split bloqueado por atleta, mantendo todas as sessões, tentativas e frames de uma pessoa na mesma partição, com conjunto final congelado; não dividir frames vizinhos entre treino e teste. Definir critérios antes de observar resultados. Metas e tamanho amostral são decisões conjuntas de produto e ciência, detalhadas no protocolo específico; nenhuma porcentagem de acurácia é assumida aqui.

## 11. Capacidade local observada

Em 2026-11-01, inspeção limitada e somente leitura encontrou macOS arm64, Python 3.12, `uv`, `ffmpeg`, `ffprobe`, `node`, `docker` e `xcodebuild` no PATH. Isso **não comprova** Docker daemon ativo, Xcode completo, GPU compatível, dependências de ML instaladas ou desempenho de inferência. Memória e modelo do processador não foram obtidos pelo comando disponível. O primeiro spike deve medir o hardware real antes de propor gasto com nuvem.

## 12. Decisões recomendadas para revisão com Claude e usuário

1. Aceitar a separação captura → evidência → métrica → explicação como contrato central.
2. Escolher um movimento/protocolo inicial com o time científico, mantendo bola e 3D como experimentos independentes.
3. Construir primeiro P1 local com revisão humana da equipe de pesquisa e métricas abstendo-se quando necessário. O piloto para atleta sozinho só avança quando a captura autoguiada e a compreensão do feedback passarem na avaliação sem ajuda em quadra.
4. Claude define a apresentação de estados, evidências e recaptura; Codex define contratos, rastreabilidade e critérios de elegibilidade.
5. Só iniciar plataforma multiusuário e inferência móvel após medir qualidade, tempo e custo do baseline.
6. Manter registro de modelos, licenças, datasets, execuções e decisões no vault; segredos e vídeos pessoais não entram nas notas de planejamento.

Todas as fontes web desta nota foram consultadas em **2026-11-01**. Links para branches principais são mutáveis: na implementação, fixar commit/tag e arquivar a licença do artefato utilizado. Não foi feita alegação de que o inventário esgota todos os modelos existentes.

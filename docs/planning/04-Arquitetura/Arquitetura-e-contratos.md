---
tipo: especificacao
status: rascunho
versao: 0.1
data: 2026-11-01
responsavel: Codex
---

# Arquitetura e contratos

## Fronteiras do sistema

Proposta de monólito modular com processamento assíncrono. A implementação começa por uma bancada offline; só depois recebe os componentes de operação multiusuário. A seleção fundamentada das bibliotecas e suas fontes está em [Stack-e-modelos](../02-Pesquisa/Stack-e-modelos.md). As entidades abaixo são conceitos de domínio, não desenho de tabelas ou migrações.

| Camada | Responsável | Entrada → saída | Critério de qualidade |
|---|---|---|---|
| Captura autoguiada | Claude lidera experiência; Codex define elegibilidade | Intenção, preview, arquivo → mídia e contexto de captura | Usuário sozinho consegue filmar; erro acionável |
| Ingestão | Codex/backend | Arquivo → inventário, hash, autorização e asset | Original íntegro, proprietário correto, limites aplicados |
| Qualidade | CV/data science | Mídia → trechos suportados, flags e motivos | Bloqueia condições conhecidas de erro; cobertura medida |
| Pose e eventos | CV/data science | Frames/PTS → landmarks e eventos com lacunas | Erro por tarefa, aparelho e população conhecido |
| Métricas | Biomecânica + data science | Evidências → grandeza com unidade e definição | Mensurando explícito e validação específica |
| Política de apresentação | Backend + ciência | Métricas e registro de validação → campos exibíveis | Não libera pesquisa como medida validada |
| Educação | Especialista humano + produto | Evidência elegível → conteúdo revisado | Limites e linguagem corretos; uma prioridade |
| Explicação opcional | Adaptador de LLM | Dados aprovados + catálogo → texto estruturado | Nenhum número/causa sem suporte; fallback de template |
| Histórico | Backend | Sessões e proveniência → comparação elegível | Mesmo protocolo/definição ou ponte validada |
| Interface | Claude Opus | Contratos e estados → experiência | Compreensão e autonomia, inclusive na falha |

Fluxo: **arquivo original → normalização rastreável → qualidade → seleção do praticante → pose → eventos → medidas → elegibilidade → evidência e explicação → histórico**. Cada etapa pode encerrar sua parte sem impedir o replay do arquivo quando ele é legível.

## Objetos de domínio

- **Praticante:** identidade de acesso separada de perfil mínimo de treino; mão dominante e preferências, sem cadastro clínico no piloto.
- **Sessão:** intenção, golpe, tipo de exercício, dispositivo e protocolo de captura. Um vídeo pode conter várias tentativas.
- **Asset:** original ou derivado, dono, hash, tamanho, relação de origem, duração/PTS, transformação e política de retenção.
- **Execução:** configuração imutável de pipeline, entradas e versões, estado e artefatos. Reprocessar cria uma execução nova.
- **Tentativa:** intervalo temporal, golpe/lado, qualidade, eventos e exclusões com razões.
- **Métrica:** definição/versão, valor ou ausência, unidade, espaço de coordenadas, método, incerteza, elegibilidade e evidências.
- **Relatório:** snapshot imutável de medidas e mensagens liberadas; revisão posterior gera nova versão.
- **Comparação:** sessões selecionadas, resultado da verificação de compatibilidade, dados agregados e limite da interpretação.
- **Conteúdo educativo:** texto, finalidade, evidências, limites, autor/revisor e versão.
- **Escolha de uso dos dados:** finalidade, texto apresentado, versão e histórico de revogação; base legal definida na etapa especializada.

Vídeos ficam em storage de objetos privado, nunca em URLs públicas permanentes. O vault recebe apenas documentação e resultados agregados/sem identificação. Detalhamento de persistência, políticas de acesso e migrações será uma tarefa própria após fechar o domínio.

## Ciclo de vida: duas dimensões independentes

Execução: `created → uploading → queued → running → succeeded | failed | cancelled`. `deleting → deleted` trata a remoção e seus derivados. Upload incompleto não pode entrar no processamento. Retries limitados não reabrem um objeto excluído.

Resultado científico, avaliado por métrica: `reportable | research_only | insufficient_evidence | unsupported`. Um job `succeeded` pode ter todas as métricas como `insufficient_evidence`. Relatório parcial significa que algumas observações são utilizáveis; não significa converter lacunas em zero.

Comparação: `comparable | insufficient_history | incompatible | below_detectable_change | detectable_change`. As duas últimas dependem de comparabilidade e erro de repetição demonstrados. “Detectable change” não equivale a “melhora”.

## Contrato mínimo de uma medida

| Campo | Regra |
|---|---|
| `metric_id`, `definition_version` | Nome semântico estável; alterações de fórmula mudam versão |
| `status` | Uma das quatro condições científicas acima |
| `value`, `unit` | `null` quando não exibível; nunca substituir ausência por 0 |
| `measurement_space` | Ex.: `image_2d_projected`; não converter para `anatomical_3d` por renomeação |
| `body_side`, `phase_id` | Lado anatômico e fase definida; mão dominante não determina sozinha perna da frente |
| `evidence` | `asset_id`, tempo original, índices/PTS de origem, landmarks e transformação aplicada |
| `uncertainty` | Tipo, método e referência; `null`/`not_established` até calibrar; não reciclar score de pose |
| `quality_reasons` | Códigos estáveis e mensagem legível; motivos podem ser locais a uma articulação |
| `n_attempts`, `n_valid`, `n_rejected` | Denominadores e exclusões; não selecionar apenas melhores repetições |
| `validation_ref` | Relatório e domínio exatos que autorizam a apresentação da métrica |
| `pipeline_ref` | Modelo/pesos/preprocessamento/filtro/código; versões fixas |

Os JSONs em `04-Arquitetura/exemplos` são **fixtures simuladas para revisão de estados**, não medições ou contrato de produção final. Não exibem um grau inventado como resultado válido.

## API proposta para discussão

| Operação | Contrato e comportamento esperado |
|---|---|
| `POST /v1/sessions` | Cria sessão do usuário autenticado com intenção e protocolo; chave de idempotência |
| `POST /v1/sessions/{id}/uploads` | Autoriza upload em chave exclusiva, com limite de bytes/duração; resposta nunca vaza outro usuário |
| `POST /v1/uploads/{id}/complete` | Confirma integridade e promove asset a `ready`; não enfileira análise; duplicata retorna o mesmo asset |
| `POST /v1/sessions/{id}/analyses` | Único disparo da análise: cria/enfileira execução idempotente sobre asset `ready`; `202` + identificador; cliente não escolhe unilateralmente política científica |
| `GET /v1/analyses/{id}` | Estado de execução, etapa e recuperação; progresso indeterminado quando não estimável |
| `GET /v1/sessions/{id}/reports/{version}` | Snapshot, medidas elegíveis, evidências e motivos de ausência |
| `POST /v1/comparisons` | Verifica compatibilidade antes de produzir diferença; motivos explícitos |
| `POST /v1/sessions/{id}/corrections` | Registra contestação/anotação; preserva proveniência e dispara revisão/reprocessamento quando aplicável |
| `POST /v1/exports` | Exportação assíncrona dos recursos autorizados; link temporário |
| `DELETE /v1/sessions/{id}` | Aceita exclusão, impede novas leituras/jobs e acompanha propagação; não afirmar conclusão só por responder `202` |

Exclusão bloqueia novas leituras da API imediatamente. Links já emitidos usam TTL curto e têm revogação/remoção do objeto e invalidação de cache conforme o mecanismo de entrega; o relatório de exclusão acompanha essa propagação. Não prometer revogação instantânea de URL pré-assinada sem mecanismo que a imponha.

Identificadores opacos, autorização em cada recurso, paginação de histórico e erros estruturados `{code, message, retryable, request_id}`. Novas propriedades podem ser aditivas; mudanças semânticas em medidas e enumerações exigem política de compatibilidade acordada com Claude. Documentar OpenAPI e validar fixtures no início da implementação.

## Mídia, tempo e recuperação

Guardar original; proxies não substituem evidência. Registro de transformação inclui rotação, crop, escala, espelhamento, estabilização e mapeamento proxy→PTS original. Frames interpolados podem servir a reprodução, mas não à avaliação temporal. A contagem de frames do contêiner não corrige uma câmera lenta exportada sem metadados.

No laboratório, FFmpeg/FFprobe e scripts versionados. No serviço: worker isolado do processo web, quotas, timeout, memória limitada, entradas tratadas como não confiáveis e decodificação sem acesso arbitrário à rede. Upload retomável, fila com entrega ao menos uma vez, idempotência e promoção atômica de resultados. Recuperar falhas transitórias; solicitar recaptura para falha de evidência. Detalhes operacionais e fontes oficiais em [Stack-e-modelos](../02-Pesquisa/Stack-e-modelos.md).

## LLM como explicador

Contrato de saída: `observation`, `evidence_ids`, `limitation`, `next_action`, `content_version`. Nenhum cálculo ou nova grandeza é delegado ao texto livre. A primeira implementação pode funcionar só com templates revisados. Se usar LLM, validar referências e números, impor limites de saída, rejeitar instruções presentes em texto/áudio do vídeo e impedir acesso a ferramentas de mutação. Frames externos só quando necessários e compatíveis com a política de dados escolhida.

Escolher fornecedor/modelo por avaliação cega: compreensão em português, fundamentação, abstenção, segurança do conteúdo, custo e latência. Não contratar um modelo apenas por ser o mais novo; o Claude liderar UX não obriga a usar Claude no produto. Não existe ensemble ou orquestração de vários modelos em cada sessão por padrão.

## Operação e custo

Métricas internas: tempo total e por estágio, p50/p95 de processamento, fila, falhas por codec/aparelho, cobertura por métrica, recapturas, custos de inferência/storage/egress/revisão e erros de relato. Sem frames, dados sensíveis ou URLs de acesso em logs comuns.

`custo_por_sessao = computacao + armazenamento_na_janela + transferencia + LLM_opcional + revisao_humana + parcela_de_falhas/retries`.

Medir também custo por ciclo útil, incluindo sessões que falham. SLO e preço só após benchmark e orçamento. Hipótese de UX: relatório de clipe de até 60 s em até 2 min de processamento no p95, excluindo upload, será testada; o tempo completo percebido inclui o upload e também é acompanhado. Isso não é desempenho prometido.

O sistema pode gravar e guardar uma sessão sem internet; quando depender de servidor, mostra claramente que a análise está pendente. “Captura offline” não implica “toda a IA offline”. Plataforma mobile e stack de UI permanecem decisões do Claude com evidência de captura nos aparelhos escolhidos.

## Condições de saída para o piloto

Controle de acesso, exclusão, recuperação de upload, idempotência, troca de versão, relatório parcial e abstenção testados. Modelos/pesos/dados com permissões documentadas. Nenhuma métrica de pesquisa exibida como validada. Conteúdo revisado. Backup e restauração ensaiados. Requisitos completos em [Plano-de-validacao](../05-Validacao/Plano-de-validacao.md).

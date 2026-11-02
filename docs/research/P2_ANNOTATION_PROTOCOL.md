# P2 — protocolo de referência e avaliação de keypoints

Estado: ferramenta local de pesquisa, não validação em atletas. Nenhum dado
humano, anotação humana ou resultado em vídeo real foi produzido por DS-02.
Este protocolo operacionaliza o [contrato P2](../P2_POSE_LAB.md), usando como
base as notas já existentes de [validade científica](../planning/02-Pesquisa/Validade-cientifica.md),
[plano de validação](../planning/05-Validacao/Plano-de-validacao.md) e
[catálogo de métricas](../planning/04-Arquitetura/Catalogo-de-metricas.md).
Não acrescenta revisão bibliográfica nem transforma metas propostas em gates
científicos cumpridos.

## Seleção e partições antes de olhar erros

1. Registrar clipes consentidos, atleta pseudonimizado, sessão, hash, partição,
   vista/aparelho/luz e todos os motivos de exclusão em armazenamento restrito.
   Vídeos, frames, landmarks reais, identidades e consentimentos não entram no Git.
2. Separar treino/desenvolvimento, calibração e teste bloqueado por **atleta**.
   Todas as sessões, recortes, frames e aumentações da mesma pessoa permanecem
   na mesma partição; deduplicar hash e conteúdo antes da separação. Aumentações
   ficam no treino. Reservar também condições de captura não vistas quando o
   desenho permitir. Histórico futuro nunca alimenta adaptação no passado.
3. Pré-selecionar por atleta/tentativa e fase do saque um conjunto de frames com
   PTS originais, incluindo preparação e demais fases definidas no manual humano.
   Registrar regra, semente de amostragem e cotas antes da comparação de modelos.
   Incluir oclusão, blur, saída de quadro, vários jogadores e falhas do detector;
   não selecionar apenas poses confiantes ou frames com detecção bem-sucedida.
4. Manter separadas a amostra representativa predeterminada e uma auditoria
   adicional de falhas/picos escolhidos pelo modelo. A segunda não estima sozinha
   o desempenho global. Congelar protocolo, modelos e parâmetros antes do teste;
   após ajuste motivado pelo holdout, exigir novo teste independente.

Atleta é a unidade agrupadora. Apresentar denominadores por atleta, fase e
articulação e, em estudo futuro, intervalos com reamostragem agrupada por
atleta/sessão ou modelo estatístico apropriado. Milhares de frames de uma pessoa
não representam milhares de pessoas. O avaliador atual retorna apenas um resumo
de pontos da entrada; não implementa estratificação, intervalos ou generalização.

## Dois anotadores independentes e adjudicação

Preparar manual versionado: definição operacional de cada landmark COCO17,
lado anatômico do atleta, plano de display após rotação/SAR, regra de visibilidade
e definição humana das fases. Fazer rodada de treinamento em desenvolvimento,
resolver ambiguidades e congelar o manual antes da rodada de teste.

Os anotadores A e B recebem o mesmo frame/imagem e o alvo indicado, em trabalhos
separados. Ocultar landmarks, esqueleto, confiança e coordenadas do modelo e a
anotação do colega. Confirmar visualmente o atleta em cada frame: `selected` é
associação geométrica heurística, não identidade verificada. Não usar o modelo
como rascunho da referência independente. Preservar os originais de A e B com
ID pseudônimo, versão do manual e hash em registro restrito; `reviewed` é uma
declaração do produtor do arquivo, não comprovação automática da revisão humana.

Cada arquivo contém os **17 pontos ordenados** por frame. Marcar `visible` e x/y
finitos quando o landmark puder ser localizado conforme o manual; `occluded` ou
`out_of_frame` exigem x/y nulos. Não adivinhar ponto invisível por simetria ou
interpolação. `unreviewed` e x/y nulos significam trabalho pendente; uma referência
com status `reviewed` não pode conservar ponto `unreviewed` e exige `annotator_id`.
Se um landmark visto não puder ser localizado conforme o manual, deixar o frame
pendente e registrar a ambiguidade fora do contrato, sem inventar coordenadas.

Medir discordância de A/B sobre posição, visibilidade, alvo e fase antes do
consenso. Adjudicar divergências com revisão conjunta ou terceiro revisor;
preservar ambas as versões e a justificativa da decisão. Não resolver toda
discordância automaticamente pela média. Um anotador fornece uma referência
operacional individual: não estabelece concordância entre avaliadores, erro da
referência ou validade biomecânica. O consenso também tem incerteza.

O template exporta somente frames selecionados e **nunca copia previsão**. A
amostra independente deve incluir também frames de perda/falha: preparar uma
entrada no mesmo formato a partir da lista predeterminada de frames, com
`detection_id: null` quando não houver previsão correspondente ao atleta. Um ID
textual ausente no frame também é avaliado como previsão faltante. O frame em si
precisa existir no artefato com o mesmo PTS/dimensões, inclusive com `detections: []`.
Reutilizar referência para outro modelo exige correspondência de detecção
revisada por humano e registrada fora do formato; IDs não identificam pessoas
entre frames ou modelos. Não atribuir ao modelo outro jogador para eliminar
uma falha do denominador. Associação errada e falso positivo precisam de uma
auditoria própria; não são estimados por este resumo de keypoints.

## Leitura do avaliador

`evaluate_keypoints(artifact, annotations)` exige o mesmo asset, time_base textual,
plano, schema, frame, PTS e dimensões. Frações temporalmente equivalentes, mas
serializadas de modo diferente, são rejeitadas para evitar normalização implícita
do vínculo. Frames anotados podem ser um subconjunto ordenado; ausência de
anotação exclui esse frame, ausência de previsão não exclui referência visível.
Um leitor de JSON deve rejeitar chaves textuais duplicadas antes de produzir o
dict: depois de sobrescritas pelo parser, a função não consegue recuperá-las.
O módulo rejeita IDs/names repetidos nos registros, campos desconhecidos, coerção
de tipos e NaN/Infinity em qualquer nível dos dois dicionários.

Para cada referência marcada `visible`, comparar as coordenadas do mesmo ponto
da detecção vinculada, por distância euclidiana em pixels de display. Pontos
ocultos/fora de quadro da referência ficam fora desse denominador. Score,
visibility e presence do modelo não determinam visibilidade da referência nem
filtram as falhas. Previsão finita fora da imagem continua sendo comparável e
recebe seu erro, sem clamp; isso não a declara visível. Uma previsão nula ou
detecção ausente conta como `missing_predictions`.

| Saída | Significado |
|---|---|
| `reference_points` | Referências visíveis revisadas |
| `matched_points` | Referências visíveis com previsão x/y finita |
| `missing_predictions` | Referências visíveis sem previsão correspondente |
| `mean_error_px`, `median_error_px` | Erro somente dos pontos comparáveis |
| `coverage` | `matched_points / reference_points` |

Sempre `reference_points = matched_points + missing_predictions` para referências
revisadas. Publicar erro e cobertura/contagens juntos: erro baixo em poucos pontos
não estabelece bom desempenho. Resoluções distintas afetam pixels; este resumo
não normaliza escala, calcula PCK/OKS ou compara aparelhos sem estratificação.
Coordenadas finitas cujo erro exceda a representação numérica causam rejeição
explícita, nunca saída Infinity.

- `unreviewed`: `not_evaluated`, contagens zero, métricas nulas,
  `annotations_unreviewed`; rótulos parciais não entram nas contagens.
- Zero referências visíveis (inclusive subconjunto vazio): `not_evaluated`,
  contagens zero, cobertura/erros nulos, `no_visible_reference_points`.
- Referências visíveis, nenhuma previsão: `computed`, cobertura 0, erros nulos,
  todas `missing_predictions`, razões `missing_predictions` e
  `no_matched_predictions`. Isso é ausência de saída, não erro zero.
- Com pontos comparáveis: `computed`, erro dos comparáveis e cobertura; se houver
  faltantes, razão `missing_predictions`. `computed` indica cálculo concluído.

`validation_ref` permanece nulo em todas as saídas. Nenhum limiar de aceitação
científica é aplicado. Seleção heurística, confidência e erro de referência são
questões distintas; testes sintéticos demonstram propriedades do código.

## Papel de M01 e limites de ângulos ideais

M01 (`front_knee_projected_flexion_peak`) é uma candidata de pesquisa: pico de
flexão **projetada 2D** do joelho da frente dentro de preparação anotada. Não é
flexão anatômica 3D, nota técnica ou medida automática liberada. Erro posicional
COCO17 não estabelece erro angular, fase correta, perna correta, pico verdadeiro,
repetibilidade de aquisição ou mudança individual acima do ruído.

Em estudo futuro, avaliar separadamente landmarks e ângulo nos frames
predeterminados, detecção do pico na janela completa, referência de fase/lado e
concordância/repetibilidade. Uma lacuna capaz de esconder o pico invalida a
tentativa; não interpolar ou escolher o máximo restante. P2 não conecta pose
inferida a M01 e não reclassifica inferência como anotação manual/sintética.

Associação populacional entre flexão e desempenho não fornece ângulo ideal
individual nem demonstra que aumentar flexão melhora um saque. Não produzir
coaching automático, score, diagnóstico, alegação de prevenção de lesão ou
promessa de evolução. Relatórios públicos P1 preservam `value: null`; eventual
liberação exige validação própria e revisão científica humana.

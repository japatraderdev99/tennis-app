---
tipo: catalogo
status: candidatos-experimentais
versao: 0.1
data: 2026-11-01
---

# Catálogo de métricas

**Nenhuma medida biomecânica deste catálogo está validada para o nosso app.** Nomes e fórmulas são propostas para pré-registro e discussão. Status inicial de todas as medidas automáticas esportivas: `research_only`. [Validade-cientifica](../02-Pesquisa/Validade-cientifica.md) contém as fontes e a justificativa científica.

| ID | O que descreve | Unidade e resumo | Pré-condição | Limite |
|---|---|---|---|---|
| Q01 `capture_coverage` | Fração de frames da fase com articulações necessárias observáveis | Proporção 0–1, numerador/denominador; UI pode preferir mensagem | Rótulos de observabilidade e critério de qualidade calibrados | Qualidade do vídeo; não nota da técnica |
| M01 `front_knee_projected_flexion_peak` | Maior flexão aparente 2D do joelho da frente dentro da preparação | Graus por tentativa; mediana e IQR das válidas | Vista lateral, hip/knee/ankle visíveis, fase/perna confirmadas, filtro validado | Não é flexão anatômica 3D; maior não significa melhor |
| M02 `preparation_event_interval` | Tempo entre dois eventos visuais operacionais | Segundos por tentativa; mediana e IQR | Eventos definidos e validados; PTS e proveniência temporal | Não chamar de tempo de impacto nem tempo de reação |
| M03 `within_session_dispersion` | Dispersão entre tentativas de uma métrica liberada | IQR na unidade original, com n válido | Mesma tarefa e pelo menos n mínimo pré-registrado; hipótese inicial n≥5 | Menor variação não demonstra aprendizado ou técnica melhor |
| R01 `self_reported_in_rate` | Tentativas declaradas dentro pelo praticante | Dentro/(dentro+fora); desconhecidas separadas | Usuário informa resultado; esforço/tarefa comparáveis | Não é juiz de linha nem mensuração independente |
| H01 `between_session_change` | Diferença do mesmo resumo entre duas sessões | Unidade original + incerteza do resumo | Compatibilidade e erro test-retest do resumo estimados | Mudança detectável não implica melhora ou causalidade |

## Definição inicial de M01

Com `H = quadril`, `K = joelho`, `A = tornozelo` do mesmo lado na imagem corrigida para aspecto/rotação:

`theta = acos(clamp(dot(H-K, A-K)/(norm(H-K)*norm(A-K)), -1, 1))`.

`flexao_projetada_graus = 180 - theta * 180/pi`.

Rejeitar vetores degenerados, lacunas e lado ambíguo. Coordenadas normalizadas x/y precisam ser convertidas ao mesmo sistema métrico de imagem; não usar diretamente em tela retangular. Definir a janela de preparação por anotação no primeiro experimento. O filtro, sua janela e efeito no pico serão fixados depois do conjunto de desenvolvimento e antes do holdout. Guardar séries bruta e filtrada e frame de evidência. Exigir cobertura da janela crítica: se uma lacuna puder ocultar o verdadeiro pico, invalidar a tentativa segundo critério pré-registrado. Não escolher o máximo dos frames restantes como se fosse o máximo do movimento, nem atravessar a lacuna com interpolação silenciosa.

**Importante:** esta medida indica o que a câmera vê. Variação de azimute altera o resultado. A aprovação depende de mostrar que pessoas conseguem repetir o protocolo sem assistência e que a incerteza é menor do que a mudança que queremos acompanhar. Não exibir alvo universal de graus nem instruir “flexione mais”.

## Definição a fechar de M02

Não liberar um campo chamado apenas “ritmo”. No experimento, avaliar candidatos como início visível da flexão de preparação → pico da flexão projetada. O evento inicial exige critério de deslocamento/duração e referência de anotação, ainda pendentes. Se dois anotadores não conseguem concordar, redefinir ou descartar a medida.

`intervalo = PTS_evento_final - PTS_evento_inicial`. Não usar `frame_index / fps_nominal` em vídeo variável ou alterado. Uma inferência de contato baseada só no punho não satisfaz referência visual bola–raquete. Para a primeira UI, replay por fases pode existir antes de M02.

## Histórico que não engana

Comparar mesma pessoa, golpe, exercício, tipo de saque, lado/perna, vista e protocolo, condições de câmera dentro da tolerância validada e versões compatíveis. Registrar esforço/intenção, aparelho, distância/altura aproximadas e mudanças relevantes; nem todo fator precisa aparecer no formulário inicial, mas a falta de um fator indispensável impede a comparação.

MDC/erro de repetição é estimado para **o resumo exato** exibido. Não aplicar MDC de uma repetição à mediana de uma sessão automaticamente. Incerteza não estabelecida significa que a UI ainda não pode afirmar “mudança detectada”.

Respostas possíveis: “ainda precisamos de outra sessão”, “o enquadramento mudou”, “não identificamos diferença acima da variação esperada” e “houve mudança nesta medida”. A conclusão “melhorou” depende também de relevância e resultado. Não transformar 38→41° em +7,9% de qualidade técnica.

## Adiados até evidência própria

Separação quadril–ombro 3D, rotação interna do ombro, pronação do antebraço, orientação da face da raquete, velocidade real da raquete/bola, spin, forças/torques/potência e prevenção de lesões. Um número não entra no produto porque consta em animação, no dicionário de outro app ou em landmarks chamados “world”.

Fontes principais: [Validade-cientifica](../02-Pesquisa/Validade-cientifica.md), [Stack-e-modelos](../02-Pesquisa/Stack-e-modelos.md). Cada medida promovida a `reportable` exige uma nota de experimento com dados, divisão por atleta, resultados de erro/cobertura, limitações, revisor e versão no [Registro-de-decisoes](../06-Decisoes/Registro-de-decisoes.md).

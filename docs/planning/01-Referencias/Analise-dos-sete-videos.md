---
tipo: analise-de-referencias
status: inspecionado
data: 2026-11-01
responsavel: Codex
---

# Análise dos sete vídeos

## Método e limites

Inventariei os sete MOVs originais, calculei SHA-256 e examinei sequências visuais distribuídas por toda a duração: **217 quadros amostrados a cada aproximadamente 2 segundos, organizados em 21 folhas de contato**. Li as legendas e elementos visuais dessas sequências e processei todo o áudio localmente com `faster-whisper-small`, em inglês. As transcrições automáticas foram lidas e confrontadas com as legendas para os pontos usados nesta proposta. Isso é inspeção audiovisual por amostragem e transcrição; não é uma revisão humana quadro a quadro de cada frame, nem execução dos aplicativos mostrados.

O total é **433,30 s — aproximadamente 7 min 13 s**. São gravações de tela, majoritariamente próximas de 60 fps no contêiner, com dimensões e proporções diferentes. Esses fps **não demonstram a frequência da captura original do gesto**. Nenhum arquivo constitui aqui um dataset validado de biomecânica de um atleta.

Arquivos originais continuam na pasta pai do vault, sem alteração. `inventario-videos.json` registra nomes, duração, streams e hashes. `contatos/` e `frames/` contêm derivados de inspeção; `transcricoes/` contém o ASR bruto. V02 e V06 não produziram segmentos de fala reconhecida; isso não prova ausência absoluta de som ou fala. Música/ruído não foram catalogados.

**Correção de ASR relevante:** em V01, 20–26 s, a transcrição produz “1,500th of a second”, enquanto a legenda visual informa **0,15 s**. Usar a legenda para descrever o vídeo, sem tratar esse número como medição nossa. O ASR bruto foi preservado. Nomes próprios, números e tempos não revisados não são fonte científica.

## Inventário e leitura

| ID | Nome original | Duração | Conteúdo identificado |
|---|---|---:|---|
| V01 | ScreenRecording_11-01-2026 12-36-03_1.mov | 95,10 s | SportArc: animação 3D do forehand e cadeia cinética |
| V02 | ScreenRecording_11-01-2026 13-31-35_1.mov | 14,39 s | Animação 3D de backhand de duas mãos; marca gráfica consistente com SportArc, autoria não confirmada por conta visível |
| V03 | ScreenRecording_11-01-2026 13-45-19_1.mov | 21,19 s | Publicidade TennisCut: trajetória, corte, seleção e exportação |
| V04 | ScreenRecording_11-01-2026 13-54-14_1.mov | 65,45 s | SportArc: explicação ilustrada de cadeia cinética no saque; selo de conteúdo de IA visível |
| V05 | ScreenRecording_11-01-2026 13-56-23_1.mov | 51,80 s | Ilustração sobre pronação/empunhadura no saque; conta não identificável no recorte |
| V06 | ScreenRecording_11-01-2026 13-57-37_1.mov | 30,66 s | Personagem 3D e passos do forehand; marca gráfica consistente com a série, autoria não confirmada no recorte |
| V07 | ScreenRecording_11-01-2026 13-59-45_1.mov | 154,70 s | Peça editorial ilustrada sobre matemática, geometria, física, psicologia e autonomia no tênis |

Os tempos abaixo são aproximados; são marcadores de revisão da referência, não timestamps de eventos biomecânicos.

## V01 — compreensão da cadeia cinética

- **0–15 s:** forehand animado, ponto de contato congelado e câmera lenta. O primeiro ganho de comunicação é isolar um instante e conduzir a atenção.
- **15–44 s:** trajetória da raquete e gráficos de velocidade; aparecem 96 km/h e velocidades segmentares. Não há aquisição real, instrumento de referência, amostra ou método que permita verificar esses números.
- **44–70 s:** vista superior para a sequência quadril/tronco/raquete e separação de 28°. A rotação livre do avatar facilita explicar um conceito; uma vista virtual não é evidência adicional de um vídeo monocular.
- **70–84 s:** contato apresentado como aproximadamente 5 ms e mensagem sobre gerar movimento pela cadeia corporal. Não converter isso em uma medição possível com esta gravação de tela.
- **84–95 s:** pergunta ao público e identificação SportArc/Auto Cut; final inclui controles do telefone.

**Aproveitar:** foco visual por segmento, pausa no evento, um gráfico contextual e alternância entre velocidade normal e lenta. **Não importar como regra:** alvo universal de 28°, velocidade esperada ou relação causal de potência; exigem investigação própria.

## V02 — trajetória do backhand

Mostra preparação, descida da raquete, aceleração e finalização de um backhand de duas mãos, com trilha da raquete. A peça permite entender continuidade; não mostra entrada de vídeo, extração de pose ou parâmetros individuais.

**Aproveitar:** sobreposição discreta e replay de uma repetição. No futuro, backhand de uma e duas mãos serão tarefas distintas. Não comparar o corpo do usuário com esse avatar como padrão anatômico.

## V03 — o fluxo efetivo de um produto

- **0–8 s:** filmagem de quadra e trajetória desenhada sobre a bola.
- **8–14 s:** lista de pontos/rallies, contagem exibida de 41 e favoritos.
- **14–21 s:** salvamento/exportação e marca TennisCut.

É a demonstração mais concreta de uma tarefa de app no conjunto: encontrar momentos e reduzir trabalho de revisão. O vídeo não prova taxa de acerto, detecção exata do quique, velocidade ou análise articular.

**Aproveitar:** o usuário encontra rapidamente algo reconhecível no próprio vídeo. A nossa proposta acrescenta uma camada de interpretação mensurável somente onde houver validação. A página oficial diferencia recursos disponíveis dos anunciados para o futuro; ver [Produto-mercado-e-privacidade](../02-Pesquisa/Produto-mercado-e-privacidade.md).

## V04 — narrativa do saque e revisão editorial necessária

- **0–16 s:** contrapõe coordenação a esforço excessivo; a linguagem faz afirmações amplas sobre amadores e cansaço.
- **16–39 s:** desenhos de transferência de peso, componente vertical e horizontal do movimento.
- **39–58 s:** encadeamento e deslocamento após contato. Alguns quadros ilustram ações que parecem golpes de fundo enquanto o áudio continua tratando de saque; não os adotar como demonstração biomecânica inequívoca.
- **58–65 s:** referência a velocidade de profissionais e movimento para dentro da quadra.

**Aproveitar:** setas, comparação espacial e explicação por etapas. **Submeter à revisão científica:** formulações de que saltar verticalmente “desperdiça” força, de transferir inteiramente o peso e de que o deslocamento após contato seria “prova” de eficiência. A animação não estabelece essas conclusões, e copiá-las para um praticante solo seria uma decisão de treino sem validação.

## V05 — pronação e risco de simplificação

- **0–14 s:** associa velocidade à pronação tardia e compara com abertura precoce da face da raquete.
- **14–31 s:** mostra empunhadura continental e subida com a borda da raquete.
- **31–52 s:** representa rotação do antebraço e posição final das cordas como explicação de potência.

**Aproveitar:** zoom conceitual no detalhe e contraste entre fases. **Não transformar em comando automático:** “gire explosivamente no último instante”. Orientação da raquete, rotação do ombro, pronação e flexão do punho precisam de definições separadas. Três landmarks do braço não resolvem todos esses eixos. É um bom exemplo de tema educativo a estudar, com mensuração fora do MVP.

## V06 — didática de baixa carga cognitiva

**0–8 s:** posição de espera; **8–17 s:** preparação e giro em unidade; **17–23 s:** golpe; **23–31 s:** retorno à posição de espera. Chamadas curtas aparecem junto ao movimento.

**Aproveitar:** uma instrução no momento relevante, sem painel permanente. Para Claude, a hipótese mais forte deste vídeo é o vínculo entre trecho, frase e próxima ação. O personagem e os movimentos não serão reutilizados como assets do produto sem direitos apropriados.

## V07 — estratégia, autonomia e leitura crítica

- **0–23 s:** enquadra tênis como tarefa que combina várias habilidades.
- **23–44 s:** pontuação e possibilidade de vencer mais pontos e perder a partida; menciona uma estatística de profissionais.
- **44–59 s:** ângulos de resposta e posicionamento.
- **59–76 s:** topspin e tempo de contato.
- **76–98 s:** antecipação e pistas do sacador; inclui uma anedota.
- **98–126 s:** autonomia, decisões e esforço prolongado.
- **126–141 s:** associação observacional entre tênis e longevidade, com aviso explícito de que não prova causalidade.
- **141–155 s:** fechamento editorial.

**Aproveitar:** pequenos modelos mentais, intenção antes da execução e reflexão após a sessão. **Não derivar do vídeo:** QI do jogador, estado mental, estimativa individual de longevidade, regra tática universal ou causalidade de saúde. Os números históricos e epidemiológicos são alegações da peça, não resultados verificados para o produto; não foram incorporados às metas. Uma futura biblioteca que os utilizar exigirá consulta às fontes originais.

## Síntese para a especificação

O conjunto inspira uma experiência em que o atleta **vê primeiro**, entende uma ideia por vez e acompanha sua prática. Não fornece dataset rotulado, validação de estimadores ou autorização para reproduzir materiais. As referências ficam preservadas para análise privada; as futuras animações do app devem ter conteúdo e assets próprios/licenciados.

Há notificações e elementos pessoais incidentais nas gravações de tela. Não publicar os originais, folhas de contato ou transcrições em repositório público. Documentação compartilhável deve usar sínteses e trechos necessários com revisão de direitos e privacidade. O backup editorial proposto exclui esses derivados.

---
tipo: proposta
status: aprovado-por-gabriel-revisao-claude-pendente
versao: 0.1
data: 2026-11-01
responsavel: Codex
---

# Proposta integrada

**Atualização de estado — 01/11/2026:** Gabriel aprovou a direção desta proposta. Ver Aprovacao-Gabriel-v0.1 (material local não incluído). O texto abaixo preserva as recomendações e suas hipóteses; revisão de Claude, validação científica e decisões ainda abertas permanecem pendentes.

## Recomendação

Construir um **companheiro de prática deliberada para o tenista amador que treina sozinho**, com um ciclo curto: **gravar → rever uma evidência → entender um foco → praticar → comparar**. O valor deve aparecer na compreensão e na qualidade da próxima prática, antes de qualquer painel de estatísticas sofisticado.

O produto precisa combinar três competências: medição auditável, explicação acessível e continuidade entre sessões. Um LLM pode adaptar a explicação; os números vêm de um pipeline versionado, sujeito a validação e a recusa quando a imagem não sustenta a conclusão. A simplicidade será resultado de selecionar bem a informação, preservando a possibilidade de inspecionar sua origem.

**Primeiro recorte recomendado: preparação e ritmo do saque, em treino controlado e filmagem lateral guiada.** É uma atividade que uma pessoa consegue repetir sem parceiro ou lançador. A escolha é uma hipótese de produto/engenharia, não a afirmação de que todo o saque é fácil de medir: braço, raquete, impacto e fase aérea são difíceis e ficam fora da primeira promessa quantitativa. Forehand continua prioritário na evolução, quando houver alimentação de bola suficientemente consistente.

## O que aprendemos das referências

Os sete vídeos somam 433,30 segundos. Há animações de cadeia cinética do forehand e saque, uma demonstração comercial de TennisCut, uma sequência didática de forehand e uma peça sobre raciocínio tático/psicologia. A análise detalhada e o método de inspeção estão em [Analise-dos-sete-videos](../01-Referencias/Analise-dos-sete-videos.md).

A SportArc distingue oficialmente Auto Cut para tênis de seus recursos de AI Coach/Match Review voltados ao tênis de mesa. Portanto, a animação de tênis que apresenta velocidades, ângulos e duração do contato não demonstra que o app calcula essas grandezas a partir de qualquer celular. O TennisCut anuncia revisão/corte de rallies e sobreposição de trajetória; sua página separa outras análises como futuras. Isso ajuda a definir um espaço de pesquisa, mas não demonstra ausência de concorrentes. Fontes consultadas em 01/11/2026: [SportArc](https://sportarc.ai/), [TennisCut](https://www.tenniscut.com/).

Nossa hipótese de diferenciação é **clareza, confiabilidade e comparação pessoal em português**, acompanhadas de um protocolo simples que o usuário consegue cumprir. Esse conjunto precisa ser testado frente a soluções existentes; não é uma vantagem já demonstrada. Dados globais de prática do tênis não bastam para confirmar crescimento ou mercado pagante brasileiro; ver [Produto-mercado-e-privacidade](../02-Pesquisa/Produto-mercado-e-privacidade.md).

## Usuário e trabalho a resolver

Público confirmado: tenista que treina sozinho, sem treinador acompanhando o uso. Para o piloto, propomos adultos amadores com experiência suficiente para executar seu saque habitual, um celular apoiado e disposição para repetir um protocolo curto. Iniciantes absolutos, menores e reabilitação exigem fluxos próprios e não entram nesta primeira validação.

Perguntas que o produto deve responder:

1. Consegui filmar de uma forma útil?
2. O que consigo observar no meu movimento?
3. Qual é o único foco desta sessão, e por quê?
4. Minha próxima gravação é comparável à anterior?
5. O que mudou além da variação e do erro da medição?

Não presumir que o usuário quer aprender estatística. Uma apresentação possível: vídeo com um trecho marcado, uma frase explicativa, um convite de prática revisado e a próxima ação. Claude decidirá a solução visual e de interação, incluindo quando esconder ou revelar detalhes.

## Escopo por estágio

| Estágio | Entrega | Evidência necessária para avançar |
|---|---|---|
| P0 — descoberta e experiência | Guia de captura, navegação de vídeo e exemplos claramente simulados; sem promessa de medição validada | Usuários conseguem gravar e explicar o que entenderam; protocolo revisado |
| P1 — laboratório técnico | Pipeline offline, rótulos humanos, pose 2D, eventos e qualidade; relatórios de erro | Métricas específicas passam validação e repetibilidade, com cobertura conhecida |
| P2 — piloto solo | Captura curta, resultado limitado, histórico comparável, conteúdo revisado e compreensão testada | Experiência funciona sem assistência; feedback fundamentado; exclusão/exportação verificadas |
| P3 — expansão | Forehand e outros golpes, bola/raquete, captura em partida e 3D quando sustentado | Benchmark separado por recurso/contexto; custo e demanda demonstrados |

P0 e P1 podem andar em paralelo depois da discussão desta proposta. Não confundir um protótipo convincente de UX com um protótipo científico aprovado. Nenhum estágio foi executado nesta entrega além da pesquisa e organização da especificação.

## Primeira sessão proposta

1. Usuário escolhe o saque e informa mão dominante. O app mostra como apoiar o celular e enquadrar corpo, pés e espaço acima da raquete.
2. Faz uma gravação curta de teste. O app identifica enquadramento inadequado e explica como ajustar. A inspeção manual do preview continua disponível.
3. Grava um bloco curto de seu saque habitual. Hipótese inicial: 5 repetições para o teste de usabilidade; os experimentos científicos usam blocos maiores definidos no protocolo.
4. Vê trechos identificados; se o sistema não pode avaliar, recebe o motivo e pode continuar revendo o vídeo.
5. Recebe no máximo um foco educativo e até duas medidas liberadas. Se nenhuma medida estiver liberada, o produto oferece revisão visual identificada como tal.
6. Marca opcionalmente o resultado observado por ele: entrou/não entrou/não sei. Esse dado é autorrelatado, não detecção automática de linha.
7. Em outra sessão, repete a posição da câmera e a tarefa. Só há comparação quando as condições e versões permitem.

Uma pessoa deve conseguir posicionar o telefone e iniciar com contagem regressiva. Antes de pedir controles por relógio, áudio ou outro aparelho, validar se apoio estável, preview e temporizador resolvem o problema. O fluxo não pode exigir duas câmeras, treinador ou upload durante o treino para completar a captura básica.

## O que cabe medir primeiro

- **Qualidade:** corpo visível, estabilidade, presença de oclusão e suporte do protocolo; isso descreve a gravação, não a qualidade do atleta.
- **Tempo:** intervalos entre eventos precisamente definidos, se visíveis e validados. Guardar timestamps reais; uma gravação de tela a 60 fps não converte uma fonte lenta em captura esportiva de 60 fps.
- **Geometria 2D:** ângulo projetado do joelho visível durante a preparação, sob captura lateral padronizada, como candidato experimental. Nunca rotular automaticamente como ângulo anatômico 3D ou alvo universal.
- **Resultado:** contagem de tentativas e acertos informados pelo usuário, com denominador e identificação da fonte.

[Catalogo-de-metricas](../04-Arquitetura/Catalogo-de-metricas.md) define nomes, unidades, denominadores, comparabilidade e estados de indisponibilidade. Não há índice único de técnica, percentil profissional, medição de torque, diagnóstico de lesão ou nota emocional nesta proposta.

Uma mudança numérica não é necessariamente melhora. Menor dispersão não é necessariamente técnica melhor. Um saque que entra mais em uma amostra pequena pode refletir acaso, tarefa mais fácil ou esforço menor. Evolução exige repetição comparável e ligação prudente entre movimento, objetivo do atleta e resultado.

## Camada de aprendizagem, psicologia e estratégia

No início, psicologia entra como linguagem respeitosa, objetivo de sessão e reflexão opcional do próprio jogador. O app não infere ansiedade, personalidade ou confiança pelo rosto ou postura. Estratégia entra por perguntas simples sobre intenção e resultado. A análise de adversário e decisão por ponto depende de vídeo, contexto e rótulos adicionais e fica em uma trilha futura.

Conteúdos devem ter autor/revisor, versão, fonte, indicação de uso e contraindicações pertinentes. Nenhum vídeo promocional entra automaticamente na biblioteca de instruções. Conselhos para aumentar potência ou modificar carga articular precisam de revisão especializada antes do piloto autônomo. Relato de dor interrompe a orientação técnica automatizada e apresenta uma recomendação neutra de procurar avaliação apropriada; não gerar diagnóstico.

## Arquitetura em uma frase

Captura e verificação básicas no dispositivo; análise experimental em Python com pipeline substituível de pose/eventos; métricas determinísticas e versionadas; política que decide o que pode ser mostrado; explicação por templates revisados, com LLM opcional e restrito às evidências; frontend concebido pelo Claude a partir desse contrato.

Começar com um monólito modular e um worker, sem um conjunto de microserviços. O laboratório pode trabalhar com arquivos locais antes de termos conta, nuvem, assinatura ou GPU contratada. Quando houver piloto remoto: API autenticada, armazenamento privado de objetos e fila durável. A escolha entre processamento local e servidor será medida em aparelhos representativos; ver [Arquitetura-e-contratos](../04-Arquitetura/Arquitetura-e-contratos.md) e [Stack-e-modelos](../02-Pesquisa/Stack-e-modelos.md).

## Como saberemos que vale continuar

Sucesso combina três portões independentes: o sistema mede o que afirma; o usuário entende e consegue usar sozinho; o ciclo tem utilidade suficiente para ser repetido. [Plano-de-validacao](../05-Validacao/Plano-de-validacao.md) define metas provisórias e experimentos. Nenhuma meta é resultado observado.

Proponho começar com entrevistas de 8–12 praticantes solo e testes de captura, em paralelo à especificação científica. Uma primeira amostra técnica de 12–20 adultos serve para descobrir falhas e variabilidade, não para fazer alegações populacionais ou provar benefício. O tamanho confirmatório depende da precisão desejada e dos dados do estudo de viabilidade.

## Decisões para Gabriel e Claude

- Confirmar ou alterar o recorte inicial de saque e o equilíbrio entre revisão visual e métricas.
- Definir quais celulares estarão no primeiro teste; iOS/Android ainda não escolhidos.
- Ajustar o fluxo de uma sessão e a linguagem de incerteza sem esconder limitações.
- Definir orçamento de descoberta/validação e disponibilidade de revisor científico humano.
- Decidir o destino de backup independente e eventual versionamento remoto privado.

Esta proposta prepara a implementação. A aprovação da especificação, a revisão científica e a disponibilidade de dados próprios ainda precisam ocorrer.

---
title: Validade científica — vídeo de smartphone e evolução no tênis
date: 2026-11-01
status: proposta-para-revisao
owner: Codex — pesquisa biomecânica e validação
tags: [pesquisa, biomecanica, validacao, ciencia, tenis]
---

# Validade científica — vídeo de smartphone e evolução no tênis

**Recomendação:** começar com um diário de prática autoguiada para **tenistas treinando sozinhos, sem treinador presente**, replay por fases e acompanhamento de **uma medida projetada em 2D**, validada no protocolo de captura do próprio produto. Evolução de uma medida, melhora técnica e melhora de desempenho são três resultados diferentes. Um modelo multimodal pode explicar evidências, mas não deve inventar números biomecânicos a partir da aparência do movimento. Especialistas revisam a ciência e a biblioteca no desenvolvimento; o fluxo cotidiano não pode depender deles.

**Estado desta nota:** pesquisa e desenho experimental, consultados em **1º de novembro de 2026**. Nenhum modelo de pose/biomecânica foi executado, nenhum atleta foi avaliado e nenhuma acurácia do aplicativo foi demonstrada. Todas as metas operacionais abaixo são hipóteses de projeto para revisão de um biomecanicista e de treinadores, não padrões científicos já cumpridos.

## 1. O que a evidência permite concluir

| Evidência primária | Resultado relevante | Limite para este produto |
|---|---|---|
| [OpenCap, Uhlrich et al., 2023](https://doi.org/10.1371/journal.pcbi.1011462) | Pipeline com dois ou mais smartphones, visão computacional e modelo musculoesquelético; validação em dez pessoas com erro angular médio absoluto de 4,5°. | Atividades avaliadas incluíram marcha, agachamento, levantar da cadeira e salto de queda. Não estabelece esse erro para saque, ombro ou vídeo monocular de recreativos. |
| [OpenCap Monocular, Gilon et al., 2026 — preprint](https://arxiv.org/abs/2603.24733) | Uma câmera, WHAM e refinamento biomecânico; MAE angular médio de 4,8° em marcha, agachamento e levantar da cadeira. | O [texto completo](https://arxiv.org/html/2603.24733v1) relata dificuldade em saltos, amostra jovem saudável e avaliação de uma vista anterolateral de 45°. Pesquisa promissora, sem validação específica para tênis. |
| [Capture4D, Zhao et al., 2026](https://doi.org/10.3390/s26051411) | Nove tenistas de alto nível; estudo detalhado do saque com câmera RGB única e Qualisys. Erro de posição NMPJPE de 69,5–88,3 mm. | A posição foi alinhada por Procrustes, incluindo escala. NMPJPE agregado não demonstra precisão angular fina por articulação, tracking absoluto na quadra ou generalização a iniciantes; cada alegação exige validação específica. |
| [Emmerson et al., publicação inicial 2025](https://doi.org/10.1080/02640414.2025.2555096) | Dez movimentos de saque, forehand e backhand em 16 tenistas; sistema 3D com oito câmeras, comparado com marcadores e forças. Trabalho externo apresentou concordância melhor que trabalho interno. | As repetições de golpes de fundo foram simuladas. Erros aleatórios individuais e artefatos de alta frequência impedem transpor os resultados para uma câmera casual. Conferir também o [registro institucional](https://researchportal.bath.ac.uk/en/publications/evaluation-of-a-markerless-motion-capture-system-for-measuring-me/). |
| [Ozan et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41418505/) | Simulação Monte Carlo quantificou incerteza no próprio MoCap com marcadores durante saque: posição dos marcadores e movimento de tecidos afetam ângulos e velocidades. | A referência laboratorial também tem erro; comparação exige definição anatômica e incerteza, e não a palavra “gold standard” como garantia absoluta. |
| [Hornestam et al., 2021](https://pubmed.ncbi.nlm.nih.gov/34450697/) | Estudo de 32 juvenis com sensores inerciais associou maior flexão de joelho na preparação a maior velocidade da raquete entre grupos. | Associação entre grupos não define o ângulo ideal de uma pessoa, não prova efeito de um aplicativo e não equivale a uma medida 2D do joelho. |

**Interpretação da equipe:** existe fundamento para pesquisar a solução; não existe fundamento para prometer, já no MVP, “análise equivalente à equipe profissional” por qualquer vídeo. A diferença útil do produto pode ser tornar observação, prática e reavaliação compreensíveis e consistentes.

O artigo Capture4D é especialmente importante como contraponto: um resumo otimista e um esqueleto visualmente convincente não estabelecem, por si, precisão suficiente para uma correção de poucos graus. O critério de aceitação deve pertencer à **medida e à decisão**, não ao nome do modelo. A faixa de erro “aceitável para coaching” descrita pelos autores não é adotada como padrão deste aplicativo.

## 2. Quatro níveis que o contrato de dados deve distinguir

| Nível | Exemplos | Como comunicar |
|---|---|---|
| Observação no vídeo | Quadro em que um pé deixa visivelmente o solo, contagem revisada de repetições, posição 2D de landmarks, ângulo projetado. | “Neste vídeo…”, com instante, câmera e possibilidade de corrigir a anotação. Mesmo detecção 2D automática tem erro. |
| Estimativa geométrica ou biomecânica | Pose 3D monocular, ângulo anatômico 3D, centro de massa modelado. | “Estimativa”, versão do modelo, domínio validado e erro esperado. Não apresentar coordenadas inferidas como medição direta. |
| Inferência para orientar treino | Uma hipótese de coordenação a testar, selecionada de biblioteca revisada pelo treinador. | Separar o que foi observado da hipótese e do exercício; uma orientação principal por sessão. |
| Não identificável ou não validado nas condições | Força muscular individual, torque no ombro, risco de lesão, carga de tendão, estado psicológico, diagnóstico, spin exato sem referência adequada. | Não calcular nem preencher com número plausível; `não disponível` acompanhado de motivo útil. |

A [documentação do MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python) fornece landmarks de imagem e coordenadas 3D chamadas `WorldLandmarks`, além de `visibility`. **Decisão proposta:** nomes de campos e unidades em metros não constituem validação metrológica. `visibility=0.95` não significa “95% de chance de o ângulo estar correto”, e não deve se transformar na confiança científica exibida ao praticante.

Homografia da quadra pode apoiar posições no plano do piso; não transforma automaticamente a trajetória aérea da bola ou do punho em 3D. A [documentação geométrica do OpenCV](https://docs.opencv.org/4.5.5/d9/dab/tutorial_homography.html) explicita a hipótese planar.

## 3. Escolha do primeiro alvo

**Candidato preferencial para um experimento de validade: flexão aparente do joelho da frente na preparação de um saque, em vista lateral controlada.** A escolha é de viabilidade de pesquisa, não uma prescrição para dobrar mais o joelho.

O saque permite uma posição inicial e um enquadramento mais estáveis que um rally livre, e o praticante consegue repeti-lo sozinho. A preparação é mais lenta que o impacto e oferece um marco visual acessível. Ainda assim, a postura e a rotação do corpo podem tirar a perna do plano da câmera. Por isso a primeira medida é deliberadamente **projetada**, não “flexão anatômica verdadeira”. Só avança se o piloto demonstrar que as condições conseguem ser repetidas por um praticante sem assistência.

| Golpe | Oportunidade inicial | Problema a resolver antes de ampliar |
|---|---|---|
| Saque | Preparação, fases visuais, consistência entre repetições, resultado declarado pelo usuário. | Corpo gira e salta; braço, raquete e bola se movem rapidamente; ombro e rotação interna não são recuperados de um ângulo 2D simples. |
| Forehand | Replay de preparação/contato/finalização e consistência num exercício alimentado de forma repetível. | Variações de altura/velocidade da bola, base aberta ou fechada, deslocamento e plano de swing confundem comparações. |
| Backhand | Replay por fases, separando uma e duas mãos desde o cadastro da sessão. | Braços e tronco ocluem landmarks; misturar uma e duas mãos inviabiliza uma referência única. |

**Fallback:** se a medida do joelho não atingir repetibilidade suficiente, lançar apenas replay e anotação revisada no protótipo; manter a medida numérica em modo de pesquisa. O produto não depende de um gráfico prematuro para testar utilidade.

### Definição operacional da medida candidata

1. Definir lado dominante, perna da frente e vista de captura; confirmar em quadro estático. Guardar coordenadas originais, sem espelhar silenciosamente.
2. Usar hip–knee–ankle do mesmo lado. Converter coordenadas normalizadas para pixels antes da geometria, corrigindo a diferença entre largura e altura.
3. Calcular o ângulo interno `theta = acos(dot(H-K, A-K) / (norm(H-K) * norm(A-K)))`; definir `flexao_aparente = 180° - theta`.
4. Identificar o pico dentro da janela de preparação anotada, evitando um máximo espúrio fora da fase. Guardar valor, quadro, tempo, landmarks e regras de filtragem.
5. Mostrar distribuição de repetições válidas da sessão, quantidade rejeitada e razão. Uma sessão não deve ser resumida pelo melhor saque escolhido depois de ver o resultado.
6. Comparar somente sessões com protocolo, lado, vista, golpe, versão de processamento e tarefa compatíveis. Quando o modelo mudar, reprocessar ambos os vídeos ou interromper a continuidade da série.

O nome na UI deve permitir uma explicação simples: “Ângulo visto pela câmera”. A descrição expandida explica que ele pode mudar quando a câmera muda. Ângulos entre segmentos em 2D não fornecem rotação interna do ombro, pronação ou separação quadril–tronco 3D.

## 4. Protocolo de captura proposto para o piloto

Os valores desta seção são pontos de partida experimentais. Não são requisitos universais de validade.

- **Um praticante por gravação**, adulto no primeiro piloto; tripé ou suporte fixo, câmera traseira, orientação horizontal, lente principal sem zoom digital, sem mudança de lente durante a gravação.
- **1080p e 60 fps reais como entrada inicial; 120 fps quando houver luz suficiente.** Registrar timestamps, resolução efetiva, exposição quando disponível e eventuais quadros perdidos. A resolução nominal não garante detalhe no corpo.
- Enquadrar corpo inteiro e raquete no movimento completo, com margem; para joelho, exigir hip/knee/ankle visíveis. Meta inicial de altura do corpo de pelo menos 500 pixels na imagem, a testar e revisar por aparelho.
- Começar em vista aproximadamente perpendicular ao plano observado da perna; guardar distância/altura aproximadas e posição do suporte com marcas reproduzíveis. Uma foto-guia da montagem acompanha a sessão.
- Boa luz uniforme; evitar contraluz, roupa que apague contornos, câmera na mão e múltiplas pessoas cruzando a área de análise.
- Gravar dois segundos de posição inicial e um bloco proposto de até dez saques no mesmo exercício e lado, com pausa habitual. Registrar intenção, tipo de saque e alvo. O praticante pode encerrar antes; não induzir esforço adicional só para alimentar o sistema. A biblioteca de instruções e limites deve ser revisada por especialistas no desenvolvimento.
- Confirmar no replay a perna analisada e os eventos. A presença de bola e raquete no quadro é necessária para inferir contato; se o contato não está visível, o sistema não deve fabricá-lo a partir do braço.
- Guardar arquivo original. Upload por mensageiro, câmera lenta exportada, estabilização, recorte, interpolação e edição podem alterar tempo e geometria. Identificar essas transformações e tratar arquivos sem proveniência como domínio separado.

**Regra para comparações:** a gravação livre continua útil para replay; métricas comparáveis exigem protocolo. O app deve guiar a pessoa no momento de capturar, em vez de tentar compensar tudo depois.

**Fluxo autoguiado a testar:** escolher saque e lado → ver desenho/foto de onde apoiar o telefone → temporizador para ocupar a posição → teste curto de enquadramento → indicação clara de “pode gravar” ou um ajuste específico → gravar bloco → revisar um trecho e receber uma observação educativa. O teste deve funcionar com um telefone e um suporte, sem ajudante, segundo telefone, treinador ou equipamento laboratorial. Uma orientação sonora pode ajudar a distância, mas precisa de alternativa visual e controle de volume. Se o sistema não consegue confirmar a qualidade remotamente, pedir uma revisão curta do vídeo antes do bloco completo. Não exigir que o usuário interprete keypoints ou probabilidades.

## 5. Erros que precisam de teste específico

| Fonte | Efeito provável | Resposta do sistema |
|---|---|---|
| Perspectiva e rotação fora do plano | Mudança do ângulo 2D sem mudança biomecânica equivalente. | Ensaiar câmera em múltiplos azimutes; limitar o domínio e impedir comparação incompatível. |
| Oclusão e troca esquerda/direita | Landmark coerente visualmente, mas atribuído à perna errada. | Verificação temporal e revisão em quadro crítico; abstenção quando ambíguo. |
| Motion blur | Punho, bola e raquete indistintos; erro de posição e evento. | Critério de qualidade local, não apenas nitidez média do quadro. |
| Rolling shutter | Partes da imagem correspondem a instantes ligeiramente diferentes. | Medir sensibilidade por aparelho e velocidade; excluir estimativas muito rápidas até validação. |
| FPS nominal, quadros duplicados ou variáveis | Duração e velocidade erradas. | Preservar PTS e tempo original; não confiar apenas no `fps` do contêiner. |
| Filtragem excessiva | Pico menor ou deslocado; falsa suavidade. | Versionar filtro e demonstrar erro em amplitude e tempo. Comparar sinal original e filtrado em QA. |
| Autozoom/estabilização e câmera em movimento | O referencial se move junto com o gesto. | Detectar transformação global; restringir a aquisição no primeiro experimento. |
| Repetições difíceis rejeitadas | Métrica melhora porque o sistema mede só os casos fáceis. | Informar cobertura, taxa de rejeição e erro por estrato junto à acurácia. |

O mecanismo de rolling shutter está documentado em [Jia e Evans, 2012, projeto dos autores](https://users.ece.utexas.edu/~bevans/papers/2012/rolling/index.html): linhas são expostas em momentos distintos e a distorção cresce com o movimento relativo. A aplicação da consequência ao saque é uma inferência de engenharia a testar.

Como referência aritmética, o intervalo entre quadros é 33,3 ms em 30 fps, 16,7 ms em 60 fps e 8,3 ms em 120 fps. Isso não é a acurácia do detector. A incerteza de localização do evento, exposição e perda de quadros acrescenta erro; sintetizar quadros intermediários não cria evidência temporal nova.

## 6. Plano de validação em três perguntas

### A. Medimos o que declaramos medir?

Para **ângulo projetado 2D**, construir referência com dois anotadores independentes, protocolo de landmarks e adjudicação. Medir o erro dos próprios anotadores. Comparar estimador automático com consenso em quadros predeterminados e no pico detectado: esses são problemas diferentes.

Para uma futura alegação de **ângulo anatômico 3D**, coletar simultaneamente vídeo do telefone e referência laboratorial calibrada; adotar as mesmas definições de segmento, eixos e sinais. Projetar os landmarks da referência na câmera permite separar erro de landmark 2D de erro de inferência 3D. IMU pode complementar, mas não é automaticamente uma referência perfeita para todos os eixos.

Apresentar MAE, RMSE, viés e limites de concordância em graus, por articulação, fase e atleta. Para eventos, erro temporal e proporção dentro da tolerância predefinida. Não substituir concordância por correlação: [Bland e Altman, 1986](https://pubmed.ncbi.nlm.nih.gov/2868172/) formulam precisamente esse problema. Não usar alinhamento Procrustes ou deformação temporal como único resultado; essas operações podem remover erros relevantes ao uso real.

### B. Conseguimos distinguir mudança de ruído?

Separar três experiências: reprocessar o mesmo vídeo; desmontar e remontar a câmera para registrar o mesmo exercício; repetir a sessão em outro dia. A primeira verifica software, as outras incluem aquisição e variabilidade da execução. Para o usuário, é a última combinação que limita a leitura de evolução.

Relatar ICC com intervalo de confiança, especificando modelo, concordância absoluta ou consistência e medida individual ou média. O índice escolhido deve refletir exatamente o desenho, conforme a formulação de [Shrout e Fleiss, 1979](https://pubmed.ncbi.nlm.nih.gov/18839484/). ICC alto numa população muito heterogênea não garante erro pequeno para acompanhar uma pessoa; essa distinção é central em [de Vet et al., 2006](https://pubmed.ncbi.nlm.nih.gov/16980142/).

Estimar erro padrão de medida (`SEM`) a partir dos componentes de variância apropriados ao protocolo. A relação `MDC95 = 1,96 × sqrt(2) × SEM` aplica-se à diferença de duas medidas com erros independentes, comparáveis e aproximadamente normais. Se houver erro correlacionado, heteroscedasticidade ou agregação de repetições, estimar a distribuição correspondente; não dividir o erro por `sqrt(n)` fingindo que saques consecutivos são independentes.

`MDC` significa mudança acima do erro detectável, não melhora esportivamente relevante. Antes de chamar uma mudança de “melhora”, definir direção e relevância com treinador e vincular a uma tarefa e resultado. A frase inicial recomendada é “mudança detectada”, ou “a diferença ainda pode ser variação da medição”.

### C. A orientação melhora aprendizagem ou desempenho?

Depois da validade da medida e de testes de compreensão, comparar feedback do app com uma condição de referência, idealmente com alocação aleatória. Registrar pré-teste, prática, retenção sem feedback e transferência para uma tarefa diferente. Uma sessão com resultado melhor logo após feedback não demonstra aprendizagem duradoura.

Resultados candidatos: proporção de saques no alvo sob protocolo, consistência de um parâmetro escolhido e compreensão da instrução. Velocidade de bola só entra com método próprio validado, por exemplo radar durante o estudo. Mais flexão, menor variabilidade e maior velocidade não são metas universais; precisam ser compatíveis com a intenção e com a pessoa.

Um ensaio com [20 juvenis, treinamento de flexão de joelho e sensores inerciais](https://pubmed.ncbi.nlm.nih.gov/41065038/) sustenta pesquisar intervenções específicas, mas não valida automaticamente o método de captura, a orientação algorítmica ou os efeitos em adultos recreativos.

## 7. Dataset e prevenção de vazamento

**Piloto de descoberta proposto:** 12–20 adultos, duas sessões por pessoa e aproximadamente dez saques por sessão. Serve para identificar falhas, revisar anotação e estimar variâncias; não é tamanho amostral confirmado para lançar uma alegação científica. O estudo confirmatório deve dimensionar número de atletas a partir da precisão desejada dos limites de concordância, erro de mudança e estratos críticos.

Separar treino/desenvolvimento, calibração de confiança e teste bloqueado por **atleta**, mantendo todos os quadros, saques e sessões da mesma pessoa no mesmo grupo. Se o produto aprende com o histórico individual, criar adicionalmente uma avaliação longitudinal com adaptação só no passado e teste no futuro. A avaliação da personalização não substitui a avaliação em pessoas novas.

Também reservar combinações de quadra/aparelho/condição de luz não vistas no desenvolvimento. Buscar diversidade de nível, idade adulta, proporções corporais, tons de pele, vestuário, lateralidade e técnica. Domínios não representados ficam declarados como não validados; não existe número mínimo mágico por estrato.

Registrar todos os clipes recebidos, inclusive falhas, e o motivo de exclusão. Deduplicar por hash e conteúdo; recortes do mesmo vídeo não podem atravessar partições. Aumentação de imagem permanece no treino. Treinamento e teste em vídeos de profissionais disponíveis online exigem direitos de uso e não substituem dados consentidos do público-alvo.

Para inferência estatística, o número de saques não é o número de pessoas independentes. Usar modelos de efeitos mistos ou reamostragem agrupada por atleta/sessão. A extensão de [Bland e Altman, 2007](https://pubmed.ncbi.nlm.nih.gov/17613642/) trata especificamente de múltiplas observações por indivíduo.

## 8. Gates propostos para a primeira medida

Todos os limiares são **HIPÓTESES DE ACEITAÇÃO**, sujeitos a revisão e pré-registro antes do teste confirmatório. Não foram alcançados.

| Gate | Meta inicial para discutir | Evidência necessária |
|---|---|---|
| Referência humana | Discordância angular entre anotadores suficientemente menor que a tolerância do produto. | Estudo de anotação e adjudicação; se a referência é ambígua, redefinir a medida. |
| Geometria 2D | MAE ≤5° e limites de concordância aproximadamente contidos em ±10°, após contabilizar viés. | Teste bloqueado por atleta, CIs, estratos e sensibilidade à posição da câmera. Não aceitar só a média agregada. |
| Eventos de preparação | ≥90% dos eventos dentro de ±2 quadros originais a 60 fps em vídeos elegíveis. | Referência independente, tolerância também em ms, erro por fase e cobertura. Não aplicar essa meta automaticamente ao impacto. |
| Reaquisição | MDC95 abaixo da mudança que o treinador considera relevante para a tarefa; ICC absoluto com CI como indicador complementar. | Remontagem da câmera e sessões em dias distintos. Um ICC >0,90 isolado não libera a medida. |
| Abstenção | Casos inelegíveis identificados com alta sensibilidade; casos aceitos mantêm erro dentro do limite. | Curva erro × cobertura; meta inicial de falso aceite ≤5%, com CI e denominador explícitos. |
| Utilidade | Praticante entende a observação, o limite e a próxima prática sem depender de explicação extra. | Teste moderado com tarefas e perguntas de compreensão; não confundir satisfação com eficácia. |

Se um intervalo de confiança ultrapassar o limite decisório ou um estrato essencial falhar, aumentar evidência, restringir escopo ou retirar a medida. Ajustar o limite depois de olhar o teste requer novo conjunto de teste.

## 9. Regras para feedback e acompanhamento

- Nunca produzir uma nota universal de “técnica 87/100” sem construto, validade e interpretação demonstrados.
- Cada afirmação factual aponta para um trecho de vídeo e uma medida/observação versionada; cada orientação aponta para uma regra de coaching revisada.
- O LLM recebe observações estruturadas, motivos de abstenção e referências aprovadas. Ele escreve a explicação; não substitui cálculo nem corrige automaticamente medições suspeitas.
- Mostrar primeiro vídeo, observação e uma ação de prática. Deixar estatística detalhada disponível sob demanda; simplificar exposição não permite ocultar incerteza material.
- Comparar consigo mesmo em condições compatíveis. O vídeo de um profissional pode ilustrar um conceito, sem ser tratado como molde anatômico universal.
- Separar evolução da execução e resultado do exercício. Se o resultado for informado pelo usuário, identificá-lo como autorrelato; não atribuí-lo à visão computacional.
- Não inferir ansiedade, foco, personalidade ou estado mental pela face/gesto. Reflexões de esforço e confiança podem ser registradas voluntariamente como autorrelato e analisadas de forma descritiva.
- Não fazer diagnóstico, previsão individual de lesão, prescrição de reabilitação ou promessa de prevenção. Interromper uma orientação automatizada quando o usuário reportar dor e encaminhar a avaliação humana adequada.

## 10. Sequência de trabalho recomendada

1. **Definição humana:** biomecanicista e treinador especificam a medida, landmarks, fase, utilidade e mudanças relevantes. Produto verifica se a captura é viável para uma pessoa na quadra.
2. **Piloto manual:** vídeos consentidos e anotação antes de treinar ou escolher modelo. Descobrir a taxa de captura aproveitável e as ambiguidades reais.
3. **Benchmark de estimadores:** comparar baseline 2D, alternativa mais robusta e eventual método 3D em partições idênticas. Registrar qualidade, latência, custo e licença; novidade do modelo não é critério suficiente.
4. **Validação de medida e confiança:** erro, cobertura, reaquisicão, estratos e regras de abstenção. O modelo pode ficar em modo de pesquisa até passar.
5. **Protótipo autoguiado:** orientação vem de biblioteca educativa revisada previamente por especialistas; medir se o tenista sozinho conclui captura, entende a observação e escolhe a próxima prática. Revisão humana dos resultados acontece como QA do estudo, sem ser passo obrigatório do uso. Claude é responsável pela experiência.
6. **Estudo de efeito:** avaliar retenção, transferência e resultados; só então ampliar alegações de evolução técnica.

## 11. Pontos que exigem decisão conjunta

- Confirmar saque como primeiro experimento ou priorizar o golpe que o piloto mostrar ser mais útil. Escolha de produto e escolha de medida devem permanecer separadas.
- Definir quem assume a revisão científica humana e quem aprova a biblioteca de exercícios.
- Acordar quais condições de aparelho e captura entram no primeiro domínio validado.
- Definir mudança relevante e tolerância antes do estudo, em vez de ajustar a narrativa à acurácia obtida.
- Definir quais observações educativas podem ser automáticas após validação. O piloto é para treino solitário; revisão especializada pertence ao desenvolvimento e à auditoria científica, não ao caminho obrigatório de cada sessão.

## 12. Registro de fontes e limites da consulta

Todas as fontes acima são artigos originais, trabalhos metodológicos originais ou documentação dos próprios projetos, acessados em **2026-11-01**. O OpenCap Monocular é explicitamente um preprint. Alguns acessos diretos a MDPI/Taylor & Francis retornaram bloqueio HTTP; os trechos científicos foram conferidos em resultados indexados do editor, PubMed/PMC e registro institucional, com essa limitação de acesso. Não foi realizada revisão sistemática nem auditoria de código/dados dos autores.

Não foi adotado como evidência já publicada até a data de corte um resultado de busca sobre BOLT6 em *Journal of Biomechanics Open* datado de dezembro de 2026; a disponibilidade antecipada e a data editorial precisariam ser conferidas. Nenhuma pesquisa em humanos foi iniciada por esta nota.

Sobre a referência visual V01: a inspeção feita pela coordenação identificou uma animação SportArc de forehand/cadeia cinética com números como 96 km/h, separação de 28° e contato de 5 ms. Esses elementos podem inspirar comunicação, mas não são evidência de que o app calcula tais medidas a partir de uma câmera. A 60 fps, os quadros estão separados por cerca de 16,7 ms; não é legítimo recuperar um contato de 5 ms simplesmente lendo essa gravação ou interpolando quadros.

**Maior risco científico:** apresentar inferência 3D, score do detector ou mudança de enquadramento como mudança biomecânica individual. A defesa central é um domínio estreito de captura, referência independente, erro quantificado, comparação compatível e capacidade explícita de não medir.

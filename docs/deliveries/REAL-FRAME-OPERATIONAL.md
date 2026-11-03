# Análise local de um quadro real — 03/11/2026

Gabriel importou uma gravação e perguntou como obter a análise. A V3 até então
oferecia reprodução/anotações e demonstração sintética separada. Após o pedido
explícito para deixar operacional, a revisão passa a oferecer **Analisar este
quadro**, seleção explícita do jogador e pontos estimados numa imagem real.

## Escopo entregue

O navegador pausa, aguarda a imagem decodificada, reduz o maior lado a 1280 px e
envia um PNG ao worker deste computador. O resultado é vinculado por SHA-256 e
dimensões e só pode ser desenhado sobre aquele mesmo PNG congelado. Nenhuma pessoa
é selecionada automaticamente, mesmo quando há somente um candidato. Reprodução,
notas manuais, demonstração e contrato científico permanecem separados.

MediaPipe Pose Landmarker Heavy, IMAGE/CPU, quatro poses no máximo, 33 pontos
mapeados a COCO17. Pontos fora da imagem, não finitos ou abaixo dos limiares
técnicos de visibilidade/presença ficam nulos; não há interpolação. `no_person`
significa ausência de candidato desenhável, não prova de ausência de pessoas.
A regra de desenho tem versão; não estabelece precisão ou validade anatômica.

Modelo oficial restaurado de
[Google MediaPipe](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task),
SHA-256 `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`,
igual ao registro local anterior. Os mesmos bytes verificados são carregados.
[API IMAGE](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python).
Ambiente `.venv` isolado com `uv sync --extra pose --frozen`; lockfile preservado.

## Operação e limites

- Vite `npm run dev`, loopback; GET de capacidades e POST de PNG com Origin/token.
- Até 4 MiB/1280 px por imagem, um pedido ativo e 90 segundos por trabalho.
- Processo filho cancelado no aborto/timeout; saídas e mensagens de erro limitadas.
- Imagens/resultados não persistem no servidor. Modelo, configuração, catálogo,
  capturas e evidências reais ficam privados e fora de Git.
- Posição do player é apenas referência de revisão; nenhum PTS é fabricado.
- Sem acompanhamento temporal, ângulos, qualidade do golpe, evolução ou coaching.
- O teto científico de vídeo de 512 MiB não foi alterado; esta é outra operação,
  de imagem única. A decodificação do arquivo continua dependente do navegador.
- Não é serviço de upload multiusuário, não tem durabilidade de jobs e não
  implementa toda a proposta P3. Build estático/preview não executa esse motor.

## Evidência de verificação

- Build/TypeScript aprovados; 171 testes Vitest aprovados.
- 1090 testes Python aprovados, incluindo 13 novos do worker.
- 13 E2E iniciais aprovados (4 novos + 2 guiados + 7 de revisão local).
- Após a correção da espera por quadro: os 5 E2E da análise passaram, incluindo
  regressão de `seeking=false` com `readyState=1`, cancelamento, hash incompatível,
  erro/vazio e seleção explícita; axe em 320 px, sem desligar regras.
- Teste com o arquivo real escolhido por Gabriel, em navegador visível: captura
  pelo player, inferência local, seleção manual, 14 pontos e 8 linhas desenhados
  apenas na imagem congelada. Não houve pose simulada sobre mídia real.
- Reexecução do PNG capturado: HTTP 200, hash correspondente, 1280×720, 14 pontos,
  CPU/IMAGE, 1,24 s observados nessa chamada. Não é benchmark nem SLA.
- Hash do vídeo original após o teste idêntico ao baseline anterior.

O primeiro smoke headless não concluiu: o quadro HEVC ficou indisponível após
seek e não houve chamada ao motor. Isso revelou a necessidade de aguardar imagem
decodificada; a correção tem regressão sintética. A tentativa do helper em outra
janela visível foi interrompida (`ERR_ABORTED`). A evidência real aprovada veio
do navegador controlado diretamente e da reexecução do PNG; não se afirma aprovação
daquele helper. Testes headless com os fixtures sintéticos passaram.

Três entradas antigas da biblioteca tinham ctime diferente; seus hashes completos
foram conferidos idênticos antes de renovar a identidade privada. O servidor foi
reiniciado para ativar o plugin. Nada disso modifica os originais.

Validação por especialista, testes de movimento contínuo, aparelhos físicos,
Safari/iOS e compreensão sem orientação continuam pendentes.

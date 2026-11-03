# Quadro V3 — vídeos reais e revisão local

Rodada iniciada em 02/11 e concluída tecnicamente em 03/11/2026. Branch isolada
`feat/ux-real-video-v3`, baseada na V2 `5d5fb9d`. O usuário autorizou melhorar a
interface e usar exports recentes existentes no computador. V1/V2 preservadas.

## O que mudou

O vídeo real ocupa o centro da experiência. Fundo claro, azul concentrado nas
ações/navegação, tipografia menos condensada, biblioteca com miniaturas reais,
player amplo e observações ao lado no desktop. No celular, vídeo e controles vêm
antes das anotações. O guia de captura fica disponível nos dois tamanhos.

Biblioteca privada com allowlist, leitura por Range/HEAD e verificação de identidade
de arquivo; seletor de arquivo usa blob URL sem upload. Reprodução, busca por tempo,
velocidades de 0,25× a 1,5×, áudio/tela cheia, repetição A–B, momentos manuais,
edição/remoção de notas e exportação JSON. Catálogo guarda notas no navegador por
ID de conteúdo; seletor usa ID novo e notas temporárias, explicitadas na tela.
Falha de armazenamento não é apresentada como persistência bem-sucedida.

A demonstração sintética continua separada em `/?demo=1`; dados e esqueletos dela
não entram na revisão real. Código científico e contratos congelados não mudaram.
Nenhum serviço externo, deploy, provisão cloud, inferência ou API paga foi usado.

## Verificação local

- 150 testes Vitest: 73 herdados, 35 de observações/intervalos e 42 do transporte.
- TypeScript e build Vite aprovados; nove testes do formato de benchmark aprovados.
- 19 percursos sintéticos legados exercitados. Houve colisão de diretórios de trace
  entre duas execuções paralelas; 18 passaram e o teste afetado passou ao ser
  reexecutado com diretório próprio. Não era falha do fluxo, e não houve retry oculto.
- Três exports reais H.264/AAC 1920×1080, durações 249/350/420 s: playback,
  busca, velocidade, marcação/edição/remoção de observação aprovados em contexto
  Chromium isolado. Sem requisições externas ou overlay sintético.
- Larguras 320 e 390 px sem overflow horizontal nos três vídeos. QA visual em
  desktop e mobile emulado. Os hashes dos três originais permaneceram idênticos.
- Os testes E2E da revisão local usam WebM sintético identificado, com catálogo
  interceptado, nunca os arquivos privados. CI executa esses testes e o legado.
- Sete testes novos da revisão local passaram: playback/observações persistidas,
  seletor blob, falha e recuperação, armazenamento bloqueado, loop A–B e axe/overflow
  em 320/390 px. Os primeiros helpers foram corrigidos por selecionar navegação
  oculta no mobile e um summary com texto adicional; nenhuma regra axe foi desligada.

O resultado do CI está associado ao commit publicado e deve ser conferido no
GitHub. A nota do vault registra seu estado observado; não é aceite de praticantes.

## Limites para interpretar o teste

Os vídeos são montagens editadas, não tomadas contínuas. Marcas e loops usam
segundos de reprodução do export; não são PTS do original nem busca de quadro
exato. Loop por eventos do navegador pode variar. Dois exports excedem o limite
de ingestão científica atual (512 MiB), embora funcionem no streaming local.
Isso não altera o limite de análise do backend.

Câmera predominantemente traseira/oblíqua e múltiplas pessoas não validam o
protocolo lateral M01. Alguns exports têm placar parcial/inferido já gravado na
imagem; a aplicação não o lê nem o usa como referência esportiva. Não houve
inferência de pose, medição, validação anatômica ou indicação de melhora.

Safari/iOS, Android físico, leitor de tela real e uso sob sol ainda não foram
testados. O transporte é ferramenta local de desenvolvimento, não serviço
multiusuário de produção ou isolamento para uploads hostis. Arquivos escolhidos
no seletor precisam de codec compatível e suas anotações devem ser exportadas
antes de fechar a revisão. Catálogo é local e não acompanha o build publicado.

## Operação

Abrir conforme [frontend/README](../../frontend/README.md), porta 5185, somente
loopback. Sem catálogo preparado, o seletor de arquivo continua disponível.
Preparação e transporte: [entrega do módulo local](UX-V3-LOCAL-MEDIA.md).
Próximo gate: praticante rever seu próprio vídeo sem explicação; integração de
pose exigirá processamento do export ou mapa original/derivado verificado e
seleção explícita do jogador, antes de mostrar qualquer esqueleto real.

Mídias, miniaturas, nomes, paths, hashes de conteúdo e capturas reais ficam fora
do Git. A evidência pública é agregada; o vault aponta para o teste privado.

# Entrada guiada da demonstração — 03/11/2026

Gabriel abriu `/estados` e relatou não entender o que fazer. A galeria interna
oferecia onze ações com o mesmo destaque e não indicava um início recomendado.

A entrada agora apresenta uma ação principal, **Começar demonstração**, que
prepara o exemplo sintético e abre a seleção explícita. Nada vem pré-selecionado.
Os cenários anteriores continuam acessíveis em **Outros cenários de teste**.
Começar não apaga histórico ou observações. A criação tem estado de espera e erro.

Mantidos azul de quadra `#14408f`, azul profundo `#0c2a63`, branco `#ffffff`,
amarelo `#e4f222` e névoa `#dce6f7`; títulos Archivo e leitura Atkinson.
Uma coluna alinhada à esquerda, botão principal antes da sequência de três passos
e detalhes técnicos recolhidos. Os números representam ações em sequência.

Seleção explica como tocar e confirmar; processamento informa que a revisão abre
automaticamente; replay orienta reprodução, pausa e esqueleto e oferece retorno
ao guia. A biblioteca real explica a primeira ação e aponta para essa entrada.
O texto sobre esqueleto identifica os pontos como simulados, sem inferência real.
Contratos científicos, modelos, arquivos reais e persistência não mudaram.

## Verificação

- `npm run build`: TypeScript e Vite aprovados.
- `npx playwright test e2e/guided-demo.spec.ts e2e/journey.spec.ts e2e/local-review.spec.ts --workers=2 --output=/private/tmp/tennis-guided-demo-qa`: 20 aprovados.
- Dois testes novos: percurso guiado com escolha explícita, controles e retorno;
  entrada de 320 px, teclado, expansão de cenários, axe e ausência de overflow.
- Dezoito testes existentes: percurso sintético e revisão local com fixtures.
- Inspeção visual da entrada em 390 px. Nenhuma regra de acessibilidade desativada.

A primeira tentativa de E2E foi bloqueada pelo sandbox ao conectar/iniciar o servidor
local (`EPERM`); a execução autorizada fora dessa restrição passou. Não é falha do app.
O aviso preexistente do loader futuro do Vite permanece.

Ainda falta Gabriel experimentar o novo percurso sem instrução oral. Testes
automatizados não comprovam compreensão humana nem validação biomecânica.

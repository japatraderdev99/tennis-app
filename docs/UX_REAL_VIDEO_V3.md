# UX V3: revisão local de vídeos reais

Autorizada pelo usuário após V2. Objetivo: testar o gesto de observar um vídeo de
tênis próprio, repetir um trecho e registrar uma percepção, sem confundir playback
com análise de biomecânica. A V2 e o protótipo original de Claude ficam preservados.

## Direção visual antes do código

Quadra azul `#14408f`, azul profundo `#0c2a63`, branco `#ffffff`, superfície fria
`#f0f4fa`, texto `#17243c`, bola `#dce92b`. Archivo para títulos com largura moderada;
Atkinson Hyperlegible Next para instruções e controles. Azul organiza a navegação;
o vídeo real é o foco. Amarelo aparece em ação/seleção, sem cobrir a imagem.

Biblioteca: cabeçalho enxuto, convite para abrir vídeo, miniaturas reais grandes e
um guia curto. Revisão: player e linha do tempo largos à esquerda, observações
à direita, controles próximos ao vídeo. No celular os controles e o botão Marcar
momento vêm antes das observações. Alinhamento à esquerda, poucas bordas, hierarquia
por espaço/tamanho e nenhuma caixa decorativa de KPI.

```text
Quadro              Meus vídeos / Como filmar             Abrir vídeo
Reveja o que aconteceu na quadra
[vídeo principal / duração] [vídeo] [vídeo]

Voltar    Nome do vídeo                       Vídeo local
[            vídeo real             ] [Momentos marcados]
[tempo / seek / play / velocidade    ] [Sua observação   ]
[repetir trecho / marcar momento    ] [Salvar / remover ]
```

Revisão do plano: a interface anterior enfatizava banners e explicações antes da
observação. Nesta versão o conteúdo real organiza a tela; não usamos dashboard,
score, ângulos ilustrativos ou skeleton sintético. A demo continua em rota própria.

## Implementação e limites

- Biblioteca privada local allowlist e streaming com Range, sem expor paths.
- Abrir arquivo do próprio dispositivo por blob URL, sem enviar ao servidor.
- Reprodução nativa, velocidade, busca por tempo, repetição A–B e marcas manuais.
- Marcas usam o relógio do arquivo editado; não são eventos detectados nem PTS do
  original. Cortes/alterações de velocidade precisam de mapeamento para análise.
- Não carregar biblioteca privada em CI; testes usam vídeos sintéticos identificados.
- Testes reais/QA ficam no workspace e no vault; código e evidência agregada podem
  ser publicados na branch autorizada, sem mídias ou identificadores pessoais.

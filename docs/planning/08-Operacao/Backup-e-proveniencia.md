---
tipo: operacao
data: 2026-11-01
status: snapshot-local-backup-independente-pendente
---

# Backup e proveniência

O vault existente é a memória editorial do projeto: notas Markdown, fontes, contratos, decisões, protocolo e resultados agregados. Obsidian lê diretamente os arquivos locais; não foi necessário instalar plugin. Configurações `.obsidian` e a nota original `Bem-vindo.md` foram preservadas. [Como Obsidian armazena dados](https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data), consultado em 01/11/2026.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `00-Inicio` | Índice e estado da operação |
| `01-Referencias` | Análise dos vídeos, inventário/hashes e derivados locais de inspeção |
| `02-Pesquisa` | Ciência, tecnologias, produto e privacidade |
| `03-Produto` | Proposta consolidada |
| `04-Arquitetura` | Contratos, métricas e fixtures de estados |
| `05-Validacao` | Experimentos e critérios de sucesso |
| `06-Decisoes` | Aprovado/proposto/pendente e revisões |
| `07-Claude` | Handoff e futura resposta do head de UX/UI |
| `08-Operacao` | Equipe, scripts de inspeção/snapshot e proveniência |
| `09-Templates` | Modelo para registrar experimentos |

## O que está preservado

Sete MOVs originais na pasta pai; inventário completo em `01-Referencias/inventario-videos.json`, com SHA-256, tamanho, streams e duração. Os 217 JPEGs de amostragem e 21 folhas de contato são derivados. As sete transcrições JSON são saídas automáticas, não legendas oficiais nem validação científica. A nota de análise registra o erro de número percebido no ASR de V01.

FFmpeg/FFprobe fizeram decodificação e inventário. Faster-whisper 1.2.1 com o modelo `Systran/faster-whisper-small` já presente no cache local processou áudio em CPU/int8, inglês fixo e VAD. Bibliotecas auxiliares foram instaladas em `[ambiente-asr-local]`, sem modificar o ambiente global. O script usa áudio PCM extraído por FFmpeg para contornar incompatibilidade entre a versão de PyAV instalada e o decoder padrão de faster-whisper. Nenhum vídeo foi enviado a um serviço externo de análise. Não executamos pose, treinamento ou benchmark biomecânico.

Scripts em `08-Operacao/scripts` permitem repetir transcrição e criar/verificar snapshot editorial. Bibliotecas temporárias podem desaparecer; reexecução exige ambiente compatível. O inventário e os artefatos efetivamente produzidos são o registro desta rodada, não uma promessa de reprodutibilidade bit a bit em qualquer versão futura.

## Snapshot desta proposta

O pacote editorial é gravado em `../snapshots/App-Tennis-spec-v0.1-2026-11-01.zip`, acompanhado de SHA-256 e relatório de verificação. Inclui notas, exemplos de contrato, scripts e inventário dos vídeos. Exclui `.obsidian`, a nota de boas-vindas original, MOVs, frames, folhas de contato e transcrições brutas. O pacote permite recuperar a especificação; **não é backup integral das referências**. A inspeção por imagens continua disponível no vault local.

O script verifica o arquivo compactado e extrai uma cópia temporária para comparar os hashes de todos os arquivos incluídos. Não sobrescreve snapshot existente. Conferir `snapshots/*-verificacao.json` para o resultado real; este texto descreve o procedimento.

## Backup independente ainda pendente

Vault e ZIP estão no mesmo dispositivo. Protegem contra algumas alterações acidentais, mas não contra perda do Mac. Sincronização também não equivale automaticamente a backup; a documentação do Obsidian faz essa distinção. [Backup do Obsidian](https://help.obsidian.md/backup), consultado em 01/11/2026.

Proposta: versionamento privado dos textos/contratos e cópia periódica criptografada para destino independente, incluindo originais quando seus direitos e privacidade permitirem. Definir responsável, periodicidade, retenção e teste de restauração. Um repositório remoto de notas não substitui backup de vídeos; backup de vídeos não substitui o histórico das decisões. Nenhum remoto, sincronização, serviço pago ou automação foi configurado nesta rodada.

Não armazenar credenciais, dados identificáveis de participantes ou consentimentos em notas compartilháveis. Os vídeos de referência contêm elementos incidentais de interface/notificações; evitar sincronizar/publicar seus derivados sem revisão. A exclusão de futuros dados de participantes deve alcançar também retenção de backups segundo a política escolhida.

## Atualização após aprovação de Gabriel

Novo pacote canônico do planejamento: `../snapshots/App-Tennis-spec-v0.1-aprovada-planejamento-2026-11-01.zip`, produzido com `--planning-only`. Preserva os documentos da proposta e o registro de aprovação, incluindo o handoff. Os demais materiais paralelos em `07-Claude` ficam fora deste pacote até revisão; continuam preservados no workspace. O snapshot original v0.1 não foi alterado. O checkpoint intermediário `v0.1-aprovada` contém notas paralelas ainda não integradas e não representa aprovação de seu conteúdo.

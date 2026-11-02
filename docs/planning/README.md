# Planejamento do Tennis App

Cópia portátil de notas selecionadas do vault Obsidian, com links navegáveis no GitHub. O vault local continua sendo a fonte editorial; esta pasta é um espelho gerado. Caminhos pessoais e IDs de chats foram substituídos.

Os documentos registram decisões de 01–02/11/2026. Frases como ‘sem remoto’ descrevem o checkpoint anterior à publicação. O estado atual do código está no [README principal](../../README.md), em [HEAD-P1](../deliveries/HEAD-P1.md) e em [HEAD-P2](../deliveries/HEAD-P2.md).

## Índice

- [Leia-primeiro](00-Inicio/Leia-primeiro.md)
- [Analise-dos-sete-videos](01-Referencias/Analise-dos-sete-videos.md)
- [Validade-cientifica](02-Pesquisa/Validade-cientifica.md)
- [Stack-e-modelos](02-Pesquisa/Stack-e-modelos.md)
- [Produto-mercado-e-privacidade](02-Pesquisa/Produto-mercado-e-privacidade.md)
- [Proposta-integrada](03-Produto/Proposta-integrada.md)
- [Arquitetura-e-contratos](04-Arquitetura/Arquitetura-e-contratos.md)
- [Arquitetura-cloud-do-piloto](04-Arquitetura/Arquitetura-cloud-do-piloto.md)
- [Catalogo-de-metricas](04-Arquitetura/Catalogo-de-metricas.md)
- [Plano-de-validacao](05-Validacao/Plano-de-validacao.md)
- [Registro-de-decisoes](06-Decisoes/Registro-de-decisoes.md)
- [Aprovacao-Gabriel-v0.1](06-Decisoes/Aprovacao-Gabriel-v0.1.md)
- [Handoff-Claude-Opus](07-Claude/Handoff-Claude-Opus.md)
- [Equipe-e-operacao](08-Operacao/Equipe-e-operacao.md)
- [Preparacao-P0-P1](08-Operacao/Preparacao-P0-P1.md)
- [Plano-de-implementacao-backend-v0.1](08-Operacao/Plano-de-implementacao-backend-v0.1.md)
- [Quadro-operacional-backend](08-Operacao/Quadro-operacional-backend.md)
- [Checkpoint-P1-fundacao-2026-11-01](08-Operacao/Checkpoint-P1-fundacao-2026-11-01.md)
- [Onda-P2-pose-e-arquitetura-cloud](08-Operacao/Onda-P2-pose-e-arquitetura-cloud.md)
- [Checkpoint-P2-laboratorio-2026-11-02](08-Operacao/Checkpoint-P2-laboratorio-2026-11-02.md)
- [Backup-e-proveniencia](08-Operacao/Backup-e-proveniencia.md)
- [Registro-da-entrega-2026-11-01](08-Operacao/Registro-da-entrega-2026-11-01.md)
- [Template-experimento](09-Templates/Template-experimento.md)

## Contratos e material omitido

Os JSONs de `04-Arquitetura/exemplos/` são **rascunhos históricos de discussão**; não são o contrato executável. Consulte [CONTRACTS_V0](../CONTRACTS_V0.md), [schemas atuais](../../schemas/README.md) e as fixtures em `tests/contracts/`.

Mídias, frames, folhas de contato, transcrições integrais, inventário detalhado, configurações do Obsidian, scripts do vault e pesquisa/conceito/experimentos preliminares do Claude permanecem somente no workspace. Referências a esses materiais nas notas não significam que estejam neste repositório.

## Atualização

```sh
python scripts/export_planning.py --vault /caminho/do/vault
python scripts/export_planning.py --vault /caminho/do/vault --check
```

O exportador usa uma lista explícita de arquivos, não altera o vault e não remove arquivos inesperados silenciosamente. `manifest.json` registra hashes da origem e da cópia portátil. Alterações editoriais voltam ao vault antes da exportação.

---
tipo: mapa
status: aprovado-por-gabriel-revisao-claude-pendente
versao: 0.1
data: 2026-11-01
responsavel: Codex
---

# App Tennis — cérebro da operação

**Direção aprovada por Gabriel em 01/11/2026:** ajudar o tenista que treina sozinho a observar um movimento, entender um foco e acompanhar mudanças sustentadas, com evidências do próprio vídeo e limites de medição explícitos.

O público inicial foi confirmado por Gabriel: **tenistas treinando sozinhos, sem treinador no uso do app**. Especialistas humanos continuam necessários na criação e validação das orientações. Nome comercial, plataforma inicial, orçamento e métricas biomecânicas liberadas ainda estão em aberto.

Registro da aprovação: Aprovacao-Gabriel-v0.1 (material local não incluído). Próximas entregas: [Preparacao-P0-P1](../08-Operacao/Preparacao-P0-P1.md).

**Implementação autorizada em 01/11/2026:** Plano-de-implementacao-backend-v0.1 (material local não incluído)
e [Quadro-operacional-backend](../08-Operacao/Quadro-operacional-backend.md) registram as branches, chats Sol 6.1/high e gates.
Backend/data science começam pela bancada local; UX/UI/frontend ficam com Claude
na etapa posterior. O quadro operacional é a referência de status do código.

## Comece por aqui

1. [Proposta-integrada](../03-Produto/Proposta-integrada.md) — decisão de produto, escopo e recomendação do head.
2. [Analise-dos-sete-videos](../01-Referencias/Analise-dos-sete-videos.md) — o que as referências mostram, timecodes e limites.
3. [Validade-cientifica](../02-Pesquisa/Validade-cientifica.md) — literatura, mensuração e protocolo científico.
4. [Stack-e-modelos](../02-Pesquisa/Stack-e-modelos.md) — opções técnicas e licenças a confirmar por artefato.
5. [Produto-mercado-e-privacidade](../02-Pesquisa/Produto-mercado-e-privacidade.md) — concorrência, descoberta e proteção de dados.
6. [Arquitetura-e-contratos](../04-Arquitetura/Arquitetura-e-contratos.md) e [Catalogo-de-metricas](../04-Arquitetura/Catalogo-de-metricas.md) — responsabilidades do backend e interface com o frontend.
7. [Plano-de-validacao](../05-Validacao/Plano-de-validacao.md) — experimentos e critérios para avançar.
8. [Handoff-Claude-Opus](../07-Claude/Handoff-Claude-Opus.md) — pacote pronto para revisão do head de UX/UI.
9. [Equipe-e-operacao](../08-Operacao/Equipe-e-operacao.md), [Registro-de-decisoes](../06-Decisoes/Registro-de-decisoes.md) e [Backup-e-proveniencia](../08-Operacao/Backup-e-proveniencia.md) — como manter o trabalho organizado.

Verificações e limites desta rodada: [Registro-da-entrega-2026-11-01](../08-Operacao/Registro-da-entrega-2026-11-01.md).

## Estado real nesta entrega

| Item | Estado |
|---|---|
| Pesquisa de referências, produto, ciência e arquitetura | Direção v0.1 aprovada por Gabriel; revisão de Claude e validação científica pendentes |
| Sete vídeos originais | Preservados na pasta pai; inventário SHA-256 em `01-Referencias/inventario-videos.json` |
| Vault existente | Estruturado com notas Markdown; configurações originais preservadas |
| Concordância de Gabriel com o público solo | Confirmada nesta conversa |
| Escolha de começar pelo saque | Aprovada por Gabriel como primeiro recorte de investigação |
| Revisão do Claude Opus | Materiais preliminares atribuídos ao Claude encontrados; revisão formal e integração pendentes |
| Revisão por biomecanicista/treinador | Pendente; ninguém foi contratado ou consultado como especialista humano |
| Dataset próprio e benchmark de validade | Pendentes; materiais do Claude receberam leitura estática parcial, sem reprodução do benchmark |
| Backend integrado e aplicativo funcional | Fundação local backend/CLI integrada em main, 674 testes e demo sintética; API, inferência de pose e aplicativo ainda não implementados. Ver [Checkpoint-P1-fundacao-2026-11-01](../08-Operacao/Checkpoint-P1-fundacao-2026-11-01.md) |
| Benefício esportivo, segurança de recomendações e disposição a pagar | Hipóteses a testar |
| Backup fora deste dispositivo | Não configurado/verificado |

## Regras de leitura

- **Observado:** consta nos vídeos/arquivos ou em uma fonte explicitamente indicada.
- **Evidência externa:** resultado de um estudo no seu contexto; não mede nosso futuro aplicativo.
- **Hipótese:** precisa de experimento.
- **Proposta:** recomendação para decisão conjunta.
- **Aprovado:** exige autor, data e escopo no [Registro-de-decisoes](../06-Decisoes/Registro-de-decisoes.md).

Não usar mock, animação ou resposta de LLM como evidência de acurácia. Não transformar pesquisa em promessa comercial. Fonte de verdade do planejamento é este vault; código futuro, dados e resultados de experimentos terão repositórios/armazenamento próprios referenciados aqui.

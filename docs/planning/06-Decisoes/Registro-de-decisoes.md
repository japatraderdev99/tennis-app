---
tipo: registro
data: 2026-11-01
---

# Registro de decisões

| ID | Questão | Estado | Autor / evidência | Consequência |
|---|---|---|---|---|
| DEC-001 | Público inicial: tenistas treinando sozinhos, sem treinador | Confirmado | Gabriel, resposta nesta conversa em 01/11/2026 | Captura e compreensão não dependem de assistência |
| DEC-002 | Codex head backend/data science; Claude head UX/UI | Confirmado como divisão de papéis | Pedido de Gabriel | Frontend não foi implementado nesta rodada |
| DEC-003 | Vault como registro e organização | Confirmado | Pedido de Gabriel; vault local existente identificado | Notas interligadas, versões e evidências |
| DEC-004 | Começar por preparação do saque | Aprovado para investigação | Gabriel, 01/11/2026; Aprovacao-Gabriel-v0.1 (material local não incluído) | Revisão de UX/UI e validade ainda pendentes |
| DEC-005 | Métrica 2D candidata; 3D/bola/pronação em pesquisa posterior | Direção aprovada; medida não validada | [Validade-cientifica](../02-Pesquisa/Validade-cientifica.md) | Não há métrica liberada neste momento |
| DEC-006 | Templates de explicação antes de LLM livre | Direção aprovada | [Arquitetura-e-contratos](../04-Arquitetura/Arquitetura-e-contratos.md) | Resultado útil pode funcionar sem modelo generativo |
| DEC-007 | MediaPipe baseline; RTMPose comparador | Aprovado para benchmark | [Stack-e-modelos](../02-Pesquisa/Stack-e-modelos.md) | Depende de benchmark e artefatos licenciados |
| DEC-008 | Adultos no primeiro piloto | Recorte aprovado | [Produto-mercado-e-privacidade](../02-Pesquisa/Produto-mercado-e-privacidade.md) | Recrutamento e conteúdo a revisar |
| DEC-009 | Plataforma mobile e provedor cloud | Em aberto | Celulares/budget ainda não definidos | Não fechar stack de frontend nem comprar infraestrutura |
| DEC-010 | Backup independente | Pendente | Vault/snapshot locais não resistem à perda do Mac | Escolher destino e executar teste de restauração |

## Aprovação da direção v0.1

**DEC-011 — Gabriel, 01/11/2026:** aprovação da proposta em resposta à entrega. Escopo e pendências registrados em Aprovacao-Gabriel-v0.1 (material local não incluído); preparação de P0/P1 em [Preparacao-P0-P1](../08-Operacao/Preparacao-P0-P1.md). As atualizações de DEC-004 a DEC-008 registram essa aprovação de direção, sem promover hipóteses a fatos ou substituir revisão científica/Claude. DEC-009 e DEC-010 continuam abertos.

## Ajustes da revisão cruzada desta rodada

- Unificada a nomenclatura: P0 descoberta/experiência, P1 laboratório, P2 piloto solo, P3 expansão.
- Reprocessamento de versão foi separado de incompatibilidade geométrica de captura.
- Elegibilidade definida antes do modelo e cobertura também reportada sobre todos os envios.
- Explicitado que todas as sessões da mesma pessoa ficam na mesma partição de dados.
- “Educação validada” substituída por conteúdo revisado/compreensão testada, sem alegar benefício esportivo.
- Upload concluído apenas disponibiliza asset; solicitação de análise é o único disparo de execução.
- Lacuna que pode esconder pico invalida a tentativa conforme regra pré-registrada.
- Exclusão distingue bloqueio da API e propagação para links/artefatos/caches/backups.

## Como registrar a próxima decisão

**DEC-012 — implementação autorizada, Gabriel, 01/11/2026:** iniciar código com
chats operacionais `gpt-6.1-sol` / `high`, branches organizadas e Codex como head
backend/data science. UX/UI/frontend com Claude em etapa posterior. Isso permite
iniciar a fundação técnica sem esperar o fechamento visual. Escopo executável e
gates em Plano-de-implementacao-backend-v0.1 (material local não incluído); acompanhamento em
[Quadro-operacional-backend](../08-Operacao/Quadro-operacional-backend.md). Não autoriza afirmar validade científica ou
contratar/publicar infraestrutura. O head fechou as ambiguidades de estados,
tempo e separação research/público no adendo `docs/CONTRACTS_V0.md` do repositório.

Adicionar ID, contexto, alternativas, evidências, decisão, autor/data, consequências, arquivos afetados e critério de reabertura. `proposto` não vira `aprovado` porque o documento foi escrito ou um agente concordou. Correção de erro factual pode ser aplicada com registro; mudança de prioridade exige a decisão apropriada.

## Integração da primeira onda

**DEC-013 — Codex head, 01/11/2026, decisão técnica dentro de DEC-012:**
aceitar a fundação local após revisão e 674 testes, promovendo o commit
`432197224ef6ed74628770f7e8fe35951bbfc030` para `main` e a tag
`p1-foundation-v0.1.0`. Detalhes em [Checkpoint-P1-fundacao-2026-11-01](../08-Operacao/Checkpoint-P1-fundacao-2026-11-01.md).
Clarificada a fase de um frame: pode ser representada, mas retorna evidência
insuficiente; dois frames utilizáveis são mínimo computacional desta implementação,
sem significado de validade científica. Próximos gates: API/persistência, adaptador
de pose e benchmark; UX/UI/frontend com Claude após contrato de serviço estável.
Aceitação técnica do head não equivale a aprovação humana de experiência,
validação biomecânica, publicação ou serviço em produção.

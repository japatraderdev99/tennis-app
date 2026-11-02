---
tipo: quadro-operacional
data: 2026-11-01
responsavel: Codex
---

# Quadro operacional backend

Plano: Plano-de-implementacao-backend-v0.1 (material local não incluído). Atualizado pelo head conforme
evidência real; criação de chat, implementação, teste, integração e validação
científica são estados diferentes.

| Frente | Modelo/esforço | Branch | Chat | Estado | Commit / verificação |
|---|---|---|---|---|---|
| BE-01 Contratos | gpt-6.1-sol / high | feat/contracts-v0 | [chat-local] | Concluído e integrado | aa401de; 486 testes individuais |
| BE-02 Mídia | gpt-6.1-sol / high | feat/media-ingest-v0 | [chat-local] | Concluído e integrado | b8623db; 55 testes individuais |
| DS-01 Métricas | gpt-6.1-sol / high | feat/research-metrics-v0 | [chat-local] | Concluído e integrado | 9d48df7; 116 testes individuais |
| HEAD Integração | Chat principal | integrate/p1-foundation → main | [chat-local] | Fundação local aceita | 4321972; 674 testes totais + demo |

Frontend: Claude, etapa posterior. Nenhuma branch de frontend foi atribuída a Codex.
Repositório local sem remote; backup independente continua pendente.

Os chats foram criados no projeto App Tennis em ambiente local; os checkouts Git
isolados foram preparados pelo head e indicados explicitamente em cada prompt.
Isso não depende do diretório pai ser um repositório nem de worktrees gerenciados
pelo aplicativo. O cache uv fica em `[cache-uv-local]`; cada checkout
tem seu próprio ambiente virtual. A resolução inicial fixou Pydantic 2.14.2,
pytest 8.4.2 e demais transitivas em `uv.lock`.

## Checkpoint aceito

- `main`: `432197224ef6ed74628770f7e8fe35951bbfc030`.
- Tag local: `p1-foundation-v0.1.0`.
- Os três chats terminaram suas tarefas e estão disponíveis para continuação;
  não há implementação dependente executando silenciosamente nesta rodada.
- Branches originais preservadas como entregues. O ajuste de fase com um frame
  pertence ao commit de integração: entrada representável, resultado insuficiente.
- Código/CLI local integrado; nenhum app visual, API HTTP ou modelo de pose ainda.
- Ver [Checkpoint-P1-fundacao-2026-11-01](Checkpoint-P1-fundacao-2026-11-01.md) para evidências e próximos gates.

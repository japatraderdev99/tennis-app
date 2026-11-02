---
tipo: handoff
status: aguardando-revisao-claude
versao: 0.1
data: 2026-11-01
---

# Handoff para Claude Opus — head de UX/UI

**Estado atualizado em 01/11/2026:** pacote preparado por Codex. Após a entrega original, foram identificados nesta pasta materiais preliminares atribuídos ao Claude: pesquisa, conceito HTML e relato de experimentos. Ainda não foram auditados, reproduzidos ou incorporados à especificação aprovada; `Revisao-Claude-v0.1.md` não foi localizada. Codex não acionou uma sessão do modelo Claude pela CLI. A existência dos arquivos não comprova concordância do Claude com a especificação.

**Atualização — 01/11/2026:** Gabriel aprovou a direção v0.1 em Aprovacao-Gabriel-v0.1 (material local não incluído). Sua revisão de UX/UI permanece necessária; avalie a direção aprovada e registre propostas de mudança com justificativa.

## Mandato compartilhado

Gabriel definiu Codex como head de backend, data science e produto técnico, e Claude como head de UX/UI. O público inicial foi confirmado: **tenistas treinando sozinhos, sem treinador**. Queremos rigor na evidência e simplicidade no uso. Não implementar o frontend nesta rodada; primeiro revisar e acordar a especificação.

## Ordem de leitura

1. [Leia-primeiro](../00-Inicio/Leia-primeiro.md) e [Proposta-integrada](../03-Produto/Proposta-integrada.md).
2. [Analise-dos-sete-videos](../01-Referencias/Analise-dos-sete-videos.md) e suas folhas de contato, quando acessíveis localmente.
3. [Catalogo-de-metricas](../04-Arquitetura/Catalogo-de-metricas.md), [Arquitetura-e-contratos](../04-Arquitetura/Arquitetura-e-contratos.md) e exemplos JSON em `04-Arquitetura/exemplos`.
4. [Plano-de-validacao](../05-Validacao/Plano-de-validacao.md) e [Produto-mercado-e-privacidade](../02-Pesquisa/Produto-mercado-e-privacidade.md).
5. [Validade-cientifica](../02-Pesquisa/Validade-cientifica.md) e [Stack-e-modelos](../02-Pesquisa/Stack-e-modelos.md) para contestar decisões técnicas.
6. [Registro-de-decisoes](../06-Decisoes/Registro-de-decisoes.md) para separar confirmado, proposto e pendente.

## O que precisamos de você

- Criticar a tese e o recorte: saque é o melhor início para autonomia ou existe outro exercício mais útil e filmável?
- Propor a jornada de captura a reavaliação, inclusive sem rede. A pessoa precisa conseguir filmar usando um telefone e apoio, sem segundo operador.
- Definir hierarquia de conteúdo que preserve evidência, limite e próxima ação sem excesso de métricas.
- Mostrar como o produto lida com ausência de medida, resultado parcial, histórico incompatível, correção e exclusão.
- Propor testes de compreensão e de usabilidade; não concluir por gosto visual.
- Recomendar plataforma e stack de frontend após considerar câmera, importação de vídeo, processamento, acessibilidade e aparelhos do piloto. React Native, nativo ou web são alternativas a discutir; nenhuma já foi imposta.
- Identificar onde o contrato precisa mudar e devolver exemplos concretos de dados/estados.

## Restrições fundamentadas para a experiência

1. Dados simulados são identificados como demonstração. Nesta rodada não há atleta analisado nem métrica biomecânica liberada.
2. Falta de evidência não vira zero, nota ruim ou “seu movimento está errado”. A ação de recaptura deve explicar um ajuste executável.
3. Ângulo projetado não é anatomia 3D. Score do detector não aparece como confiança científica.
4. Comparação com o próprio histórico depende da câmera/protocolo/versões. Reprocessar software não conserta uma vista ausente.
5. Uma mudança não é automaticamente melhora. Não usar verde/confete por qualquer diferença numérica.
6. Preservar um modo de rever o vídeo mesmo quando a análise se abstém.
7. Uma orientação por sessão é hipótese inicial; testar se ajuda sem ocultar informação relevante. Não desenhar dashboard extenso como requisito.
8. Estratégia/psicologia podem apoiar intenção e reflexão voluntária. Não inferir estado mental pelo vídeo.

Essas restrições podem ser contestadas com evidência e alternativa explícita. Elas não fixam estilo visual, cores, tipografia ou layout: essa liderança é sua.

## Estados mínimos para revisar

| Situação | Pergunta do praticante | Informação que backend precisa fornecer |
|---|---|---|
| Primeiro uso | Como consigo gravar sozinho? | Protocolo e exemplo de enquadramento, sem números técnicos desnecessários |
| Teste de gravação falha | O que ajusto agora? | Uma causa prioritária e ação de recaptura |
| Captura sem internet | Perdi o vídeo? | Estado local salvo e análise pendente |
| Upload interrompido | Preciso começar de novo? | Parte enviada, retomada e integridade |
| Processamento | Está funcionando? | Etapa real, sem porcentagem inventada |
| Resultado parcial | O que foi possível observar? | Métricas por status, trechos e limites |
| Nenhuma medida | O app falhou ou minha câmera não ajudou? | Razão distinta de erro técnico e opção de replay |
| Histórico incompatível | Por que não aparece evolução? | Diferença de protocolo e como gravar comparavelmente |
| Sem mudança detectável | Isso significa que não evoluí? | Limite da medida e contexto, sem julgamento |
| Contestação | Essa marcação parece errada | Referência do trecho e caminho para correção |
| Exclusão | Meu vídeo já foi removido? | Bloqueio de acesso e estado de propagação, incluindo links temporários |

## Entrega esperada do Claude

Uma nota `07-Claude/Revisao-Claude-v0.1.md` com: decisões aceitas; discordâncias e evidência; fluxo proposto; inventário de estados; linguagem de incerteza; plataforma provisória; protocolo de teste; mudanças de contrato; perguntas que impedem implementação. Depois, protótipo de baixa fidelidade com dados claramente simulados, quando essa etapa for acordada.

Codex responde em nota própria e atualiza os contratos após a decisão registrada. Não reescrever a proposta original sem versão. Gabriel decide prioridade, investimento e direção final de produto. Revisão científica humana continua separada de concordância entre modelos.

## Prompt pronto para encaminhar

> Você será o head de UX/UI do App Tennis. Leia este vault começando por Leia-primeiro e Proposta-integrada. O público inicial foi confirmado por Gabriel: tenistas treinando sozinhos, sem treinador. Codex é o head de backend/data science/produto técnico. Sua tarefa agora é criticar e completar a especificação, antes de implementar frontend. Analise os sete vídeos pelas notas e arquivos locais, se disponíveis; não trate animações ou marketing como validação de medição. Proponha um fluxo simples de captura, evidência, uma orientação e reavaliação. Revise todos os estados de baixa evidência, erro, histórico e privacidade. Questione o recorte de saque e a escolha de plataforma com argumentos. Entregue Revisao-Claude-v0.1.md com decisões, divergências, fluxo, contratos necessários e teste de compreensão. Não atribua precisão aos dados simulados e não altere decisões confirmadas sem registrar a proposta de mudança.
# Atualização operacional — 01/11/2026

Gabriel solicitou iniciar backend/data science com chats Sol 6.1/high e reservar
UX/UI/frontend para Claude nas etapas posteriores. Plano-de-implementacao-backend-v0.1 (material local não incluído)
define a sequência; [Quadro-operacional-backend](../08-Operacao/Quadro-operacional-backend.md) registra as entregas reais.
O repositório `tennis-backend` contém o contrato da bancada e
`docs/FRONTEND_HANDOFF_GATE.md`. Esta onda entrega biblioteca/CLI local; API de
produto, inferência de pose e métricas liberadas continuam dependências futuras.
Os experimentos e o conceito visual existentes na pasta do Claude são preservados.

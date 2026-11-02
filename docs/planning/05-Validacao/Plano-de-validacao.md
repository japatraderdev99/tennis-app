---
tipo: plano
status: proposto-nao-executado
versao: 0.1
data: 2026-11-01
---

# Plano de validação e sucesso

**Nenhuma meta abaixo foi atingida ou medida.** Este é o plano para decidir se implementamos, restringimos ou retiramos uma funcionalidade. As fontes e pressupostos estatísticos estão em [Validade-cientifica](../02-Pesquisa/Validade-cientifica.md); indicadores de produto em [Produto-mercado-e-privacidade](../02-Pesquisa/Produto-mercado-e-privacidade.md). A nomenclatura P0–P3 segue [Proposta-integrada](../03-Produto/Proposta-integrada.md).

## Três critérios independentes

1. **Medição:** a grandeza declarada é mensurável com erro e cobertura adequados no cenário validado.
2. **Uso solo:** a pessoa filma, compreende e repete sem alguém conduzindo a tarefa.
3. **Utilidade:** o ciclo acrescenta valor sobre câmera lenta e notas; efeito esportivo requer investigação posterior.

Uma nota de satisfação não libera uma medida. Uma boa medida não prova que a interface ensina. Retenção no app não prova melhora no tênis.

## Sequência e entregáveis

| Experimento | Etapa / dono | Procedimento | Entrega e decisão |
|---|---|---|---|
| EXP-001 — captura solo | P0 / Claude + Gabriel | 8–12 entrevistas e tarefas observadas; telefone+suporte, sem ajuda na execução; separar rodada moderada e não assistida | Motivos de falha, tempo e ajustes do guia |
| EXP-002 — definição e referência | P1 / ciência | 12–20 adultos como viabilidade; duas sessões de até dez saques; dois anotadores independentes | Manual de anotação, discordância e dados suficientes para dimensionar estudo confirmatório |
| EXP-003 — estimadores | P1 / CV | MediaPipe e RTMPose no mesmo conjunto; erros por atleta/fase, tempo e cobertura | Escolha de baseline ou retirada da medida |
| EXP-004 — repetição da aquisição | P1 / ciência | Desmontar/remontar suporte; repetir em outro dia; testar alterações de câmera separadamente | Erro test-retest/MDC do resumo da sessão e regra de comparação |
| EXP-005 — clareza do relatório | P0/P2 / Claude | Exibir resultados simulados e depois reais; comparar com câmera lenta+nota, alternando ordem | Rubrica de compreensão; distinguir observação, limite e próximo passo |
| EXP-006 — operação e privacidade | P2 / backend + QA | Upload interrompido, worker morto, arquivo inválido, exclusão, acesso entre contas, modelo atualizado | Evidência de recuperação, isolamento e ausência de ressurreição de dados |
| EXP-007 — ciclo autônomo | P2 / produto | Piloto em pelo menos duas sessões; nenhuma interpretação obrigatória por treinador | Ciclo útil, retorno comparável, fricção e custo |
| EXP-008 — aprendizagem | Após P2 / ciência | Desenho prospectivo, controle, retenção sem feedback e transferência; tamanho amostral calculado | Evidência de efeito antes de ampliar alegações |

O número de participantes de viabilidade não é poder estatístico confirmatório. Para anotação, estratificação e cálculo dos intervalos, atletas são unidades agrupadoras; milhares de frames do mesmo atleta não são milhares de indivíduos. Todas as sessões e derivados de uma pessoa ficam na mesma partição. Congelar teste antes de ajustar limites. Se o teste revelar necessidade de ajuste, ele deixa de ser teste final.

## Critérios quantitativos provisórios

| Dimensão | Hipótese de aceitação para discutir | Como ler |
|---|---|---|
| M01 2D | MAE ≤5° e limites de concordância dentro de aproximadamente ±10° | Contra referência projetada; com IC e análise por estrato. Não valida anatomia 3D |
| Evento de preparação | ≥90% dentro de ±2 frames originais a 60 fps, também expresso em ms | Não transfere a tolerância para impacto nem para fps diferentes |
| Falso aceite de captura | ≤5% dos casos inelegíveis segundo referência independente | Informar IC, n e motivo; não esconder falhas removendo-as do denominador |
| Repetibilidade | MDC95 menor que mudança relevante definida antes do teste | Estimar para o mesmo resumo exibido; ICC isolado não aprova |
| Autonomia | Pelo menos 80% concluem captura e abrem evidência sem ajuda | Meta de teste inicial; usar n/n total e incerteza, sem extrapolar amostra pequena |
| Compreensão | Pelo menos 80% explicam observação, limite e próximo passo em rubrica | Não usar “pareceu útil” como substituto; rever casos de certeza indevida |
| Desempenho técnico | p95 de processamento ≤2 min para clipe ≤60 s no ambiente definido | Hipótese de UX, exclui upload; registrar também tempo total percebido |
| Fundamentação | Zero números inventados e zero afirmações diagnósticas no conjunto de liberação | Gate do conjunto testado, não garantia estatística de risco zero |

Limites de ciência precisam de revisor humano e pré-registro antes da etapa confirmatória. Limites de produto são hipóteses de decisão, ajustáveis após descoberta com justificativa registrada. Não relaxar silenciosamente para aprovar resultado.

## Métrica principal de produto proposta

**Ciclo útil em 14 dias** = participantes que obtêm captura utilizável, compreendem uma observação e retornam com uma sessão comparável / participantes recrutados elegíveis que tiveram a janela completa de acompanhamento.

Reportar também funil por todos os convites/participantes que iniciaram, razão de desistência, frequência habitual e definição de elegibilidade fixada antes do teste. Análises condicionadas a primeira sessão válida são secundárias, nunca o único número. O prazo de 14 dias deve ser ajustado ao comportamento real encontrado nas entrevistas, antes do piloto de retenção.

Cobertura = sessões com pelo menos uma métrica reportável / todas as sessões submetidas; apresentar ainda a versão condicionada a protocolo elegível **determinado independentemente do modelo**. Guardar ambas para expor fricção e seleção de casos fáceis.

Acerto autorrelatado, erro angular, satisfação, retenção e custo ficam separados. Receita só existe após pagamento efetivo; interesse e intenção não substituem teste comercial.

## Registro obrigatório por execução experimental

Hipótese, responsável, protocolo, versão da métrica, critérios e limites prévios; participantes pseudonimizados; permissões/finalidades; partição por pessoa; hashes de entradas/pesos; ambiente/configuração; rótulos e adjudicação; métricas com denominadores/IC; falhas e exclusões; custo/latência; limitações; conclusão; decisão e revisor.

Modelo reutilizável: [Template-experimento](../09-Templates/Template-experimento.md). Raw data e consentimentos identificáveis não vão para notas abertas do vault. Resultado negativo é preservado; não reescrever o histórico para parecer que a hipótese sempre foi outra.

## Regra de avanço

**P0→P1:** pergunta de produto clara, protocolo praticável, medida operacional e revisor definido. A pesquisa de UX e a bancada podem iterar juntas.

**P1→P2:** erro/cobertura/repetibilidade aceitos por métrica; conteúdos revisados; compreensão testada; stack e direitos de uso documentados; operação e privacidade verificadas. Se a medida falhar, pilotar replay com o escopo descrito honestamente.

**P2→P3:** utilidade recorrente e viabilidade operacional demonstradas. Cada golpe ou nova medida passa por validação própria. Não liberar efeito de treino, diagnóstico ou prevenção por extrapolação.

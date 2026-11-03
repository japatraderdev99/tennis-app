# Ferramentas e laboratório de avaliação de interfaces

Pesquisa em fontes oficiais em 2026-11-02. Escopo: reconstruir e avaliar interfaces
e fluxos a partir de referências autorizadas, como o nosso protótipo e suas
capturas. Não é engenharia reversa de binários nem acesso a código privado alheio.
Os repositórios abaixo foram pesquisados; **nenhum agente externo foi instalado
ou executado nesta rodada**. Licença não significa qualidade ou adequação comprovada.

## Projetos que fazem sentido para o Quadro

| Projeto / fonte primária | Papel | Licença observada | Uso proposto |
| --- | --- | --- | --- |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) | Ferramentas de navegador para um agente; árvore de acessibilidade e imagens | Apache-2.0 | Primeiro adaptador: já usamos Playwright. Não é por si só um agente ou avaliador. Canvas exige inspeção visual além da árvore. |
| [Browser Use](https://github.com/browser-use/browser-use) | Agente de navegação com modelos conectáveis | MIT | Segundo concorrente, sob orçamento de ações/tempo/API explícito. Custo de modelo e infraestrutura é separado. |
| [BrowserGym](https://github.com/ServiceNow/BrowserGym) | Ambiente comum de tarefas e agentes | Apache-2.0 | Padronizar execuções quando houver vários agentes. Não importar um ambiente pesado só para seis tarefas locais. |
| [AgentLab](https://github.com/ServiceNow/AgentLab) | Experimentos e análise de traces sobre BrowserGym | Apache-2.0 | Comparações repetidas e reprodução de falhas, depois de estabilizar nosso catálogo. |
| [VisualWebArena](https://github.com/web-arena-x/visualwebarena) | Referência de avaliação visual e funcional de navegação | MIT no código | Aproveitar metodologia e objetivos verificáveis; sites/dados e sua licença precisam ser avaliados separadamente. |
| [Design2Code](https://github.com/NoviScl/Design2Code) | Metodologia screenshot → código | MIT no código; ODC-By nos dados, com ressalva de pesquisa no README | Referência de avaliação visual. Não copiamos dataset/checkpoints; conciliar os termos antes de eventual reutilização. |
| [screenshot-to-code](https://github.com/abi/screenshot-to-code) | Reconstrução de UI a partir de referências visuais | MIT | Experimento opcional com nossas próprias capturas; sem presumir correção funcional do resultado. |

Na consulta, GitHub indicou Playwright MCP v0.0.84 e Browser Use 0.13.14, ambos
não arquivados. Parte dos históricos dos outros projetos veio de páginas em cache;
não usamos essas datas como prova de manutenção atual. Antes de instalar um
concorrente, fixar SHA, dependências, licença, modelo e parâmetros. Não há ranking
de qualidade entre esses projetos nesta entrega.

## Arquitetura escolhida

```text
Referências próprias + tarefa + snapshot sintético inicial
                         |
              Executor em contexto isolado
      [Playwright determinístico — implementado]
      [Agente + MCP / Browser Use — futuro]
                         |
    Capturas, ações, término, erros, tempo e metadados
                         |
         Verificador fora do controle do executor
      [asserções Playwright — implementadas]
      [grader de trace de agente — ainda pendente]
                         |
        Resultado validado + proveniência + revisão humana
```

O código está em `frontend/benchmarks/` e `frontend/e2e/benchmark.spec.ts`.
Reutilizamos React, TypeScript, Vite, Playwright e axe existentes; nenhum framework
de agentes novo é necessário para o baseline. O catálogo tem seis tarefas:
primeiro uso, resseleção, replay após falha, replay após cancelamento, exclusão e
histórico, e escolha explícita usando teclado.

Cada execução começa com estado sintético limpo. A saída registra commit, hash de
fontes, alterações locais, navegador, viewport, duração e observações por tarefa.
O normalizador rejeita tarefas ausentes, duplicadas, retries escondidos e falhas
globais do runner. Não converte ausência de execução em aprovação. Traces de
agentes só são aceitos como pendentes de avaliação independente: isso é um formato
de intercâmbio, ainda não um adaptador nem um grader implementado.

## O que medir, sem misturar objetivos

1. **Funcionamento do app:** tarefas determinísticas concluídas, falhas técnicas,
   teclado e regras axe. As verificações científicas cobrem somente invariantes
   explícitos de apresentação, não a verdade biomecânica ou toda possível frase.
2. **Capacidade de um agente:** sucesso por avaliador independente em todas as
   tentativas, ações, duração, timeouts, custo/tokens quando mensuráveis. Fixar versão,
   modelo, orçamento, contexto inicial e viewport; guardar todas as repetições e
   falhas. Hoje estas medidas permanecem não avaliadas.
3. **Reconstrução visual:** preservar referências próprias, dimensões e fontes;
   comparar layout, hierarquia, conteúdo, interação e estados. Sem score único de
   similaridade como substituto do teste funcional. Experimento ainda não executado.
4. **Uso humano:** praticante sozinho consegue escolher-se, identificar lacuna,
   rever e excluir sem explicação? Observar compreensão, ajuda necessária e erros.
   Não inferir usabilidade humana do resultado de um agente ou script.

Limites de controle para experimentos futuros: navegador e clone descartáveis,
allowlist de origem local, sem credenciais, dados pessoais ou upload de vídeos;
orçamento e parada definidos antes do início; resultado calculado pelo avaliador,
nunca pelo próprio agente. O próximo teste útil é comparar MCP + modelo e Browser
Use no mesmo catálogo, seguido de teste com praticantes — não adicionar ferramentas
sem pergunta experimental.

## Como reproduzir

Siga [o protocolo de execução](../frontend/benchmarks/README.md). O resultado
`deterministic_playwright` mede a implementação do fluxo com scripts conhecidos.
Campos de agentes externos, ciência e compreensão humana ficam sem avaliação.
Resultados desta rodada são registrados em [UX-CODEX-V2](deliveries/UX-CODEX-V2.md).

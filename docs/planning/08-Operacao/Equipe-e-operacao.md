---
tipo: operacao
status: time-de-pesquisa-executado-equipe-futura-proposta
data: 2026-11-01
---

# Equipe e operação

## Time que trabalhou nesta rodada

Quatro frentes de agentes, sob coordenação do Codex: head/integrador; validade científica; arquitetura/CV/MLOps; produto/mercado/privacidade. Os três pesquisadores atuaram em paralelo e entregaram notas separadas. Houve revisão cruzada científica da síntese e revisão de backend dos contratos. São papéis de agentes de pesquisa, **não profissionais humanos contratados ou credenciados**.

Codex inspecionou os sete vídeos, consolidou as decisões, tratou conflitos e estruturou o vault. Na entrega original, Claude não havia sido acionado pelo Codex. Na atualização da aprovação, foram encontrados materiais preliminares atribuídos ao Claude na pasta `07-Claude`; sua revisão formal e a integração permanecem pendentes. O papel de head de UX/UI foi designado por Gabriel.

## Equipe de execução proposta

| Papel | Responsável proposto | Entrega e poder de decisão |
|---|---|---|
| Dono do produto e praticante de referência | Gabriel | Prioridade, problema, investimento, critérios de valor e decisão final |
| Head backend/data science/produto técnico | Codex | Contratos, pipeline, evidência, custo, operação e integração |
| Head UX/UI | Claude Opus | Pesquisa de interação, captura, informação, linguagem visual, acessibilidade e frontend |
| Revisão científica | Biomecanicista humano, a definir | Mensurando, protocolo, erro relevante e liberação científica |
| Conteúdo técnico de tênis | Treinador qualificado, a definir | Revisão das orientações e adequação ao treino solo |
| CV/engenharia de dados | Agente especializado por tarefa + revisão do head | Benchmarks, rótulos, tracking, pipelines e documentação |
| QA independente | Agente diferente do implementador; especialista quando necessário | Reproduzir falhas, testar exclusão/isolamento/abstenção e contestar conclusões |
| Privacidade/jurídico | Revisor competente, antes do piloto externo | Finalidades, base legal, termos, terceiros, fornecedores e retenção |

Começar pequeno: Gabriel + Codex + Claude, com revisão humana científica focada em pontos de decisão. Não montar uma rede permanente de dezenas de agentes, nem usar votação entre LLMs como validação científica.

## Fluxo eficiente

1. Head cria tarefa curta com pergunta, dono, arquivos permitidos, entradas, limite de escopo e critério de conclusão.
2. Pesquisa independente pode rodar em paralelo. Escrita no mesmo arquivo tem um dono por vez.
3. Um segundo agente revisa alegações, fontes e testes quando o risco justifica.
4. Integração registra decisão ou divergência. Opinião da maioria dos agentes não substitui evidência.
5. Antes de executar protótipo, fechar contrato e dados simulados/reais usados.
6. Cada experimento produz artefatos, manifesto e conclusão; cada aprovação recebe autor e data.

Não usar chat como única memória. Registrar decisões duráveis no vault, ligar aos artefatos e preservar resultados negativos. Reuniões/revisões não precisam gerar nova arquitetura inteira a cada rodada: alterar só o que a evidência muda.

## Capacidades e skills disponíveis nesta sessão

Inventário funcional, sem alegação de benchmark ou disponibilidade de todas as contas:

| Recurso | Aplicação útil | Estado nesta rodada |
|---|---|---|
| Subagentes e busca web | Pesquisa paralela e revisão independente | Usados |
| Shell, Python, FFmpeg/FFprobe, Pillow | Inventário, hashes, quadros e artefatos | Usados localmente |
| Whisper pequeno em cache + faster-whisper temporário | Leitura do áudio das referências | Executado localmente; erro de transcrição documentado |
| Obsidian/Markdown | Registro, links, decisões e templates | Vault existente utilizado; sem plugin adicional |
| Claude CLI | Possível execução futura do modelo externo | Binário encontrado; não executado/autenticado nesta rodada |
| Figma skills e ferramentas | Fluxos, componentes e protótipos liderados por Claude | Disponíveis na sessão; não acionados |
| frontend-design | Apoio à direção de UI quando Claude iniciar implementação | Disponível; não aplicado pelo backend |
| Supabase e boas práticas Postgres | Opção de infraestrutura e revisão de persistência | Skills disponíveis; fornecedor não escolhido, nenhum banco alterado |
| Spreadsheets/PDF/Documents | Relatórios exportáveis e análise de resultados | Disponíveis; Markdown atende esta fase |
| Imagegen | Ilustrações próprias para conteúdo educativo | Disponível; não usar imagem gerada como prova de biomecânica |
| Browser/Playwright | QA de experiência e acessibilidade | Disponíveis; nenhum app/protótipo executado nesta rodada |

Skills específicas devem ser lidas antes de seu primeiro uso operacional. A disponibilidade de uma skill não garante acesso à conta, licença de conteúdo, desempenho do modelo ou capacidade científica. Não foram instalados plugins de terceiros no Obsidian.

## Backlog recomendado

- **B01 / conjunto:** revisão da proposta por Gabriel e Claude; registrar escolha de primeiro exercício.
- **B02 / ciência:** definir revisor humano, medida candidata, rótulos, mudança relevante e consentimento de pesquisa.
- **B03 / Claude:** fluxo de captura sem assistência e teste de compreensão; sem dashboard completo prematuro.
- **B04 / Gabriel + produto:** entrevistas e inventário dos aparelhos realmente disponíveis.
- **B05 / Codex:** ambiente isolado, baseline offline e manifestos após fechar o experimento.
- **B06 / CV:** benchmark com mesma partição e sem vazamento por atleta.
- **B07 / QA:** aceitação de mídia, comparabilidade, evidência insuficiente, segurança e exclusão.
- **B08 / conjunto:** decisão de piloto ou retorno à captura/replay conforme evidência.

Estimativa de agenda para discussão: descoberta/contratos em 1–2 semanas, bancada de validade em 2–4 semanas após acesso a participantes e revisores, piloto posterior conforme gates. **Não é promessa de prazo:** recrutamento, anotação, acesso a referência e revisão humana são dependências dominantes. Esforço e custo serão recalculados depois de B01–B04; a estimativa não autoriza compras ou contratação.

---
tipo: checkpoint
data: 2026-11-01
status: fundacao-local-integrada
responsavel: Codex
---

# Fundação backend P1 — evidência da entrega

Atendendo ao pedido de Gabriel, os três chats reais Sol 6.1/high implementaram
contratos, mídia e cálculo 2D em branches separadas. O head revisou, integrou,
adicionou CLI/testes entre módulos e promoveu a fundação para `main`.
Plano e identificação dos chats: Plano-de-implementacao-backend-v0.1 (material local não incluído),
[Quadro-operacional-backend](Quadro-operacional-backend.md).

## Versão aceita

Repositório: `[workspace-local]/tennis-backend`.
Commit: `432197224ef6ed74628770f7e8fe35951bbfc030`.
Tag: `p1-foundation-v0.1.0`. Checkout principal limpo em `main` no fechamento.
Branches de implementação e integração preservadas; nenhum remote configurado.

| Entrega | Commit final |
|---|---|
| BE-01 | aa401de8ddb3b2eb6fc6ec243e0c485f32551d1c |
| BE-02 | b8623db768dcc6c7da55b4f59087fd985d0327b1 |
| DS-01 | 9d48df7126a9b770eec08b8982eea30fd8d50ddf |

Os chats concluíram suas tarefas. Não foram abertos chats dependentes ociosos.
Cada entrega possui nota em `tennis-backend/docs/deliveries/`; o aceite e os ajustes
do head estão em `HEAD-P1.md`.

## O que funciona

- Inspeção read-only de vídeo local: hash, metadados, timestamps originais e limites
  de processamento. Não se inventa tempo usando FPS nominal.
- Entrada de landmarks explicitamente anotados ou sintéticos, com lado e janela.
- Cálculo determinístico da flexão projetada 2D de joelho; lacunas anulam o pico.
- Validação entre asset, timeline, fase, série, proveniência e evidências.
- Artefato de pesquisa numérico separado do relatório público, que mantém valor nulo.
- CLI local, schemas JSON, erros estruturados e pacote de artefatos com checksums.

## Verificação executada

`uv run --frozen --offline --cache-dir [cache-uv-local] pytest -q`
→ **674 testes passaram em 3,58 s**, sem skips nesta máquina. Esse número reúne
contratos, transições, mídia, geometria e 17 testes de integração; não significa
674 vídeos, atletas ou medições científicas.

Demo: `python scripts/demo_synthetic.py artifacts/p1-synthetic-2026-11-01`
executado pelo uv. O vídeo é uma tela azul de cinco frames; os landmarks são
fornecidos matematicamente, sem inferência a partir da imagem.

- PTS: `0, 2048, 4096, 6144, 8192`; time_base `1/10240`.
- FFprobe `8.1.1`.
- Resultado interno: `computed`, `90.0 deg`, construção sintética conhecida.
- Relatório: `is_demo=true`, `research_only`, `value=null`.
- Os cinco arquivos previstos no manifesto de checksum, incluindo o vídeo
  sintético, foram conferidos por SHA-256.
- Hash da fonte sintética: `89c8b733188d15249355744f0954eb11e1ad24a70364b58da2774de6d361569a`.

Não foram usados os sete MOVs originais nem vídeos de atletas nesses testes.
Os originais e o trabalho do Claude foram preservados.

## Revisão e decisões

Revisões independentes cobriram cálculo/limites numéricos, joins entre artefatos,
contratos e limites do processo nativo. Foram corrigidos IDs de execução que se
repetiam, leitura de anotações sem teto efetivo e marcador de conclusão antes da
preservação do vídeo da demonstração. A divergência de uma fase com um frame foi
resolvida em favor de representá-la com evidência insuficiente.

As notas do Claude foram tratadas como pesquisa preliminar. Não importamos os
limiares “20 golpes”, “3%”, “240 fps” ou MDC genérico para o código. A leitura de
`progress_sim.py` mostrou que a confirmação bilateral usa hits absolutos, podendo
aceitar sinais alternados; esse comportamento não foi usado como detector de
progresso. A vista lateral do protocolo M01 foi preservada.

## O que continua pendente

API HTTP, persistência durável, autenticação, exclusão/retencão, isolamento nativo
para uploads não confiáveis, pesos/licenças de modelo, inferência de pose, benchmark
com dados próprios, validação biomecânica e aplicativo. O FFprobe é processo local
com limites; não é sandbox de produção. Não há ângulo ideal, score de técnica,
detector de melhora ou orientação personalizada validada.

Próxima onda planejada: API/persistência e experimento de pose após ADR e protocolo
de validação. Claude recebe contrato de serviço/fixtures estabilizados para liderar
UX/UI/frontend. Não é necessário esperar validar uma métrica para estudar captura
e replay, desde que os dados simulados continuem identificados.

## Preservação local

Snapshot do planejamento e Git bundle do repositório são preparados em `snapshots/`
na pasta pai do vault, com verificação e hashes em registro próprio. A demonstração
fica em `tennis-backend/artifacts/` (regenerável e ignorada no Git). Estes arquivos
permanecem no mesmo dispositivo; [Backup-e-proveniencia](Backup-e-proveniencia.md) continua distinguindo
snapshot local de backup independente.

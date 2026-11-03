# Análise local de quadro real — backend, 03/11/2026

Endpoint experimental `POST /__local_pose/frame` recebe um PNG do quadro pausado,
executa MediaPipe IMAGE localmente e devolve candidatos e pontos COCO17. O hash e
as dimensões vinculam o resultado à imagem enviada. Não há PTS, FPS, rastreamento,
identidade, nota de técnica, ângulo ou medida biomecânica fabricada.

`GET /__local_pose/capabilities` informa disponibilidade, limites e token efêmero.
Configuração privada: `frontend/artifacts/local-pose.json`, com `python_path`,
`model_path` e `model_sha256`; o head prepara runtime e pesos. O worker recebe
PNG por stdin e devolve JSON por stdout. Não grava imagens ou resultados em disco.

## Limites implementados

- Somente loopback, Host local, Origin exata no POST e token aleatório; sem CORS.
- PNG de até 4 MiB e 1280 px por eixo. IHDR é verificado antes da decodificação.
- Uma solicitação por vez, 90 s de prazo, stdout/stderr limitados a 128 KiB cada.
- Abort, desconexão e encerramento do servidor cancelam o subprocesso.
- Erros nativos e caminhos privados não saem na resposta; conteúdo usa no-store.
- Pesos locais são lidos uma vez, conferidos por SHA256 e passados como bytes ao
  modelo, evitando reabrir um arquivo diferente após a verificação.
- Até quatro poses. Pontos com valores ausentes/não finitos, fora da imagem ou
  visibility/presence abaixo de 0,5 ficam nulos. Essa política de desenho não é
  um limiar validado de precisão. Nenhum ponto é limitado à borda ou interpolado.
- `no_person` significa ausência de candidato desenhável, não prova de ausência
  física de pessoas. O usuário ainda precisa escolher explicitamente o alvo.

## Verificação

- `npx vitest run tests/localPose.test.ts`: 17 aprovados.
- `npm run typecheck`: aprovado.
- `.venv/bin/python -m pytest tests/frame_pose/test_worker.py -q`: 13 aprovados.

Testes usam cabeçalhos PNG e geometria sintéticos; não precisam de pesos no CI.
Cobrem vínculo de imagem, rejeição de origens/tokens inválidos, limites, uma tarefa
por vez, cancelamento, timeout, falha sanitizada, pontos nulos e ausência explícita.
Teste com modelo e vídeo real pertence à integração do head, separado destes
testes de implementação. Segurança de uploads públicos e execução multiusuário
continuam fora do escopo: o transporte é local e para desenvolvimento.

Referência de API: [MediaPipe Pose Landmarker Python](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python).

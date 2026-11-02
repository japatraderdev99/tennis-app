/**
 * Toda frase ligada a um estado do backend mora aqui, para revisão e teste de
 * compreensão. Regras: uma causa, uma ação; fala da imagem, nunca da pessoa.
 * Nenhum texto foi testado com tenistas ainda.
 */
import type { CaptureIssueCode, PublicMetric, RunStage, Session } from "../api/types";

export interface IssueCopy { title: string; why: string; action: string }

export const ISSUE_COPY: Record<CaptureIssueCode, IssueCopy> = {
  feet_out_of_frame: {
    title: "Seus pés ficaram fora da imagem",
    why: "Sem os pés, não consigo marcar as pernas inteiras. Isso diz respeito à filmagem, não ao seu saque.",
    action: "Afaste o celular até a raquete levantada e os pés caberem na tela.",
  },
  player_lost: {
    title: "Perdi você neste ponto",
    why: "Daqui em diante não há esqueleto. Prefiro parar a chutar quem é você.",
    action: "Escolha você de novo para o esqueleto continuar.",
  },
  player_ambiguous: {
    title: "Duas pessoas ficaram muito próximas",
    why: "Neste ponto não dá para saber quem é quem. Prefiro parar a acompanhar outra pessoa.",
    action: "Escolha você de novo, em um quadro depois que as pessoas se separarem.",
  },
  player_gap: {
    title: "Um trecho ficou sem esqueleto",
    why: "Neste trecho não acompanhei você. O vídeo continua aí para rever.",
    action: "Para ter o vídeo inteiro, fique visível e sem ninguém na sua frente.",
  },
  player_not_found: {
    title: "Não encontrei ninguém neste vídeo",
    why: "O jogador pode ter ficado pequeno demais na imagem. Isso não diz nada sobre o seu saque.",
    action: "Aproxime o celular até você ocupar boa parte da altura da tela.",
  },
  timing_unreliable: {
    title: "O tempo deste vídeo não é confiável",
    why: "Vídeos em câmera lenta ou editados podem perder o tempo real de cada quadro. Sem ele, não analiso o movimento.",
    action: "Grave de novo com a câmera normal, sem câmera lenta.",
  },
};

export const STAGE_COPY: Record<RunStage, string> = {
  queued: "Na fila para começar",
  pose_estimation: "Estimando o corpo em cada quadro",
  target_association: "Acompanhando quem você escolheu",
  packaging: "Preparando a revisão",
};
export const STAGE_ORDER: RunStage[] = ["queued", "pose_estimation", "target_association", "packaging"];

export const REJECTION_COPY: Record<string, IssueCopy> = {
  duration_limit: {
    title: "Este vídeo é longo demais",
    why: "Esta versão só recebe vídeos curtos.",
    action: "Corte um trecho de até 1 minuto na galeria do celular e envie esse trecho.",
  },
};
export const REJECTION_FALLBACK: IssueCopy = {
  title: "Não consegui abrir este arquivo",
  why: "O arquivo pode estar danificado ou em um formato que esta versão não lê.",
  action: "Escolha outro vídeo, gravado direto pela câmera do celular.",
};

export const METRIC_COPY: Record<PublicMetric["status"], string> = {
  research_only: "Em validação. Nenhum valor é mostrado.",
  insufficient_evidence: "O vídeo não trouxe imagem suficiente. Nenhum valor foi calculado para mostrar.",
  unsupported: "Esta versão não calcula isso para este vídeo.",
};

/** Duas frases separadas: uma fala do processamento, outra da filmagem. */
export function processingLine(s: Session): string {
  if (s.deletion !== "none") return "Exclusão em andamento";
  if (s.asset_state === "importing") return s.upload.state === "interrupted" ? "Envio parado" : "Enviando";
  if (s.asset_state === "rejected") return "Arquivo recusado";
  const run = s.run;
  if (!run) return "Falta escolher o jogador";
  switch (run.state) {
    case "queued":
    case "running": return "Processando";
    case "succeeded": return "Processamento concluído";
    case "failed": return "Processamento falhou";
    case "cancelled": return "Análise cancelada";
  }
}

export function captureLine(s: Session): string | null {
  if (s.deletion !== "none" || !s.capture) return null;
  const first = s.capture.issues[0];
  if (first) return ISSUE_COPY[first.code].title;
  return "Nenhum problema de filmagem encontrado";
}

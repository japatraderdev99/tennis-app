import type { Session } from "../api/types";

export type SessionView =
  | "deletion" | "upload" | "rejected" | "select" | "processing" | "failed" | "cancelled" | "replay";

/** Decide a tela a partir do estado do servidor. Função pura, coberta por teste. */
export function viewForSession(s: Session): SessionView {
  if (s.deletion !== "none") return "deletion";
  if (s.asset_state === "importing") return "upload";
  if (s.asset_state === "rejected") return "rejected";
  if (!s.run) return "select";
  switch (s.run.state) {
    case "queued":
    case "running": return "processing";
    case "failed": return "failed";
    case "cancelled": return "cancelled";
    case "succeeded": return "replay";
  }
}

export type Route =
  | { name: "home" }
  | { name: "intro" }
  | { name: "guide" }
  | { name: "pick" }
  | { name: "limits" }
  | { name: "lab" }
  | { name: "session"; id: string }
  | { name: "reselect"; id: string }
  | { name: "review-only"; id: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [a, b, c] = parts;
  if (a === "inicio") return { name: "intro" };
  if (a === "como-filmar") return { name: "guide" };
  if (a === "escolher") return { name: "pick" };
  if (a === "limites") return { name: "limits" };
  if (a === "estados") return { name: "lab" };
  if (a === "sessao" && b) {
    if (c === "escolher-de-novo") return { name: "reselect", id: b };
    if (c === "rever") return { name: "review-only", id: b };
    return { name: "session", id: b };
  }
  return { name: "home" };
}

export const go = (path: string) => { window.location.hash = path; };

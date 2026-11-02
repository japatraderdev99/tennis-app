import type { LocalVideo, Replay, Seed, SeedOptions, Session } from "./types";

/** Desenha um quadro em pixels de exibição. Em produção, encapsula o `<video>`. */
export interface FramePainter {
  width: number;
  height: number;
  paint(ctx: CanvasRenderingContext2D, frameIndex: number): void;
}

/**
 * Única porta entre telas e dados. As telas não conhecem os mocks; a integração
 * real substitui `createClient` em `src/main.tsx` por uma implementação HTTP.
 */
export interface ApiClient {
  readonly isDemo: boolean;

  /** Hoje simula a galeria. No app real, é o seletor nativo do aparelho. */
  listLocalVideos(): LocalVideo[];
  openLocalPainter(videoId: string): FramePainter;

  listSessions(): Promise<Session[]>;
  getSession(sessionId: string): Promise<Session | null>;

  /** POST /v1/sessions + início do envio retomável. */
  createSession(videoId: string): Promise<Session>;
  resumeUpload(sessionId: string): Promise<void>;

  getSeedOptions(sessionId: string): Promise<SeedOptions>;
  /** A semente é sempre escolhida pela pessoa. O cliente nunca presume. */
  startAnalysis(sessionId: string, seed: Seed): Promise<void>;
  /** Nova seleção depois de perda: novo run_id, sem recuperação silenciosa. */
  reselect(sessionId: string, seed: Seed): Promise<void>;
  /** Execuções terminais não reiniciam: tentar de novo cria outro run_id. */
  retry(sessionId: string): Promise<void>;
  cancelRun(sessionId: string): Promise<void>;

  getReplay(sessionId: string): Promise<Replay>;
  openPainter(sessionId: string): FramePainter;

  flagFrame(sessionId: string, frameIndex: number): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

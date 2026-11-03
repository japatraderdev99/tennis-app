/** Experimental single decoded image. Never a source-video PTS or motion metric. */
export interface FramePose {
  schema_version: "single-frame-pose/1";
  scope: "single_image";
  status: "estimated" | "no_person";
  image_sha256: string;
  width: number;
  height: number;
  model: { name: string; sha256: string; runtime: string };
  drawing_policy: "mediapipe-visible-v1";
  validation: "not_validated";
  people: Array<{
    id: string;
    bbox: { x1: number; y1: number; x2: number; y2: number };
    keypoints: Array<{ name: string; x: number | null; y: number | null }>;
  }>;
}

export interface PoseCapabilities {
  available: boolean;
  max_edge: number;
  max_bytes: number;
  token: string;
}

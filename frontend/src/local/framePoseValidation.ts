import type { FramePose } from "./poseTypes";

export const COCO_NAMES = ["nose", "left_eye", "right_eye", "left_ear", "right_ear", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 180;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);

/** A result can draw only on the exact encoded image submitted in this request. */
export function validateFramePose(value: unknown, expected: { hash: string; width: number; height: number }): FramePose {
  const fail = () => { throw new Error("invalid_pose_response"); };
  if (!record(value) || value.schema_version !== "single-frame-pose/1" || value.scope !== "single_image"
    || value.validation !== "not_validated" || value.drawing_policy !== "mediapipe-visible-v1"
    || !digest(value.image_sha256) || value.image_sha256 !== expected.hash
    || value.width !== expected.width || value.height !== expected.height
    || !record(value.model) || !text(value.model.name) || !text(value.model.runtime) || !digest(value.model.sha256)
    || !Array.isArray(value.people) || value.people.length > 4
    || !["estimated", "no_person"].includes(String(value.status))) return fail();
  if ((value.status === "estimated") !== (value.people.length > 0)) return fail();
  const ids = new Set<string>();
  for (const person of value.people) {
    if (!record(person) || !text(person.id) || ids.has(person.id) || !record(person.bbox)
      || !Array.isArray(person.keypoints) || person.keypoints.length !== COCO_NAMES.length) return fail();
    ids.add(person.id);
    const { x1, x2, y1, y2 } = person.bbox;
    if (![x1, x2, y1, y2].every(finite) || !(Number(x2) > Number(x1)) || !(Number(y2) > Number(y1))
      || Number(x1) < 0 || Number(y1) < 0 || Number(x2) > expected.width || Number(y2) > expected.height) return fail();
    for (let i = 0; i < COCO_NAMES.length; i++) {
      const p = person.keypoints[i];
      if (!record(p) || p.name !== COCO_NAMES[i]) return fail();
      if (p.x === null && p.y === null) continue;
      if (!finite(p.x) || !finite(p.y) || p.x < 0 || p.x > expected.width || p.y < 0 || p.y > expected.height) return fail();
    }
  }
  return value as unknown as FramePose;
}

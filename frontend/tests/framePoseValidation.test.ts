import { describe, expect, it } from "vitest";
import { COCO_NAMES, validateFramePose } from "../src/local/framePoseValidation";

const hash = "a".repeat(64);
function pose() {
  return { schema_version: "single-frame-pose/1", scope: "single_image", status: "estimated", image_sha256: hash,
    width: 640, height: 360, model: { name: "synthetic-test", sha256: "b".repeat(64), runtime: "fixture" },
    drawing_policy: "mediapipe-visible-v1", validation: "not_validated", people: [{ id: "p1", bbox: { x1: 50, y1: 30, x2: 150, y2: 300 },
      keypoints: COCO_NAMES.map(name => ({ name, x: 100 as number | null, y: 100 as number | null })) }] };
}
const expected = { hash, width: 640, height: 360 };
describe("single-image pose evidence boundary", () => {
  it("accepts bound coordinates and explicit paired missing points", () => {
    const value = pose(); value.people[0]!.keypoints[3]!.x = null; value.people[0]!.keypoints[3]!.y = null;
    expect(validateFramePose(value, expected)).toEqual(value);
  });
  it("rejects valid-looking poses from another image or resized geometry", () => {
    expect(() => validateFramePose(pose(), { ...expected, hash: "c".repeat(64) })).toThrow();
    expect(() => validateFramePose(pose(), { ...expected, width: 320 })).toThrow();
  });
  it("rejects malformed or unsupported evidence instead of drawing", () => {
    for (const mutate of [
      (v: ReturnType<typeof pose>) => { v.people[0]!.keypoints[0]!.x = Infinity; },
      (v: ReturnType<typeof pose>) => { v.people[0]!.keypoints[0]!.x = 641; },
      (v: ReturnType<typeof pose>) => { v.people[0]!.keypoints[0]!.y = null; },
      (v: ReturnType<typeof pose>) => { v.people[0]!.keypoints.reverse(); },
      (v: ReturnType<typeof pose>) => { v.people.push(v.people[0]!); },
      (v: ReturnType<typeof pose>) => { v.people[0]!.bbox.x2 = 20; },
      (v: ReturnType<typeof pose>) => { v.validation = "validated"; },
      (v: ReturnType<typeof pose>) => { v.scope = "whole_video"; },
      (v: ReturnType<typeof pose>) => { v.status = "no_person"; },
    ]) { const value = pose(); mutate(value); expect(() => validateFramePose(value, expected)).toThrow(); }
  });
  it("accepts an explicit empty detection, without fabricating a person", () => {
    expect(validateFramePose({ ...pose(), status: "no_person", people: [] }, expected).people).toEqual([]);
  });
});

# P2 research pose contract and acceptance

This is a separate research artifact, version `pose_schema_version: "0.1.0"`.
It does NOT extend the P1 ResearchInput provenance enum or release public metrics.
No inference is relabeled manual/synthetic. Pose is unvalidated, image-plane 2D.

## Frame interface (all fields required)

```text
PoseFrame = {
  frame_index: integer >= 0,
  pts: integer,
  display_width: positive integer,
  display_height: positive integer,
  detections: [PoseDetection]
}
PoseDetection = {
  detection_id: nonempty string, unique WITHIN frame only,
  bbox: {x1: finite, y1: finite, x2: finite, y2: finite},
  keypoints: [Keypoint x 17]
}
Keypoint = {
  name: one of COCO17 names,
  x: finite | null, y: finite | null,
  score: finite | null,
  visibility: finite [0,1] | null,
  presence: finite [0,1] | null
}
```

COCO17 order: nose, left_eye, right_eye, left_ear, right_ear, left_shoulder,
right_shoulder, left_elbow, right_elbow, left_wrist, right_wrist, left_hip,
right_hip, left_knee, right_knee, left_ankle, right_ankle.
Names are unique and ordered. x/y are both finite or both null. No coordinate
clamping or zero filling. Out-of-frame finite points are preserved and must not
be interpreted as visible. Box has x2>x1, y2>y1, may cross image borders.
Scores are model-native, NOT calibrated probabilities; do not impose [0,1] on
RTMPose scores. visibility/presence are independent of score.
Empty detections is a valid observed failure, not an exception or a full-image
person. Detector IDs do not represent identity across frames.

## Artifact (CV-02 strict models + validation)

```text
PoseArtifact = {
  pose_schema_version: "0.1.0",
  asset_id: "sha256:" + 64 lowercase hex,
  time_base: positive rational string,
  coordinate_space: "display_pixels",
  keypoint_schema: "coco17",
  frames: [PoseFrame],
  provenance: {
    kind: "model_inference",
    adapter: "mediapipe" | "rtmpose",
    adapter_version: nonempty string,
    model_files: [{role: nonempty, sha256: hex64}],
    runtime: {nonempty string: nonempty string},
    parameters: finite JSON object,
    transforms: [nonempty strings]
  },
  validation_ref: null,
  measurement_status: "research_only"
}
```

Frames ordered with strictly increasing original frame_index and pts, consistent
display dimensions. Sampling is allowed and gaps must remain explicit; an empty
artifact is rejected. No fabricated timestamp from nominal FPS. The head joins
each frame to MediaManifest and records the original-to-display transforms.
No raw local paths or model download URLs needed in the artifact; runtime is for
versions/provider metadata, not secret values. Full local manifests stay private.

## CV-02 interface

Export `PoseArtifact`, `PoseFrame`, `PoseDetection`, `Keypoint`, `COCO17_NAMES`,
`MediaPipeAdapter`, `RTMPoseAdapter` from `tennis_backend.pose`.
Adapters implement `infer(image_bgr, *, frame_index, pts, time_base) -> dict`
returning PoseFrame, plus `close()` and `provenance() -> dict`.

Constructors:
`MediaPipeAdapter(model_path, *, mode="video", num_poses=2)`;
`RTMPoseAdapter(detector_path, pose_path, *, detector_input_size=(640,640),
pose_input_size=(288,384))`.
Constructors may have injectable private factories for meaningful dependency-free
tests. Importing the module must not load heavy optional dependencies. Fail with
explicit errors if dependencies or LOCAL regular weights are absent. Never
download or accept remote paths automatically. Hash weights and record provenance.

MP maps its 33 points to COCO17 and preserves visibility/presence. score=null for
MP. RTMPose score is retained; visibility/presence=null. MP bbox can be derived
from finite detected body landmarks; reject degenerate boxes explicitly. MP VIDEO
gets timestamps from pts*time_base, rounded to milliseconds only for its API;
detect collisions/backwards time and fail rather than inventing order. IMAGE mode
is allowed for sparse independent samples. Record mode and mapping in provenance.
Validate supplied frame_index/pts/time_base and image dimensions/type. No inference
past an explicit close. RTMPose must skip its pose estimator for zero detector
boxes (otherwise its library invents a full-image crop).

## BE-03 interface

Export `select_target(frames, *, seed_frame_index, seed_detection_id,
min_iou=0.2, ambiguity_margin=0.05) -> dict` from `tennis_backend.selection`.
Consume the PoseFrame dictionaries above with independent strict validation.

Output `{selection_schema_version:"0.1.0", method:"conservative_iou_v0",
seed:{frame_index,detection_id}, parameters:{min_iou,ambiguity_margin},
frames:[{frame_index,pts,status,detection_id,reason}], validation_ref:null}`.
status is `not_started|selected|lost|ambiguous`; detection_id only for selected;
reason null for selected, nonempty snake_case for all other statuses.

Selection is EXPLICIT, never largest/nearest-person auto-selection. At the seed
choose exactly the requested detection. Before it, not_started. Associate boxes
by IoU with the last selected box for consecutive source frames; thresholds are
technical heuristics, not validated identity confidence. If the best score is
below min_iou, association is lost; if candidates within ambiguity_margin tie,
ambiguous. After loss/ambiguity stay lost until a new explicit user seed in a new
call. No automatic reidentification or face processing. A frame_index gap must
stop association (sparse samples are not continuous tracking). Duplicate IDs,
invalid geometry, nonfinite values or time regressions fail clearly.

## DS-02 interface

Export `make_annotation_template(artifact, selection) -> dict` and
`evaluate_keypoints(artifact, annotations) -> dict` from
`tennis_backend.evaluation`; consume the above dicts without importing unmerged
CV/BE code. Templates are UNREVIEWED with all reference coordinates null: never
prepopulate a prediction and call it independent ground truth.

Annotation format:
`{annotation_schema_version:"0.1.0", asset_id, time_base,
coordinate_space:"display_pixels", keypoint_schema:"coco17",
review_status:"unreviewed"|"reviewed", annotator_id:string|null,
frames:[{frame_index,pts,display_width,display_height,detection_id:string|null,
keypoints:[{name,x:finite|null,y:finite|null,
visibility:"unreviewed"|"visible"|"occluded"|"out_of_frame"}]}]}`.
Template includes selected frames only. A reviewed reference must have annotator
ID and explicit visibility; visible needs finite reference x/y, others need null
coordinates. Annotation frame/detection IDs link to predictions but coordinates
must be independently reviewed. Annotations may be a subset; missing annotations
are excluded from evaluation, while missing predictions for visible annotated
points must count as failures, not silently disappear from denominators.

Return `evaluation_schema_version:"0.1.0", status:"computed"|"not_evaluated",
asset_id, reference_points, matched_points, missing_predictions,
mean_error_px:number|null, median_error_px:number|null,
coverage:number|null, reasons:[codes], validation_ref:null`.
Unreviewed templates return not_evaluated with null metrics. Coverage = matched /
visible reference points; errors describe matched points and always accompany
the missing count. No scientific acceptance threshold, 3D claim or athlete score.
Reject mismatched asset/time_base/PTS/dimensions/names/duplicate keys and nonfinite
JSON. A missing detection in a valid frame is a missing prediction, not an input
crash. Document what a single annotator establishes and need for independent
second annotation/adjudication in the scientific protocol.

## Tests and gates

Use synthetic geometry only in Git. Tests must cover empty detections, timestamp
collision, absent dependencies/weights, zero detector boxes, multiple players,
crossing/ambiguous candidates, gap/loss, mismatched evidence, unreviewed labels,
missing predictions, and invalid floats/types. Do not fetch any weights in CI.
All P1 public reports keep value=null. No automatic M01 from these poses in P2.

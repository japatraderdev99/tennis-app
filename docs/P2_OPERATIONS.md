# P2 — operational assignments

Status: local technical acceptance recorded in `deliveries/HEAD-P2.md`; no
scientific promotion or cloud deployment. Base: P1 public
foundation plus this coordination commit. All builders: gpt-6.1-sol, high.

| ID | Branch | Owned paths | Deliverable |
|---|---|---|---|
| CV-02 | feat/p2-pose-adapters | src/tennis_backend/pose/, tests/pose/, docs/deliveries/CV-02.md | Strict research pose contract and local MediaPipe/RTMPose adapters |
| BE-03 | feat/p2-target-selection | src/tennis_backend/selection/, tests/selection/, docs/deliveries/BE-03.md | Explicit target selection and conservative geometric association |
| DS-02 | feat/p2-pose-evaluation | src/tennis_backend/evaluation/, tests/evaluation/, docs/research/, docs/deliveries/DS-02.md | Annotation template/protocol and honest keypoint evaluation |
| HEAD | integrate/p2-pose-lab | Remaining paths, dependencies, CLI/integration, cloud ADR, vault | Review, integration, local real-video checks and checkpoint |

Read `P2_POSE_LAB.md` for frozen plain-dict interfaces. Builders do not edit one
another's modules or shared dependency files. BE-03 and DS-02 can implement and
test against synthetic dictionaries without waiting for CV-02 or importing its
unfinished module. Head will validate boundaries during integration.

Worktrees live below `[workspace]/backend-worktrees/p2-*`. Never switch or edit
the main checkout or another builder's checkout. Use explicit workdir.
Preserve P1 worktrees, research artifacts, user videos and Claude's material.
Do not commit frames, real landmarks, model weights, private paths, identities,
secrets or caches. Test fixtures must be synthetic.

No package/model downloads by builders. The head owns extras, lockfile and local
model installation. Optional imports must not make the base package require CV
dependencies. Real-model execution is an integration check, not mandatory CI.

Each builder implements its assigned code and meaningful boundary tests, runs
them, commits ONLY owned paths, and writes a delivery note with tests, limits,
interface deviations and pending issues. Do not self-approve scientific validity.
Do not merge/push or message other user-owned chats; the head reads progress and
may send follow-ups under Gabriel's authorization.

Acceptance sequence: (1) module review; (2) compatible integration; (3) base suite
without CV extras; (4) opt-in local model test on private video; (5) artifacts and
source-preservation checks; (6) head technical acceptance and vault checkpoint.

Next wave after this gate: local HTTP/job persistence and provider adapters for
the proposed Supabase + Google Cloud architecture. Cloud accounts, region, paid
plan, retention, cost ceiling and deployment evidence are not implied by this work.

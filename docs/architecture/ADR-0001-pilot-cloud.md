# ADR-0001 — Supabase control data and Google Cloud video processing

Status: head proposal adopted as the design target; not deployed, priced or
scientifically validated. Date: 2026-11-01. Provider provisioning is a later gate.

## Decision

Use two providers with explicit responsibilities. Supabase owns Auth and managed
PostgreSQL. Google Cloud owns private video objects, the FastAPI container,
asynchronous Python processing and its operational services. The scientific
library stays independent of cloud SDKs.

| Component | Proposed service | Responsibility |
|---|---|---|
| Identity | Supabase Auth | User authentication and sessions |
| Relational persistence | Supabase PostgreSQL | Ownership, sessions, assets, jobs, versions and report references |
| Video objects | Google Cloud Storage (private) | Immutable originals, private derivatives, model artifacts and manifests |
| Domain API | FastAPI / Pydantic on Cloud Run | Authorization, upload initiation, job requests and reports |
| Queue | Cloud Tasks | Bounded dispatch, retry and rate/concurrency control |
| Processor | Separate Python Cloud Run service, CPU first | FFmpeg, pose adapters, eligibility, research artifacts and overlays |
| Long batch alternative | Cloud Run Jobs | Jobs exceeding the bounded request worker's duration/resource envelope |
| Operations | Artifact Registry, Secret Manager, Cloud Logging/Monitoring | Container versions, credentials and observable execution |
| Source and CI | GitHub / Actions | Tests, reviewed code and later container publishing |

Supabase Storage is a reasonable alternative with TUS/resumable uploads and RLS
integration. GCS is preferred here because the large objects are processed in
Google Cloud; it avoids repeatedly moving source videos from Supabase to that
worker. This is a locality decision, not a proven cheapest-provider claim.
Do not duplicate the canonical object store across both services by default.

Cloudflare is optional for DNS/edge later, not required in the scientific backend.
AWS is a viable alternative platform, not an extra layer in this pilot. Firebase
Auth/Firestore would duplicate the chosen identity/persistence responsibilities.
The front-end platform and hosting stay with Claude's later design decision.
No Kubernetes, Redis/Celery/RabbitMQ or vector database is required for this
proposed managed queue deployment; this refines the earlier generic options.

## Request and data flow

1. Client authenticates with Supabase Auth and presents its access token to API.
2. API verifies signature/issuer/audience/expiry and ownership. It initiates a
   resumable upload for one allocated object. The upload session URI is a bearer
   credential: HTTPS only, no logging, no unrelated object authority.
3. Client sends video directly to GCS. Large media does not pass through API RAM.
4. API confirms the uploaded object's generation/metadata and records a pending
   analysis plus a durable dispatch event. Worker verifies source hash and limits.
5. Dispatcher enqueues only job identifiers. A durable outbox/reconciler closes
   the database/queue dual-write gap; task creation alone is not processing success.
6. Cloud Tasks invokes the private worker through an authorized service identity.
   Worker claims a lease, checks cancellation/deletion, reads the authorized object
   and processes bounded work in an isolated temporary directory.
7. Worker writes artifacts under an attempt-specific prefix; validates checksums
   and commits the final result reference once. A success response to the task
   follows durable completion, or an explicitly persisted terminal failure.
8. App reads state/report from the API and receives short-lived read access to
   owned derivatives. Clients cannot mark jobs succeeded or write model results.

Object storage keys/generations, not expiring download URLs, are persistent data.
Never make user video buckets public. Use uniform bucket IAM and public-access
prevention where supported; API ownership checks still control delegated URLs.
Do not expose service-role/database/storage credentials in the mobile/web client.
Supabase RLS on exposed data needs owner predicates and cross-user tests; a
privileged backend credential does not automatically enforce per-user access.

## Reliability and resource bounds

- Cloud Tasks HTTP dispatch has a maximum deadline of 30 minutes. The pilot worker
  gets a substantially smaller internal processing budget, fixed after measurement.
  Do not run a long job after acknowledging a task and assume it will finish.
- Tasks can be duplicated. Idempotency includes owner, source generation/hash,
  model/config versions and requested operation; use durable attempt state, lease
  and final-publication fencing. Do not promise exactly-once execution.
- Network/request timeout does not guarantee process cancellation. Enforce wall
  time, decoded frames, pixels, bytes, output/log size and native-process limits.
- Start with one video per worker instance and capped instances/queue dispatch.
  Database pool limits and connection counts must fit the Supabase plan.
- Cancellation/deletion must prevent stale retries from recreating published
  artifacts. Define deletion latency for backups separately from active storage.
- Consider Cloud Run Jobs for longer work; it requires a durable execution-ID and
  completion reconciliation design, not simply increasing an HTTP timeout.
- Postgres backup does not back up object bytes. Define GCS recovery/versioning,
  retention, lifecycle and restore tests explicitly, including deletion behavior.

## Region, costs and go-live gate

Prefer evaluating Sao Paulo: Supabase `sa-east-1`, GCP `southamerica-east1`, subject
to actual service availability and quotas. Same city does not mean shared private
network, zero egress, or automatic jurisdictional compliance.

Cost model: managed database/auth plan + object GB-month + downloads/replays +
CPU/RAM execution + model initialization/idle time + queue + logs + backup. Include
retries and rejected captures; report cost per useful analysis. Current desktop
timing is not a Cloud Run benchmark. No currency estimate or provider cheapest
claim has been established.

Before provisioning: choose account/project, region, spending ceiling, retention,
expected upload volume/duration/concurrency, recovery objectives and exact model
terms. Before external use: Linux container inference, resumable upload, hostile
media bounds, ownership isolation, retry/cancel/delete, restore drill and cost test.
All public biomechanical gates remain unchanged: unvalidated values stay null.

## Portability

Keep provider adapters outside the scientific core: `ObjectStore`, `JobQueue`,
repository and identity verifier boundaries. Python, Postgres and JSON/Parquet
remain portable. This ADR does not authorize replacing local P1 contracts or
automatically making inferred pose acceptable manual research input.

## Primary references

- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Supabase database backups and storage distinction](https://supabase.com/docs/guides/platform/backups)
- [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [GCS resumable uploads](https://docs.cloud.google.com/storage/docs/resumable-uploads)
- [Cloud Tasks with private Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-tasks)
- [Cloud Tasks dispatch deadline](https://docs.cloud.google.com/tasks/docs/dual-overview)
- [Cloud Tasks duplicate execution](https://docs.cloud.google.com/tasks/docs/common-pitfalls)
- [Cloud Run request timeout](https://docs.cloud.google.com/run/docs/configuring/request-timeout)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- [Cloud Run regions](https://docs.cloud.google.com/run/docs/locations)
- [Supabase Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

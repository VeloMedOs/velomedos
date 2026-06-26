## Audit vs VeloMed_OS v2 Architecture

The v2 doc redesigns the platform around 6 domains, multi-tenancy, native mobile apps, K8s microservices, NATS/Kafka, PostGIS/Redis/Timescale, and a contract-first API. Some of that is platform-level (Kubernetes, native iOS/Android, Kafka, dedicated geospatial DB) and is **not deliverable inside the Lovable runtime** — I'll call those out as deliberate out-of-scope below. Everything that *is* deliverable here, I'll build.

### What's already in v1
Dispatch console · Provider cockpit (5s GPS) · Patient app · Rentals · Training · Developer (API keys) · `/api-docs` Swagger · 7 REST endpoints under `/api/public/v1/*` · Supabase auth + RLS.

### What's missing vs v2 (will build)

**1. Compliance, credentialing & asset management** (§4.4, §5)
- New tables: `credentials` (paramedic/driver licenses, vehicle registration), `work_orders`, `work_order_items`, `defects`.
- Dispatch-eligibility view that hides ambulances with expired registration or open blocking defect, and crew with expired licenses.
- New route `/_authenticated/compliance` — credential register with expiry traffic-lights, work-order list, defect intake.

**2. Mobile / portable clinics — pre-employment screening** (§2.1, §4.5)
- New tables: `corporate_accounts`, `screening_packages`, `screening_orders`, `screening_results`, `certificates` (extend existing).
- New route `/_authenticated/screening` — corporate intake, order queue, results capture, fitness-for-work certificate generation (PDF stub URL).

**3. Telehealth session linkage** (§4.5)
- New table `telehealth_sessions(appointment_id, room_id, started_at, ended_at, notes)`.
- Patient + provider can "Join room" from clinic booking; stores room id and timestamps (real WebRTC out of scope — link-out stub).

**4. Audit log** (§8)
- New table `audit_log(actor_id, action, entity, entity_id, payload, at)` + trigger helpers.
- Write entries on incident assign/status change, credential change, API key issue/revoke.
- New route `/_authenticated/audit` — filterable table (admin/dispatcher only).

**5. Public API: scopes, rate limits, webhooks** (§6)
- Add `scopes text[]` and `rate_limit_per_min` to `api_keys`; enforce in `requireKey()`.
- New tables `webhook_subscriptions(owner_id, url, events[], secret, active)` and `webhook_deliveries(subscription_id, event, payload, status, attempts, last_error, delivered_at)`.
- Fire-and-forget delivery on incident create / status change.
- New public endpoints: `POST /api/public/v1/webhooks`, `GET /api/public/v1/webhooks`, `DELETE /api/public/v1/webhooks/:id`.
- Extend `/api/public/v1/openapi` spec + `/api-docs` page.

**6. Security fixes (4 scanner findings)**
- Restrict EXECUTE on the 2 SECURITY DEFINER helpers to `service_role` / minimal roles.
- Drop public `clinics.phone` from anon SELECT (column-level grant + view).
- Add WITH CHECK on `incident_events` INSERT policy mirroring the SELECT predicate.

**7. Tests & quality audit**
- Vitest smoke tests for `lib/distance.ts`, `lib/api-server.ts` key hashing, and scope enforcement.
- Playwright headless run hitting `/`, `/auth`, `/api-docs`, `/api/public/v1/openapi` for build sanity.
- Re-run `tsgo`, supabase linter, security scan; fix anything new.

### Deliberately out-of-scope (platform / architecture-level)
- Native Flutter/RN iOS+Android apps, Kubernetes, Kafka/NATS, dedicated Redis/Timescale/PostGIS clusters, gateway-tier rate limiting, multi-tenant multi-region sharding, real LiveKit/WebRTC video. These are infra rewrites outside Lovable's TanStack Start + Supabase runtime; the doc itself frames them as the v2 target architecture, not features you can layer into the current deployment.

### Technical notes
- Single SQL migration adds 9 tables + RLS + GRANTs + the eligibility view + security-finding fixes.
- API helper extended to parse `X-API-Scope` requirements per endpoint and check `scopes` array; in-memory token-bucket per key id keyed by minute.
- Webhook signing: HMAC-SHA256 over body with per-subscription secret, sent as `X-VeloMed-Signature`.
- Audit writes go through a `logAudit()` server helper called from server fns and protected route handlers — no client writes.

### Deliverables checklist
```
[ ] Migration: 9 tables, RLS, GRANTs, view, security fixes
[ ] /compliance, /screening, /audit routes
[ ] Telehealth join button in patient + provider
[ ] Webhooks UI in /developer
[ ] 4 new API endpoints + scope enforcement + rate limit
[ ] OpenAPI spec updated, Swagger reflects new endpoints
[ ] Vitest + Playwright smoke pass
[ ] Security scan clean (or documented exceptions)
```

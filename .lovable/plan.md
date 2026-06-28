
# Superadmin Control Plane — revamp plan

The current `/superadmin` is a flat tabbed page that mixes tenants, plans, roles, API keys and a Swagger pane. The attached spec (`VeloMed_OS_Superadmin_Portal.docx` + dark-canvas standalone reference) describes a separate **internal SaaS-operations product** with its own RBAC, dual-source billing, monitoring board, bugs/Sentry queue, base/customization layers, KPI intelligence and an `/api/admin/v1/*` surface — and you've now explicitly asked that the **Swagger console live inside the portal** and the **privileges matrix get counters for the new API section**.

This plan is API-first: every screen reads/writes via `/api/admin/v1/*` server routes, so the same contract powers the UI and any internal tooling.

## Build order (this turn)

This is a large revamp; I will land it in **two prompts** so each is reviewable. This plan covers **Prompt A (foundation + API + Swagger + privileges counters)**, which is what your message specifically demands. Prompt B (gateway/Sentry wiring + base/customization layer editor + cohort analytics) will follow once A is verified.

### Prompt A — what ships now

**1. Portal RBAC (separate from operator roles)**
- New enum `portal_role` (`superadmin`, `finance`, `call_center`, `developer`, `analyst`) and tables `portal_role_assignments`, `portal_role_privileges(role, module, can_view, can_manage)`.
- `has_portal_role(_uid, _role)` security-definer fn; RLS on every new table restricts to portal staff.
- Keep operator `app_role` untouched. `superadmin` operator role auto-mirrors to portal `superadmin` so existing access doesn't break.

**2. New data model (Supabase migration, with GRANTs)**
- `subscribers` (mirrors `corporate_accounts` 1:1 via view — no data duplication; spec name reused for the API surface).
- `portal_subscriptions`, `portal_payments` (method ∈ card/online/bank_transfer, receipt_url, txn_ref, validated_by/at), `portal_promotions`, `portal_credits`, `portal_invoices`.
- `portal_tickets` + `portal_ticket_events` (type ∈ new_business/follow_up/bug/change_request).
- `portal_bugs` (source ∈ sentry/internal, external_ref, severity, count, status, assignee, last_seen_at).
- `config_base(key,value)`, `config_overrides(subscriber_id,key,value,updated_by,updated_at)` + `effective_config(subscriber_id)` SQL fn.
- `usage_daily(subscriber_id, day, api_calls, active_branches, active_teams)` + a backfill from `audit_log`.
- `portal_audit(actor_id, action, target, payload, at)`.
- Storage bucket `portal-receipts` for bank-transfer uploads (RLS: finance/superadmin only).

**3. API-first surface — `/api/admin/v1/*`**
- New TanStack server routes under `src/routes/api/admin/v1/`:
  - `subscribers` (GET list / POST provision), `subscribers/$id` (GET/PATCH lifecycle: suspend/resume/cancel),
  - `subscriptions` (GET/POST), `payments` (GET/POST + `/$id/validate`), `promotions`, `invoices`,
  - `tickets` (GET/POST) + `tickets/$id/events`,
  - `bugs` (GET/POST/PATCH), `webhooks/sentry` (inbound), `webhooks/stripe` (inbound stub — verified HMAC),
  - `config/base`, `config/overrides`, `config/effective/$subscriberId`,
  - `analytics/kpis` (counters + MRR/ARR/ARPA + churn + growth + insight lines),
  - `usage/daily`, `audit`, and **`openapi`** (serves the admin OpenAPI spec).
- Auth: separate `requirePortalKey()` helper that accepts either a portal session (`requireSupabaseAuth` + `has_portal_role`) **or** a scoped internal key from `portal_api_keys`. Consistent error envelope `{ error, code, request_id }`.
- Scopes: `subscribers:*`, `billing:*`, `tickets:*`, `bugs:*`, `config:*`, `analytics:read`, `webhooks:ingest`.

**4. Admin OpenAPI spec + in-portal Swagger console**
- New `src/lib/openapi-admin-spec.ts` documenting every `/api/admin/v1/*` endpoint (separate from the public spec).
- New route `/superadmin/api-docs` mounts Swagger UI against `/api/admin/v1/openapi` — lives **inside** the portal, behind portal auth, with the dark portal chrome.
- Keep the existing `/api-docs` (public v1) untouched.

**5. Revamped Superadmin portal UI** (`src/routes/_authenticated/superadmin.tsx` rebuilt against the new chrome)
- New left-rail layout, slate canvas, teal #34D8C2 / sky #5BB8F2 / coral #F47B6A accents, JetBrains Mono for IDs and money. Modules wired to `/api/admin/v1/*` via a tiny `adminFetch()` client:
  - **Overview** — counters (total / active / trialing / engaged / suspended / churned), MRR/ARR/ARPA tiles, churn-risk list, auto-insight lines.
  - **Subscribers** — directory + detail drawer (profile · subscription · payments · bugs · usage sparklines · churn-risk).
  - **Subscriptions & billing** — list, manual receipt upload + validate, promotions, invoices, reconciliation banner (gateway vs portal).
  - **Monitoring board** — sortable fleet-wide health table, row colour by risk.
  - **Bugs & debugging** — Sentry/internal merged queue, triage actions; per-business debug drawer (reuses existing `debug_events`).
  - **Inbox** (call-center) — new-business + follow-up tickets queue.
  - **Base & customization layers** — base config editor + per-subscriber overrides + effective-config diff view.
  - **Roles & privileges** — portal-scoped matrix (5 roles × modules with view/manage toggles), staff assignment.
  - **API & keys** — portal API keys (issue/rotate/revoke, scopes, last-used) + **Swagger console** tab.
- Every list view has a "View as cURL" affordance that emits the matching `/api/admin/v1` call, reinforcing API-first.

**6. Privileges matrix counters (your explicit ask)**
- Extend `src/lib/role-matrix.ts` with a new **API** area covering the new admin surface: `admin.api.subscribers`, `admin.api.billing`, `admin.api.tickets`, `admin.api.bugs`, `admin.api.config`, `admin.api.analytics`, `admin.api.webhooks`, `admin.api.openapi` — each tagged with the portal roles that hold it.
- `/privileges` and the Superadmin "Roles & privileges" tab gain a per-area **endpoint count** badge (e.g. "API · 8 endpoints · 23 capabilities") sourced from the admin OpenAPI spec so the counter stays accurate when endpoints are added.

**7. Seed data**
- Migration seeds ~10 subscribers across statuses, a handful of subscriptions/invoices, 3 bank-transfer payments awaiting validation, 2 promotions, 6 Sentry-style bugs, 4 call-centre tickets, and 60 days of `usage_daily` so every screen is populated immediately.

### Prompt B — deferred to the next turn

- Live Stripe/Ottu server-fn integration behind `STRIPE_SECRET_KEY`/`OTTU_API_KEY` (request these secrets then).
- Live Sentry pull behind `SENTRY_AUTH_TOKEN`.
- Cohort retention chart, NRR, expansion vs contraction breakdown.
- `admin.velomedos.com` subdomain split + dedicated auth realm.

## Technical notes

- All new endpoints live under `src/routes/api/admin/v1/` (NOT `api/public/`) — they require portal auth, not bypassed.
- Inbound webhooks (`/api/admin/v1/webhooks/{stripe,sentry}`) live under `api/public/` with HMAC verification per server-routes guidance, then write through the same admin tables.
- Migration includes `GRANT` blocks on every new public-schema table per platform rules, with `anon` excluded everywhere.
- No edits to `src/integrations/supabase/*` auto-gen files.
- Existing `/superadmin` URL is preserved; the route component is rebuilt in place.

## Verification before I report done

- `tsgo` clean.
- New tables visible via `/api/admin/v1/subscribers` with a portal session.
- Swagger console at `/superadmin/api-docs` renders the new admin spec.
- Privileges matrix shows the new API area with live endpoint counters.
- Seed data renders the Overview, Monitoring board, Bugs queue and Inbox on first load.

## Wave 1 — Operations Suite (Support + QA + Settings)

Ship 14 modules end-to-end: schema → admin APIs → Swagger → Superadmin pane → cross-portal wiring (Business, Patient) where chosen. In-app only (toast + bell/notification center). Wave 2 (CMS) follows in a later turn.

### Modules in this wave

**Subscriptions group**
- Refunds — issue refunds against `portal_payments`, audit-logged.

**Support group**
- Tickets — superadmin triage + tenant-scoped view in `/business`.
- Reviews — patient post-trip ratings, moderation queue in superadmin.
- Chat & filter — operator broadcast/inbox with profanity/PII filter rules.
- Push notifications — in-app announcements fanned to patient/provider/business inboxes.

**Quality Control group**
- Test runs — log Playwright/CI run summaries.
- Audit log — already has `audit_log`; build the read pane + filters + tenant slice.
- Smoke reports — uptime/health snapshots.
- Bug tracker — re-use `portal_bugs`; cross-link to tenants.
- Releases — semver tag, notes, status.
- Automated events — cron/webhook registry with last-run state.

**Settings group**
- Workspace — global platform settings (already has `platform_settings`; expose CRUD).
- Team & roles — superadmin operator roster (already partly there); add invite/disable/last-seen.
- Security — password policy, MFA toggle, session TTL, IP allowlists.

### Cross-portal wiring

- **Business workspace** (`/business`): tenant sees its own Tickets, Bugs, Audit slice (read + create where relevant).
- **Patient app** (`/patient`): in-app Notification Center + Reviews (post-trip rating prompt).
- Provider app gets a notification bell using the same feed.

### Notification model (in-app only)

Single `notifications` table fans out to audiences (`superadmin`, `tenant`, `patient`, `provider`, `user:<id>`). Bell component polls every 30s via React Query, marks read on open. No external email/SMS/web push yet — those become add-ons later.

### API surface (all under `/api/admin/v1/*` + Swagger entries)

Each module gets `GET /list`, `POST /` (create), `GET /:id`, `PATCH /:id`, `DELETE /:id` where it makes sense, plus a few action endpoints:
- `POST /refunds` (against payment_id), `POST /tickets/:id/events` (already exists), `POST /tickets/:id/assign`, `POST /tickets/:id/close`
- `POST /reviews/:id/moderate` (approve/hide)
- `POST /notifications` (broadcast), `GET /notifications/inbox` (per-user, exposed under `/api/public/v1/inbox` with bearer)
- `POST /releases/:id/publish`
- `POST /automations/:id/trigger`

Public surfaces:
- `POST /api/public/v1/reviews` (patient submits with trip token)
- `GET /api/public/v1/inbox` (authenticated user fetches own notifications)

Swagger (`src/lib/openapi-admin-spec.ts` + `openapi-spec.ts`) gets every new path documented with request/response schemas and `try-it-out` enabled.

### Superadmin UI panes

Wired into existing `superadmin.tsx` tab switcher. Each pane follows the established pattern (filters bar, table, drawer/dialog editor, audit chips). Reuses `admin-fetch.ts` and tokens already in `brand.ts`. SideNav `soon:*` entries promoted to real tab IDs.

### Business workspace additions

New tabs in `src/components/business/SideNav.tsx`: **Support → Tickets, Bugs, Notifications, Audit**. Tenant-scoped queries — same APIs, RLS filters by `tenant_id`.

### Patient app additions

- Notification bell in patient header.
- "Rate your trip" card on `/patient` after a completed trip; submits to `/api/public/v1/reviews`.

### Technical sequence

1. **Migration**: tables for `tickets_extras` (assignee, sla), `reviews`, `chat_filters`, `notifications`, `notification_reads`, `test_runs`, `smoke_reports`, `releases`, `automated_events`, `security_settings`, plus needed RLS/grants. Re-use existing `portal_bugs`, `portal_tickets`, `audit_log`, `platform_settings`.
2. **Admin APIs** under `src/routes/api/admin/v1/`.
3. **Public APIs** (`reviews`, `inbox`).
4. **Swagger** entries.
5. **Superadmin panes** + SideNav promotion.
6. **Business workspace** Tickets/Bugs/Audit/Notifications panes + nav.
7. **Patient** NotificationBell + RateTrip components.
8. Verify with typecheck + the route-redirects spec.

### Out of scope this wave

- CMS group (Pages, SEO, News, Blog cats, Media) — Wave 2.
- Email/SMS/Web Push channels — future add-on.
- Operator org chart / org-level RBAC editor beyond the existing matrix.
- External integrations for QA modules (no CI webhook wiring yet — manual ingest endpoint only).

/**
 * VeloMed OS — Admin Control Plane OpenAPI spec.
 * Mounted at /api/admin/v1/openapi and rendered inside the portal at /superadmin/api-docs.
 * Kept separate from the public /api/public/v1 spec.
 */

const ok = (desc: string, ref?: string) => ({
  [200]: {
    description: desc,
    content: { "application/json": { schema: ref ? { $ref: `#/components/schemas/${ref}` } : { type: "object" } } },
  },
});

export const openApiAdminSpec = {
  openapi: "3.1.0",
  info: {
    title: "VeloMed OS — Admin Control Plane API",
    version: "1.0.0",
    description:
      "Internal API powering the VeloMed Superadmin portal. Every screen in `/superadmin` consumes this surface; the same contract is available to internal tooling.\n\n## Authentication\nTwo ways to authenticate:\n- **Portal API key** in `x-admin-key` — issued by a superadmin from the portal's _API & keys_ tab.\n- **Portal staff session** — a signed-in user with a `portal_role_assignments` row (or the operator `superadmin` role) sends the Supabase bearer token in `Authorization: Bearer …`.\n\n## Scopes\n`subscribers:read`, `subscribers:write`, `billing:read`, `billing:write`, `tickets:read`, `tickets:write`, `bugs:read`, `bugs:write`, `config:read`, `config:write`, `analytics:read`, `audit:read`, `webhooks:ingest`. `*` grants all.\n\n## Error envelope\n`{ error: string, code: string, request_id: string }`.",
  },
  servers: [{ url: "/api/admin/v1", description: "Admin v1" }],
  components: {
    securitySchemes: {
      AdminKey: { type: "apiKey", in: "header", name: "x-admin-key" },
      PortalSession: { type: "http", scheme: "bearer" },
    },
    schemas: {
      Subscriber: { type: "object", properties: { id: { type: "string", format: "uuid" }, slug: { type: "string" }, company_name: { type: "string" }, country: { type: "string", nullable: true }, status: { type: "string", enum: ["lead","trialing","active","past_due","suspended","churned"] }, plan_tier: { type: "string" }, created_at: { type: "string", format: "date-time" } } },
      Subscription: { type: "object", properties: { id: { type: "string", format: "uuid" }, subscriber_id: { type: "string", format: "uuid" }, plan: { type: "string" }, seats: { type: "integer" }, price_cents: { type: "integer" }, currency: { type: "string" }, cycle: { type: "string" }, status: { type: "string" }, started_at: { type: "string", format: "date-time" }, renews_at: { type: "string", format: "date-time", nullable: true } } },
      Payment: { type: "object", properties: { id: { type: "string", format: "uuid" }, subscriber_id: { type: "string", format: "uuid" }, method: { type: "string", enum: ["card","online","bank_transfer","complimentary"] }, amount_cents: { type: "integer" }, currency: { type: "string" }, status: { type: "string", enum: ["pending","succeeded","failed","refunded"] }, receipt_url: { type: "string", nullable: true }, txn_ref: { type: "string", nullable: true } } },
      Ticket: { type: "object", properties: { id: { type: "string", format: "uuid" }, subscriber_id: { type: "string", format: "uuid", nullable: true }, type: { type: "string", enum: ["new_business","follow_up","bug","change_request"] }, priority: { type: "string" }, status: { type: "string" }, subject: { type: "string" }, body: { type: "string", nullable: true } } },
      Bug: { type: "object", properties: { id: { type: "string", format: "uuid" }, subscriber_id: { type: "string", format: "uuid", nullable: true }, source: { type: "string", enum: ["sentry","internal","playwright"] }, external_ref: { type: "string", nullable: true }, title: { type: "string" }, severity: { type: "string" }, count: { type: "integer" }, status: { type: "string" }, last_seen_at: { type: "string", format: "date-time" } } },
      ConfigBase: { type: "object", properties: { key: { type: "string" }, value: {}, description: { type: "string", nullable: true } } },
      ConfigOverride: { type: "object", properties: { id: { type: "string", format: "uuid" }, subscriber_id: { type: "string", format: "uuid" }, key: { type: "string" }, value: {} } },
      EffectiveConfig: { type: "object", properties: { key: { type: "string" }, value: {}, source: { type: "string", enum: ["base","override"] }, updated_at: { type: "string", format: "date-time" } } },
      KPI: { type: "object", properties: { counters: { type: "object" }, revenue: { type: "object" }, churn: { type: "object" }, growth: { type: "object" }, insights: { type: "array", items: { type: "string" } } } },
      Error: { type: "object", properties: { error: { type: "string" }, code: { type: "string" }, request_id: { type: "string" } } },
    },
  },
  security: [{ AdminKey: [] }, { PortalSession: [] }],
  paths: {
    "/subscribers": {
      get: { summary: "List subscribers", description: "Scope `subscribers:read`.", responses: ok("OK", "Subscriber") },
      post: { summary: "Provision a subscriber", description: "Scope `subscribers:write`.", responses: { 201: { description: "Created" } } },
    },
    "/subscribers/{id}": {
      get: { summary: "Subscriber detail (profile + subs + payments + bugs + usage)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
      patch: { summary: "Lifecycle action — suspend / resume / cancel / activate", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
    },
    "/subscriptions": {
      get: { summary: "List portal subscriptions", description: "Scope `billing:read`.", responses: ok("OK", "Subscription") },
      post: { summary: "Create / replace a subscription", description: "Scope `billing:write`.", responses: { 201: { description: "Created" } } },
    },
    "/payments": {
      get: { summary: "List payments (filter by status)", description: "Scope `billing:read`.", responses: ok("OK", "Payment") },
      post: { summary: "Record a manual payment (bank transfer receipt or txn ref)", description: "Scope `billing:write`. Initial status is `pending` and awaits validation.", responses: { 201: { description: "Created" } } },
    },
    "/payments/{id}/validate": {
      post: { summary: "Validate a pending payment", description: "Scope `billing:write`. Activates / extends the linked subscription.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
    },
    "/promotions": {
      get: { summary: "List promotions", description: "Scope `billing:read`.", responses: ok("OK") },
      post: { summary: "Create a promotion", description: "Scope `billing:write`.", responses: { 201: { description: "Created" } } },
    },
    "/invoices": { get: { summary: "List portal invoices", description: "Scope `billing:read`.", responses: ok("OK") } },
    "/tickets": {
      get: { summary: "Call-centre / internal ticket queue", description: "Scope `tickets:read`. Filter `?type=new_business|follow_up|bug|change_request`.", responses: ok("OK", "Ticket") },
      post: { summary: "File a new ticket", description: "Scope `tickets:write`.", responses: { 201: { description: "Created" } } },
    },
    "/tickets/{id}/events": {
      post: { summary: "Append a thread event to a ticket", description: "Scope `tickets:write`.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 201: { description: "Created" } } },
    },
    "/bugs": {
      get: { summary: "List bugs (Sentry + internal + Playwright)", description: "Scope `bugs:read`.", responses: ok("OK", "Bug") },
      post: { summary: "Log an internal bug", description: "Scope `bugs:write`.", responses: { 201: { description: "Created" } } },
      patch: { summary: "Triage / assign / resolve", description: "Scope `bugs:write`. Body: `{ id, status?, assignee_id? }`.", responses: ok("OK") },
    },
    "/config/base": {
      get: { summary: "Read the base config (all subscribers inherit)", description: "Scope `config:read`.", responses: ok("OK", "ConfigBase") },
      put: { summary: "Upsert a base config key", description: "Scope `config:write`.", responses: ok("OK") },
    },
    "/config/overrides": {
      get: { summary: "List per-subscriber overrides", description: "Scope `config:read`.", responses: ok("OK", "ConfigOverride") },
      put: { summary: "Upsert a per-subscriber override", description: "Scope `config:write`.", responses: ok("OK") },
      delete: { summary: "Clear a per-subscriber override", description: "Scope `config:write`.", responses: ok("OK") },
    },
    "/config/effective/{subscriberId}": {
      get: { summary: "Resolve effective config (base + overrides) for a subscriber", description: "Scope `config:read`.", parameters: [{ name: "subscriberId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK", "EffectiveConfig") },
    },
    "/analytics/kpis": {
      get: { summary: "Counters, MRR/ARR/ARPA, churn, growth + auto insight lines", description: "Scope `analytics:read`.", responses: ok("OK", "KPI") },
    },
    "/usage/daily": { get: { summary: "Daily usage by subscriber", description: "Scope `analytics:read`. Query `?subscriber_id=` and `?days=` (default 60).", responses: ok("OK") } },
    "/audit": { get: { summary: "Portal audit log", description: "Scope `audit:read`. Query `?limit=` (max 500).", responses: ok("OK") } },
    "/openapi": { get: { summary: "This spec (machine-readable)", security: [], responses: ok("OK") } },
  },
} as const;

/** Counters used by the privileges matrix to render "API · N endpoints" badges. */
export function adminEndpointCount(): number {
  let total = 0;
  for (const path of Object.values(openApiAdminSpec.paths) as Record<string, unknown>[]) {
    for (const m of ["get", "post", "put", "patch", "delete"]) if ((path as Record<string, unknown>)[m]) total++;
  }
  return total;
}
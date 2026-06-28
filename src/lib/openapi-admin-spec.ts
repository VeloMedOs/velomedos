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
      BusinessRequest: { type: "object", properties: {
        id: { type: "string", format: "uuid" },
        company_name: { type: "string" }, legal_name: { type: "string", nullable: true }, nick_name: { type: "string", nullable: true },
        vat_number: { type: "string", nullable: true }, cr_number: { type: "string", nullable: true }, website_url: { type: "string", nullable: true },
        address_line: { type: "string", nullable: true }, city: { type: "string", nullable: true }, region: { type: "string", nullable: true }, postal_code: { type: "string", nullable: true }, country: { type: "string", nullable: true },
        contact_name: { type: "string" }, contact_email: { type: "string" }, contact_phone: { type: "string", nullable: true },
        source: { type: "string", enum: ["website","call_center","partner","referral","event","other"] },
        stage:  { type: "string", enum: ["request","contacted","demo","prospect","lead","negotiation","subscribed","rejected","archived"] },
        status: { type: "string" }, assigned_to: { type: "string", format: "uuid", nullable: true },
        fleet_size: { type: "integer", nullable: true }, expected_seats: { type: "integer", nullable: true },
        estimated_value_cents: { type: "integer", nullable: true }, currency: { type: "string" },
        converted_tenant_id: { type: "string", format: "uuid", nullable: true },
        created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" },
      } },
      Plan: { type: "object", properties: {
        id: { type: "string", format: "uuid" }, code: { type: "string" }, name: { type: "string" }, description: { type: "string", nullable: true },
        price_cents: { type: "integer" }, currency: { type: "string" }, billing_period: { type: "string", enum: ["monthly","yearly","one_time","custom"] },
        included_seats: { type: "integer" }, features: { type: "array", items: { type: "string" } }, is_active: { type: "boolean" }, sort_order: { type: "integer" },
      } },
      TenantSubscription: { type: "object", properties: {
        id: { type: "string", format: "uuid" }, tenant_id: { type: "string", format: "uuid" }, plan_id: { type: "string", format: "uuid" },
        status: { type: "string" }, seats: { type: "integer" },
        current_period_start: { type: "string", format: "date-time" }, current_period_end: { type: "string", format: "date-time", nullable: true },
        cancel_at_period_end: { type: "boolean" }, notes: { type: "string", nullable: true },
      } },
      RoleGrant: { type: "object", properties: { user_id: { type: "string", format: "uuid" }, role: { type: "string" }, created_at: { type: "string", format: "date-time" } } },
      Privilege: { type: "object", properties: { role: { type: "string" }, module: { type: "string" }, can_view: { type: "boolean" }, can_manage: { type: "boolean" }, updated_at: { type: "string", format: "date-time" } } },
      Error: { type: "object", properties: { error: { type: "string" }, code: { type: "string" }, request_id: { type: "string" } } },
    },
  },
  security: [{ AdminKey: [] }, { PortalSession: [] }],
  paths: {
    "/business-requests": {
      get:  { summary: "List business requests", description: "Scope `subscribers:read`. Filter `?stage=`, `?source=`, `?q=` (search legal/nick/vat/cr/email).", responses: ok("OK", "BusinessRequest") },
      post: { summary: "Create a business request", description: "Scope `subscribers:write`. Used by call-center agents.", responses: { 201: { description: "Created" } } },
    },
    "/business-requests/{id}": {
      get:    { summary: "Get a business request (with lifecycle events)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
      patch:  { summary: "Update business profile / contact fields", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
      delete: { summary: "Delete a business request", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
    },
    "/business-requests/{id}/advance": {
      post: { summary: "Move request to next pipeline stage", description: "Stages: request → contacted → demo → prospect → lead → negotiation → subscribed. Use `rejected` / `archived` to terminate. Optional `note` is appended to the event log.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
    },
    "/business-requests/{id}/convert": {
      post: { summary: "Convert an approved request into a tenant", description: "Provisions a `corporate_accounts` row (and optionally a `tenant_subscriptions` row when `plan_id` is given), marks the request as `subscribed`, and links `converted_tenant_id`. Idempotent — returns 409 if already converted.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 201: { description: "Created" } } },
    },
    "/plans": {
      get:  { summary: "List subscription plans", description: "Scope `billing:read`.", responses: ok("OK", "Plan") },
      post: { summary: "Create a plan", description: "Scope `billing:write`.", responses: { 201: { description: "Created" } } },
    },
    "/plans/{id}": {
      get:    { summary: "Get a plan", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK", "Plan") },
      patch:  { summary: "Update a plan", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
      delete: { summary: "Delete a plan", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
    },
    "/tenant-subscriptions": {
      get:  { summary: "List tenant subscriptions", description: "Scope `billing:read`. Filter `?tenant_id=`.", responses: ok("OK", "TenantSubscription") },
      post: { summary: "Assign a plan to a tenant", description: "Scope `billing:write`. Cancels any existing active subscription for the tenant.", responses: { 201: { description: "Created" } } },
    },
    "/tenant-subscriptions/{id}": {
      get:    { summary: "Get a tenant subscription", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK", "TenantSubscription") },
      patch:  { summary: "Update seats / status / period", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
      delete: { summary: "Delete a tenant subscription", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: ok("OK") },
    },
    "/roles": {
      get:    { summary: "List role grants", description: "Scope `subscribers:read`. Filter `?user_id=`.", responses: ok("OK", "RoleGrant") },
      post:   { summary: "Grant a role to a user", description: "Scope `subscribers:write`. Body `{ user_id, role }`.", responses: { 201: { description: "Created" } } },
      delete: { summary: "Revoke a role grant", description: "Scope `subscribers:write`. Query `?user_id=&role=`.", responses: ok("OK") },
    },
    "/privileges": {
      get:    { summary: "List privilege rows", description: "Scope `config:read`. Filter `?role=`.", responses: ok("OK", "Privilege") },
      put:    { summary: "Upsert a role/module privilege", description: "Scope `config:write`. Body `{ role, module, can_view, can_manage }`.", responses: ok("OK") },
      delete: { summary: "Delete a privilege row", description: "Scope `config:write`. Query `?role=&module=`.", responses: ok("OK") },
    },
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
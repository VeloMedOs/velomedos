/**
 * VeloMed OS — platform roles & privileges matrix
 * Single source of truth surfaced in the Superadmin "Privileges" tab and the
 * /privileges public reference page.
 */

export type AppRole =
  | "superadmin"
  | "admin"
  | "dispatcher"
  | "business_admin"
  | "developer"
  | "paramedic"
  | "driver"
  | "patient";

export const ROLE_ORDER: AppRole[] = [
  "superadmin",
  "admin",
  "dispatcher",
  "business_admin",
  "developer",
  "paramedic",
  "driver",
  "patient",
];

export type RoleMeta = {
  role: AppRole;
  label: string;
  scope: "platform" | "tenant" | "field" | "consumer";
  blurb: string;
  tone: string; // tailwind classes for chip
};

export const ROLE_META: Record<AppRole, RoleMeta> = {
  superadmin:     { role: "superadmin",     label: "Superadmin",        scope: "platform", tone: "bg-emergency/20 text-emergency", blurb: "VeloMed platform owners. Full control of tenants, subscriptions, roles, API keys and audit." },
  admin:          { role: "admin",          label: "Operations Admin",  scope: "tenant",   tone: "bg-action/20 text-action",       blurb: "Tenant operations lead. Configures fleet, clinics, training and compliance." },
  dispatcher:     { role: "dispatcher",     label: "Dispatcher",        scope: "tenant",   tone: "bg-action/20 text-action",       blurb: "Call-center triage and live assignment. Owns the incident queue." },
  business_admin: { role: "business_admin", label: "Business Admin",    scope: "tenant",   tone: "bg-action/20 text-action",       blurb: "Tenant workspace owner. Manages members, billing seats and their own API keys." },
  developer:      { role: "developer",      label: "Developer",         scope: "tenant",   tone: "bg-panel-elevated text-foreground", blurb: "Issues personal API keys, reads OpenAPI docs and webhook deliveries." },
  paramedic:      { role: "paramedic",      label: "Paramedic",         scope: "field",    tone: "bg-stable/20 text-stable",       blurb: "Provider cockpit. Updates incident state, files patient observations." },
  driver:         { role: "driver",         label: "Driver",            scope: "field",    tone: "bg-stable/20 text-stable",       blurb: "Streams ambulance GPS and vehicle defects from the field." },
  patient:        { role: "patient",        label: "Patient",           scope: "consumer", tone: "bg-muted text-muted-foreground", blurb: "Files emergencies, books clinics & telehealth, tracks their ride." },
};

export type Capability = {
  id: string;
  area: string;
  label: string;
  description: string;
  roles: AppRole[];
};

export const CAPABILITIES: Capability[] = [
  // Platform
  { id: "platform.tenants",     area: "Platform",     label: "Manage tenants",            description: "Create, suspend and configure tenant workspaces.",                 roles: ["superadmin"] },
  { id: "platform.subs",        area: "Platform",     label: "Assign subscriptions",      description: "Allocate plans, change seats, suspend or cancel billing.",         roles: ["superadmin"] },
  { id: "platform.roles",       area: "Platform",     label: "Grant platform roles",      description: "Promote or revoke any of the 8 platform roles for any user.",     roles: ["superadmin"] },
  { id: "platform.audit",       area: "Platform",     label: "Read global audit log",     description: "Every privileged action across all tenants.",                      roles: ["superadmin"] },
  { id: "platform.requests",    area: "Platform",     label: "Approve business leads",    description: "Review inbound /contact requests and onboard tenants.",            roles: ["superadmin"] },

  // API
  { id: "api.keys.platform",    area: "API",          label: "Issue platform API keys",   description: "Create / rotate / revoke any tenant's keys.",                       roles: ["superadmin"] },
  { id: "api.keys.tenant",      area: "API",          label: "Issue tenant API keys",     description: "Create and revoke API keys scoped to your tenant.",                 roles: ["superadmin","business_admin"] },
  { id: "api.keys.personal",    area: "API",          label: "Issue personal API keys",   description: "Issue keys bound to your own user.",                                roles: ["superadmin","admin","developer","business_admin"] },
  { id: "api.docs",             area: "API",          label: "Read OpenAPI reference",    description: "/api-docs Swagger console + try-it.",                                roles: ["superadmin","admin","dispatcher","business_admin","developer"] },
  { id: "api.webhooks",         area: "API",          label: "Manage webhook subscriptions", description: "Subscribe to incident / trip / compliance events.",              roles: ["superadmin","admin","business_admin","developer"] },

  // Dispatch
  { id: "ops.incident.read",    area: "Dispatch",     label: "View incident queue",       description: "See the live SLA queue and incident timeline.",                     roles: ["superadmin","admin","dispatcher"] },
  { id: "ops.incident.assign",  area: "Dispatch",     label: "Assign / reassign units",   description: "Push assignments to ambulances and crews.",                         roles: ["superadmin","admin","dispatcher"] },
  { id: "ops.fleet",            area: "Dispatch",     label: "Live fleet map",            description: "Real-time ambulance locations and ETAs.",                           roles: ["superadmin","admin","dispatcher","business_admin"] },

  // Field
  { id: "field.workflow",       area: "Field",        label: "Run provider workflow",     description: "Accept / en-route / on-scene / transport state.",                   roles: ["paramedic","driver"] },
  { id: "field.gps",            area: "Field",        label: "Stream GPS telemetry",      description: "Browser geolocation → ambulance_locations.",                        roles: ["paramedic","driver"] },
  { id: "field.patient",        area: "Field",        label: "File patient observations", description: "Vitals, symptoms, handover notes.",                                 roles: ["paramedic"] },
  { id: "field.defects",        area: "Field",        label: "Report vehicle defects",    description: "Pre/post-trip inspection findings.",                                roles: ["driver","paramedic"] },

  // Compliance & business
  { id: "comp.read",            area: "Compliance",   label: "Read credentials & WOs",    description: "Licenses, work orders, expiry watchlist.",                          roles: ["superadmin","admin","business_admin"] },
  { id: "comp.write",           area: "Compliance",   label: "Manage credentials & WOs",  description: "Renew licenses, open / close work orders.",                         roles: ["superadmin","admin"] },
  { id: "biz.members",          area: "Workspace",    label: "Manage tenant members",     description: "Invite / remove members of your tenant.",                           roles: ["superadmin","business_admin"] },
  { id: "biz.billing",          area: "Workspace",    label: "View billing & seats",      description: "See your active plan and seat allocation.",                         roles: ["superadmin","business_admin"] },

  // Patient
  { id: "patient.request",      area: "Patient",      label: "File emergency request",    description: "Trigger an incident from the patient app.",                         roles: ["patient"] },
  { id: "patient.book",         area: "Patient",      label: "Book clinic / telehealth",  description: "Remote clinic appointments and telehealth sessions.",               roles: ["patient"] },
  { id: "patient.track",        area: "Patient",      label: "Track my ride",             description: "Live ambulance ETA via tokenized trip share.",                       roles: ["patient"] },

  // VeloMed Control Plane — Admin API surface (separate from the public /api/public/v1 product)
  { id: "admin.api.openapi",     area: "Admin API", label: "Read Admin API reference",  description: "/superadmin/api-docs Swagger console for /api/admin/v1.*.", roles: ["superadmin","developer"] },
  { id: "admin.api.subscribers", area: "Admin API", label: "Subscribers API",           description: "GET/POST/PATCH /api/admin/v1/subscribers — directory & lifecycle (suspend/resume/cancel).", roles: ["superadmin"] },
  { id: "admin.api.billing",     area: "Admin API", label: "Billing API",               description: "Subscriptions, payments, manual validate, promotions, invoices.", roles: ["superadmin"] },
  { id: "admin.api.tickets",     area: "Admin API", label: "Tickets API",               description: "Call-centre new-business / follow-up / bug / change-request queue + threads.", roles: ["superadmin"] },
  { id: "admin.api.bugs",        area: "Admin API", label: "Bugs API",                  description: "Sentry + internal bug ingest, list, triage.", roles: ["superadmin","developer"] },
  { id: "admin.api.config",      area: "Admin API", label: "Config API",                description: "Base layer + per-tenant overrides + effective config resolver.", roles: ["superadmin","developer"] },
  { id: "admin.api.analytics",   area: "Admin API", label: "Analytics & KPIs API",      description: "Counters, MRR/ARR/ARPA, churn, growth, auto-insight lines.", roles: ["superadmin"] },
  { id: "admin.api.audit",       area: "Admin API", label: "Audit log API",             description: "Tamper-evident portal_audit feed of every privileged action.", roles: ["superadmin"] },
  { id: "admin.api.webhooks",    area: "Admin API", label: "Webhook ingest",            description: "Inbound from Stripe/Ottu (payments) and Sentry (issues).", roles: ["superadmin"] },
];

/** Compute the effective capability set for a multi-role user. */
export function effectiveCapabilities(userRoles: AppRole[]): Capability[] {
  const set = new Set(userRoles);
  return CAPABILITIES.filter((c) => c.roles.some((r) => set.has(r)));
}

/** Convenience: capability index by area for the matrix view. */
export function capabilitiesByArea(): Record<string, Capability[]> {
  const out: Record<string, Capability[]> = {};
  for (const c of CAPABILITIES) (out[c.area] ||= []).push(c);
  return out;
}
export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "VeloMed OS Public API",
    version: "1.2.0",
    description:
      "Read-and-write REST API for ambulance fleet, incidents, clinics, courses, compliance, mobile screening, and the in-app debug stream.\n\n## Authentication\nAuthenticate with a key issued from the Developer console using the `x-api-key` header. Keys come in three issuance scopes:\n- **Platform keys** — issued by VeloMed superadmins, not bound to a tenant.\n- **Tenant keys** — issued by a tenant's business admin or by a superadmin on the tenant's behalf, bound to the tenant's data.\n- **Personal keys** — issued by an individual developer for their own user.\n\n## Scopes\nEach key carries an explicit scope set; missing the required scope returns `403`. Available scopes: `fleet:read`, `incidents:read`, `incidents:write`, `clinics:read`, `courses:read`, `compliance:read`, `screening:read`, `screening:write`, `debug:read`, `debug:write`. A `*` scope grants all of the above.\n\n## Rate limiting\nEvery key has a per-minute rate limit. Overruns return `429` and reset on the next minute boundary. Default limit is 60 rpm; superadmin-issued platform keys default to 600 rpm.\n\n## Audit\nWrite endpoints record an `audit_log` row with the calling key id and request payload digest.",
    contact: { name: "VeloMed Infrastructure Group" },
  },
  servers: [{ url: "/api/public/v1", description: "Public v1" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
    },
    schemas: {
      Ambulance: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          code: { type: "string", example: "AMB-401" },
          type: { type: "string", enum: ["BLS", "ALS", "ICU", "NEONATAL"] },
          status: { type: "string", enum: ["available", "en_route", "on_scene", "transporting", "out_of_service"] },
          home_base: { type: "string", nullable: true },
          current_lat: { type: "number", nullable: true },
          current_lng: { type: "number", nullable: true },
          last_ping_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      Incident: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          code: { type: "string" },
          severity: { type: "string", enum: ["code_red", "code_yellow", "routine"] },
          status: { type: "string" },
          address: { type: "string", nullable: true },
          pickup_lat: { type: "number" },
          pickup_lng: { type: "number" },
          symptoms: { type: "string", nullable: true },
          assigned_ambulance_id: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      IncidentInput: {
        type: "object",
        required: ["pickup_lat", "pickup_lng", "severity"],
        properties: {
          caller_name: { type: "string", nullable: true },
          caller_phone: { type: "string", nullable: true },
          patient_name: { type: "string", nullable: true },
          address: { type: "string", nullable: true },
          pickup_lat: { type: "number" },
          pickup_lng: { type: "number" },
          severity: { type: "string", enum: ["code_red", "code_yellow", "routine"] },
          symptoms: { type: "string", nullable: true },
        },
      },
      Course: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          summary: { type: "string", nullable: true },
          level: { type: "string", nullable: true },
          duration_hours: { type: "integer", nullable: true },
          price: { type: "number", nullable: true },
        },
      },
      Clinic: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          address: { type: "string", nullable: true },
          lat: { type: "number", nullable: true },
          lng: { type: "number", nullable: true },
          specialties: { type: "array", items: { type: "string" } },
        },
      },
      Credential: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          kind: { type: "string", enum: ["paramedic_license", "driver_license", "vehicle_registration", "operating_permit", "provider_license"] },
          subject_user_id: { type: "string", nullable: true },
          subject_ambulance_id: { type: "string", nullable: true },
          reference: { type: "string" },
          issuer: { type: "string", nullable: true },
          issued_on: { type: "string", format: "date", nullable: true },
          expires_on: { type: "string", format: "date" },
        },
      },
      WorkOrder: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          vehicle_id: { type: "string", format: "uuid" },
          type: { type: "string", enum: ["preventive", "corrective"] },
          status: { type: "string", enum: ["open", "in_progress", "closed", "cancelled"] },
          opened_at: { type: "string", format: "date-time" },
          closed_at: { type: "string", format: "date-time", nullable: true },
          odometer_km: { type: "integer", nullable: true },
          downtime_minutes: { type: "integer", nullable: true },
        },
      },
      ScreeningOrder: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          corporate_account_id: { type: "string", format: "uuid" },
          candidate_name: { type: "string" },
          candidate_id_ref: { type: "string", nullable: true },
          package_id: { type: "string", format: "uuid" },
          appointment_at: { type: "string", format: "date-time", nullable: true },
          status: { type: "string", enum: ["booked", "sample_collected", "results_ready", "certified", "cancelled"] },
          created_at: { type: "string", format: "date-time" },
        },
      },
      ScreeningOrderInput: {
        type: "object",
        required: ["corporate_account_id", "candidate_name", "package_id"],
        properties: {
          corporate_account_id: { type: "string", format: "uuid" },
          candidate_name: { type: "string" },
          candidate_id_ref: { type: "string", nullable: true },
          package_id: { type: "string", format: "uuid" },
          appointment_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      DebugEvent: {
        type: "object",
        required: ["source","kind"],
        properties: {
          tenant_id: { type: "string", format: "uuid", nullable: true },
          source:    { type: "string", enum: ["overlay","console","playwright","api","manual"] },
          kind:      { type: "string", enum: ["glitch","snapshot","metric","error","info"] },
          severity:  { type: "string", enum: ["info","warn","error","critical"], default: "info" },
          route:     { type: "string", nullable: true, maxLength: 500 },
          viewport:  { type: "string", nullable: true, enum: ["mobile","tablet","desktop"] },
          message:   { type: "string", nullable: true, maxLength: 2000 },
          payload:   { type: "object", additionalProperties: true },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/fleet": {
      get: {
        summary: "List ambulance fleet",
        description: "Requires scope `fleet:read`.",
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Ambulance" } } } } },
          "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Missing scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/fleet/{id}/location": {
      get: {
        summary: "Get the latest known location for an ambulance",
        description: "Requires scope `fleet:read`.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, recorded_at: { type: "string", format: "date-time" } } } } } },
          "404": { description: "No location on file" },
        },
      },
    },
    "/vehicles/{id}/defects": {
      get: { summary: "List defects for a vehicle", description: "Requires scope `compliance:read`.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "OK" } } },
    },
    "/vehicles/{id}/work_orders": {
      get: { summary: "List work orders for a vehicle", description: "Requires scope `compliance:read`.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "OK" } } },
    },
    "/vehicles/{id}/credentials": {
      get: { summary: "Vehicle + assigned crew credentials", description: "Requires scope `compliance:read`. Returns `{ vehicle: Credential[], crew: Credential[] }`.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "OK" } } },
    },
    "/eta": {
      post: {
        summary: "Real road-based ETA via Google Routes",
        description: "Requires scope `fleet:read`. Returns `{ distance_km, duration_seconds, polyline }`.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["origin","destination"], properties: { origin: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } }, destination: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } } } } } } },
        responses: { "200": { description: "OK" } },
      },
    },
    "/share/{token}": {
      get: { summary: "Public live trip snapshot (no API key, token-only)", parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }], security: [], responses: { "200": { description: "OK" }, "410": { description: "Expired or revoked" } } },
    },
    "/debug/events": {
      get: {
        summary: "Debug · list events (per tenant, kind, severity, viewport)",
        description: "Requires scope `debug:read`. Supports query params `tenant_id`, `kind`, `severity`, `viewport`, `since`, `limit` (max 500).",
        parameters: [
          { name: "tenant_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "kind", in: "query", schema: { type: "string", enum: ["glitch","snapshot","metric","error","info"] } },
          { name: "severity", in: "query", schema: { type: "string", enum: ["info","warn","error","critical"] } },
          { name: "viewport", in: "query", schema: { type: "string", enum: ["mobile","tablet","desktop"] } },
          { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 500, default: 100 } },
        ],
        responses: { "200": { description: "OK — `{ events: DebugEvent[] }`" }, "401": { description: "Missing API key" }, "403": { description: "Missing scope `debug:read`" } },
      },
      post: {
        summary: "Debug · ingest one or many events (overlay, console, Playwright)",
        description: "Requires scope `debug:write`. Accepts a single object or an array. Used by the in-app debug overlay and by Playwright visual-regression runners to classify glitches per business.",
        requestBody: { required: true, content: { "application/json": { schema: { oneOf: [
          { $ref: "#/components/schemas/DebugEvent" },
          { type: "array", items: { $ref: "#/components/schemas/DebugEvent" } },
        ] } } } },
        responses: { "200": { description: "OK — `{ ok, inserted, ids }`" }, "400": { description: "Invalid input" }, "403": { description: "Missing scope `debug:write`" } },
      },
    },
    "/web_intake": {
      post: {
        summary: "Public website intake — creates an incident or a lead",
        description: "Open endpoint (no API key) used by the public site contact form. Emergencies create an `incidents` row with `source=web` and a `web_submission` event; clinic/screening/rental/training/general become `web_leads`. Rate-limited per IP.",
        security: [],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["kind","name"], properties: {
          kind: { type: "string", enum: ["emergency","clinic","screening","rental","training","general"] },
          name: { type: "string", maxLength: 120 },
          phone: { type: "string", maxLength: 40, nullable: true },
          email: { type: "string", format: "email", maxLength: 255, nullable: true },
          city: { type: "string", maxLength: 120, nullable: true },
          address: { type: "string", maxLength: 500, nullable: true },
          lat: { type: "number", nullable: true }, lng: { type: "number", nullable: true },
          message: { type: "string", maxLength: 2000, nullable: true },
          severity: { type: "string", enum: ["code_red","code_yellow","routine"], nullable: true },
          symptoms: { type: "string", maxLength: 2000, nullable: true },
          service: { type: "string", maxLength: 200, nullable: true },
        } } } } },
        responses: { "200": { description: "OK — returns reference_code" }, "400": { description: "Invalid input" }, "429": { description: "Rate limited" } },
      },
    },
    "/incidents": {
      get: {
        summary: "List recent incidents",
        description: "Requires scope `incidents:read`.",
        responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Incident" } } } } } },
      },
      post: {
        summary: "File a new incident",
        description: "Requires scope `incidents:write`. Recorded in audit log.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/IncidentInput" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Incident" } } } } },
      },
    },
    "/incidents/{id}": {
      get: {
        summary: "Get an incident by id",
        description: "Requires scope `incidents:read`.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Incident" } } } } },
      },
    },
    "/clinics": {
      get: { summary: "List remote clinics (public, no phone)", description: "Requires scope `clinics:read`.", responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Clinic" } } } } } } },
    },
    "/courses": {
      get: { summary: "List training courses", description: "Requires scope `courses:read`.", responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Course" } } } } } } },
    },
    "/credentials": {
      get: {
        summary: "List credentials with optional expiry filter",
        description: "Requires scope `compliance:read`. Query `?expiring_in_days=30` to list credentials expiring within N days.",
        parameters: [{ name: "expiring_in_days", in: "query", required: false, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Credential" } } } } } },
      },
    },
    "/work_orders": {
      get: {
        summary: "List vehicle work orders",
        description: "Requires scope `compliance:read`. Optional `?status=open`.",
        parameters: [{ name: "status", in: "query", required: false, schema: { type: "string", enum: ["open", "in_progress", "closed", "cancelled"] } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WorkOrder" } } } } } },
      },
    },
    "/screening_orders": {
      get: {
        summary: "List mobile-clinic screening orders",
        description: "Requires scope `screening:read`.",
        responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ScreeningOrder" } } } } } },
      },
      post: {
        summary: "Book a new screening order",
        description: "Requires scope `screening:write`. Recorded in audit log.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ScreeningOrderInput" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/ScreeningOrder" } } } } },
      },
    },
  },
} as const;
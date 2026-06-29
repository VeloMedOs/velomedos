/**
 * VeloMed OS — Clinical (Mini-HIS / NPHIES MDS v3) OpenAPI spec.
 * Mounted at /api/clinical/v1/openapi and rendered alongside the Admin and
 * Public specs inside /superadmin/api-docs.
 *
 * Phase 0 ships the spec skeleton only — `paths` is filled phase by phase as
 * Beneficiary, Coverage, Encounter, Diagnosis, Orders, Claim, and FHIR bundle
 * endpoints land.
 */
export const openApiClinicalSpec = {
  openapi: "3.1.0",
  info: {
    title: "VeloMed OS Clinical API",
    version: "0.1.0",
    description:
      "Tenant-scoped clinical data plane implementing the NPHIES Minimal Data Set v3 and FHIR R4 unified-health-file structure.\n\n## Scope\nThe API hosts two claim shapes:\n- **Itemized (SBS v3)** — outpatient, emergency, day-case, pharmacy.\n- **DRG-bundled (AR-DRG v9.0)** — inpatient admissions, priced via DRG base rate × relative weight with outlier/ICU adjustments.\n\n## Authentication\nSigned-in tenant members send the Supabase bearer token in `Authorization: Bearer …`. Cross-tenant operators may pin a tenant with the `x-tenant-id` header.\n\n## Error envelope\n`{ error: string, code: string, request_id: string }`.\n\n## Code systems\nReference data lives in `code_system` / `code_value` and covers ICD-10-AM (10th), ACHI (10th), ACS (10th), AR-DRG (9.0), SBS (3), LOINC, GTIN, SFDA MRID/scientific, and NPHIES LOV. Code values are loaded from CHI-provided files — VeloMed does not redistribute the source classifications.",
    contact: { name: "VeloMed Clinical Platform" },
  },
  servers: [{ url: "/api/clinical/v1", description: "Clinical v1" }],
  components: {
    securitySchemes: {
      TenantSession: { type: "http", scheme: "bearer" },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error", "code", "request_id"],
        properties: {
          error: { type: "string" },
          code: { type: "string" },
          request_id: { type: "string", format: "uuid" },
        },
      },
    },
  },
  security: [{ TenantSession: [] }],
  tags: [
    { name: "Meta", description: "Service metadata and discovery." },
    { name: "Registration", description: "NPHIES Beneficiary registration and lookup." },
    { name: "Coverage", description: "Insurance coverage and coverage classes." },
    { name: "FHIR", description: "FHIR R4 resource projections of clinical entities." },
    { name: "Episodes", description: "Long-running care episodes that group encounters." },
    { name: "Encounters", description: "Per-visit clinical journey objects (FHIR Encounter aligned)." },
    { name: "Diagnoses", description: "Coded diagnoses attached to an encounter." },
    { name: "CareTeam", description: "Practitioners assigned to an encounter." },
    { name: "Vitals", description: "Vitals observations recorded during an encounter." },
    { name: "SupportingInfo", description: "Narrative MDS categories (HPI, exam, plan, history, investigation)." },
  ],
  paths: {
    "/openapi": {
      get: {
        tags: ["Meta"],
        summary: "Clinical OpenAPI document",
        security: [],
        responses: {
          200: {
            description: "OpenAPI 3.1 JSON",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/beneficiaries": {
      get: {
        tags: ["Registration"],
        summary: "List beneficiaries (paginated, tenant-scoped)",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Full-name substring search" },
          { name: "document_id", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          200: {
            description: "List of beneficiaries",
            content: { "application/json": { schema: { type: "object" } } },
          },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Registration"],
        summary: "Create a beneficiary (registrar role)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } },
          400: { description: "Validation failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          409: { description: "Duplicate document_type+document_id", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/beneficiaries/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: {
        tags: ["Registration"],
        summary: "Get a beneficiary by id",
        responses: {
          200: { description: "Beneficiary", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Registration"],
        summary: "Update a beneficiary (registrar role)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          200: { description: "Updated", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/beneficiaries/{id}/coverage": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: {
        tags: ["Coverage"],
        summary: "List a beneficiary's coverages with classes",
        responses: {
          200: { description: "Coverages", content: { "application/json": { schema: { type: "object" } } } },
        },
      },
      post: {
        tags: ["Coverage"],
        summary: "Create coverage (with optional nested classes) for a beneficiary",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Beneficiary not found / cross-tenant", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/coverage/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: {
        tags: ["Coverage"],
        summary: "Get coverage (and its classes) by id",
        responses: {
          200: { description: "Coverage", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Coverage"],
        summary: "Update coverage status / expiry / policy linkage",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          200: { description: "Updated", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/beneficiaries/{id}/fhir": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: {
        tags: ["FHIR"],
        summary: "FHIR R4 projection — Patient + Coverage resources",
        responses: {
          200: { description: "FHIR resources", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/episodes": {
      get: {
        tags: ["Episodes"],
        summary: "List episodes (filter beneficiary_id, status)",
        parameters: [
          { name: "beneficiary_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "finished", "cancelled"] } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } },
      },
      post: {
        tags: ["Episodes"],
        summary: "Create episode (registrar | case_manager)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Beneficiary not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/episodes/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { tags: ["Episodes"], summary: "Get episode", responses: { 200: { description: "Episode", content: { "application/json": { schema: { type: "object" } } } }, 404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } } },
      patch: {
        tags: ["Episodes"],
        summary: "Update episode (case_manager | physician)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Updated", content: { "application/json": { schema: { type: "object" } } } }, 404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } },
      },
    },
    "/encounters": {
      get: {
        tags: ["Encounters"],
        summary: "List encounters (filters beneficiary_id, status, journey_state, class, from, to)",
        parameters: [
          { name: "beneficiary_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["planned", "arrived", "triaged", "in_progress", "on_leave", "finished", "cancelled"] } },
          { name: "journey_state", in: "query", schema: { type: "string" } },
          { name: "class", in: "query", schema: { type: "string", enum: ["AMB", "EMER", "IMP", "HH", "VR"] } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } },
      },
      post: {
        tags: ["Encounters"],
        summary: "Create encounter (registrar | nurse | physician). Auto-generates encounter_number.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Beneficiary / episode / coverage not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/encounters/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { tags: ["Encounters"], summary: "Get encounter (joins care_team + diagnosis_count)", responses: { 200: { description: "Encounter", content: { "application/json": { schema: { type: "object" } } } }, 404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } } },
      patch: {
        tags: ["Encounters"],
        summary: "Update encounter (non-state fields)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Updated", content: { "application/json": { schema: { type: "object" } } } }, 404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } },
      },
    },
    "/encounters/{id}/advance": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      post: {
        tags: ["Encounters"],
        summary: "Advance encounter clinical status (nurse | physician | case_manager)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["to"], properties: { to: { type: "string" }, reason: { type: "string" }, period_end: { type: "string", format: "date-time" } } } } } },
        responses: {
          200: { description: "Advanced", content: { "application/json": { schema: { type: "object" } } } },
          409: { description: "Illegal transition", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/encounters/{id}/diagnoses": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { tags: ["Diagnoses"], summary: "List diagnoses ordered by rank", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Diagnoses"], summary: "Add diagnosis (physician | coder)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/diagnoses/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: { tags: ["Diagnoses"], summary: "Update diagnosis (physician | coder)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Updated", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Diagnoses"], summary: "Remove diagnosis", responses: { 200: { description: "Deleted", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/care-team": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { tags: ["CareTeam"], summary: "List care-team members", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: {
        tags: ["CareTeam"],
        summary: "Add care-team member. practitioner_user_id MUST be a tenant_members row.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          201: { description: "Added", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Practitioner not in tenant", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/care-team/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: { tags: ["CareTeam"], summary: "Update care-team member (end role, change is_primary)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Updated", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["CareTeam"], summary: "Remove care-team member", responses: { 200: { description: "Deleted", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/vitals": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { tags: ["Vitals"], summary: "Vitals timeline for an encounter", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Vitals"], summary: "Record vitals reading (nurse | physician). BMI auto-computed.", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/vitals/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { tags: ["Vitals"], summary: "Get a vitals reading", responses: { 200: { description: "Vitals", content: { "application/json": { schema: { type: "object" } } } } } },
      patch: { tags: ["Vitals"], summary: "Correct a vitals reading", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Updated", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/supporting-info": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { tags: ["SupportingInfo"], summary: "List narrative MDS entries", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["SupportingInfo"], summary: "Add narrative MDS entry (physician | nurse | coder)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/supporting-info/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch: { tags: ["SupportingInfo"], summary: "Update narrative MDS entry", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Updated", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["SupportingInfo"], summary: "Remove narrative MDS entry", responses: { 200: { description: "Deleted", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/fhir": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: {
        tags: ["FHIR"],
        summary: "FHIR R4 projection — Encounter + Condition[] + Observation[] + SupportingInfo",
        responses: {
          200: { description: "FHIR bundle parts", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
} as const;
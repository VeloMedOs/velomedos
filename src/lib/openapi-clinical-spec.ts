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
    { name: "Payers", description: "Phase-3 Master · payers (insurance companies)." },
    { name: "TPAs", description: "Phase-3 Master · third-party administrators." },
    { name: "Policies", description: "Phase-3 Master · insurance policies." },
    { name: "InsuranceClasses", description: "Phase-3 Master · classes under a policy." },
    { name: "InsurancePlans", description: "Phase-3 Master · plans under a class (co-pay, deductible, limits)." },
    { name: "Networks", description: "Phase-3 Master · provider networks + facility memberships." },
    { name: "Services", description: "Phase-3 Master · multi-coded service catalog (SBS / ACHI / LOINC)." },
    { name: "Drugs", description: "Phase-3 Master · drug catalog (GTIN / MRID / SFDA)." },
    { name: "PriceLists", description: "Phase-3 Master · cash and payer-network itemized price lists." },
    { name: "DRGBaseRates", description: "Phase-3 Master · negotiated AR-DRG base rates per payer." },
    { name: "DRGAdjustments", description: "Phase-3 Master · DRG outlier / ICU / same-day / transfer adjustments." },
    { name: "Orders/Lab", description: "Phase-4 · Laboratory orders and items (LOINC)." },
    { name: "Orders/Radiology", description: "Phase-4 · Imaging orders and items (modality / body site)." },
    { name: "Orders/Electrophysiology", description: "Phase-4 · EEG / EMG / NCS / ECG orders." },
    { name: "Orders/Service", description: "Phase-4 · Procedure / service orders (ACHI via Service Master)." },
    { name: "Prescriptions", description: "Phase-4 · Drug prescriptions and dispense events." },
    { name: "Charges", description: "Phase-4 · Per-encounter charge_item ledger and totals." },
    { name: "PricingRules", description: "Phase-4 · Tenant pricing/eligibility/share rules (global defaults read-only)." },
    { name: "Hospitalization", description: "Phase-5 · Admission MDS, Emergency MDS, Discharge MDS (NPHIES Encounter.hospitalization)." },
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
    // =====================================================================
    // Phase 3 — Master Data (insurance chain, services, drugs, price lists, DRG)
    // =====================================================================
    "/masters/payers": {
      get:  { tags: ["Payers"], summary: "List payers", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Payers"], summary: "Create payer (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/payers/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Payers"], summary: "Get payer", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Payers"], summary: "Update payer", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Payers"], summary: "Delete payer", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/tpas": {
      get:  { tags: ["TPAs"], summary: "List TPAs", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["TPAs"], summary: "Create TPA (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/tpas/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["TPAs"], summary: "Get TPA", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["TPAs"], summary: "Update TPA", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["TPAs"], summary: "Delete TPA", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/policies": {
      get:  { tags: ["Policies"], summary: "List policies", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Policies"], summary: "Create policy (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/policies/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Policies"], summary: "Get policy", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Policies"], summary: "Update policy", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Policies"], summary: "Delete policy", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/insurance-classes": {
      get:  { tags: ["InsuranceClasses"], summary: "List insurance classes", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["InsuranceClasses"], summary: "Create insurance class (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/insurance-classes/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["InsuranceClasses"], summary: "Get insurance class", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["InsuranceClasses"], summary: "Update insurance class", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["InsuranceClasses"], summary: "Delete insurance class", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/insurance-plans": {
      get:  { tags: ["InsurancePlans"], summary: "List insurance plans", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["InsurancePlans"], summary: "Create insurance plan (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/insurance-plans/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["InsurancePlans"], summary: "Get insurance plan", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["InsurancePlans"], summary: "Update insurance plan", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["InsurancePlans"], summary: "Delete insurance plan", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/networks": {
      get:  { tags: ["Networks"], summary: "List networks", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Networks"], summary: "Create network (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/networks/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Networks"], summary: "Get network", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Networks"], summary: "Update network", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Networks"], summary: "Delete network", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/networks/{id}/memberships": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Networks"], summary: "List facility memberships in a network", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Networks"], summary: "Add facility (clinics row) to a network", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/network-memberships/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch:  { tags: ["Networks"], summary: "Update membership (toggle in_network)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Networks"], summary: "Remove facility from network", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/services": {
      get:  { tags: ["Services"], summary: "List services (catalog)", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Services"], summary: "Create service (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/services/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Services"], summary: "Get service", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Services"], summary: "Update service", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Services"], summary: "Delete service", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/services/{id}/codes": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Services"], summary: "List code mappings for a service (SBS + ACHI + LOINC)", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Services"], summary: "Add a code mapping (mark one as is_primary_billing)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/service-codes/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch:  { tags: ["Services"], summary: "Update a service code mapping", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Services"], summary: "Remove a service code mapping", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/drugs": {
      get:  { tags: ["Drugs"], summary: "List drugs", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Drugs"], summary: "Create drug (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/drugs/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Drugs"], summary: "Get drug", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Drugs"], summary: "Update drug", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Drugs"], summary: "Delete drug", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/price-lists": {
      get:  { tags: ["PriceLists"], summary: "List price lists (cash + payer_network)", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["PriceLists"], summary: "Create price list (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/price-lists/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["PriceLists"], summary: "Get price list", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["PriceLists"], summary: "Update price list", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["PriceLists"], summary: "Delete price list", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/price-lists/{id}/items": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["PriceLists"], summary: "List price-list items (service xor drug)", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["PriceLists"], summary: "Add price-list item (unit_price_minor in halalas)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/price-list-items/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch:  { tags: ["PriceLists"], summary: "Update price-list item", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["PriceLists"], summary: "Delete price-list item", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/drg-base-rates": {
      get:  { tags: ["DRGBaseRates"], summary: "List negotiated DRG base rates", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["DRGBaseRates"], summary: "Create DRG base rate (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/drg-base-rates/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["DRGBaseRates"], summary: "Get DRG base rate", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["DRGBaseRates"], summary: "Update DRG base rate", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["DRGBaseRates"], summary: "Delete DRG base rate", responses: { 204: { description: "Deleted" } } },
    },
    "/masters/drg-adjustments": {
      get:  { tags: ["DRGAdjustments"], summary: "List DRG price adjustments (outlier / ICU / same-day / transfer)", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["DRGAdjustments"], summary: "Create DRG adjustment (tenant_admin)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/drg-adjustments/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["DRGAdjustments"], summary: "Get DRG adjustment", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["DRGAdjustments"], summary: "Update DRG adjustment", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["DRGAdjustments"], summary: "Delete DRG adjustment", responses: { 204: { description: "Deleted" } } },
    },
    "/encounters/{id}/orders/lab": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Orders/Lab"], summary: "List lab orders for an encounter", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Orders/Lab"], summary: "Create lab order + items (resolver writes charge_item snapshots)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/orders/radiology": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Orders/Radiology"], summary: "List radiology orders", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Orders/Radiology"], summary: "Create radiology order + items", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/orders/electrophysiology": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Orders/Electrophysiology"], summary: "List EP orders", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Orders/Electrophysiology"], summary: "Create EP order + items", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/orders/service": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Orders/Service"], summary: "List service / procedure orders", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Orders/Service"], summary: "Create service order + items", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/prescriptions": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Prescriptions"], summary: "List prescriptions", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Prescriptions"], summary: "Create prescription + items", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/charges": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: { tags: ["Charges"], summary: "Aggregated charge_item ledger + totals (gross/discount/tax/patient/payer/net)", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/orders/lab-items/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Orders/Lab"], summary: "Get lab item", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Orders/Lab"], summary: "Update lab item (results / status)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Orders/Lab"], summary: "Cancel lab item (also cancels charge_item)", responses: { 204: { description: "Cancelled" } } },
    },
    "/orders/radiology-items/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Orders/Radiology"], summary: "Get radiology item", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Orders/Radiology"], summary: "Update radiology item (report / status)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Orders/Radiology"], summary: "Cancel radiology item", responses: { 204: { description: "Cancelled" } } },
    },
    "/orders/ep-items/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Orders/Electrophysiology"], summary: "Get EP item", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Orders/Electrophysiology"], summary: "Update EP item (interpretation / status)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Orders/Electrophysiology"], summary: "Cancel EP item", responses: { 204: { description: "Cancelled" } } },
    },
    "/orders/service-items/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Orders/Service"], summary: "Get service item", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Orders/Service"], summary: "Update service item", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Orders/Service"], summary: "Cancel service item", responses: { 204: { description: "Cancelled" } } },
    },
    "/orders/prescription-items/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Prescriptions"], summary: "Get prescription item", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["Prescriptions"], summary: "Dispense / update prescription item", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["Prescriptions"], summary: "Cancel prescription item", responses: { 204: { description: "Cancelled" } } },
    },
    "/masters/pricing-rules": {
      get:  { tags: ["PricingRules"], summary: "List pricing rules (tenant + global defaults)", responses: { 200: { description: "List", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["PricingRules"], summary: "Create tenant pricing rule", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/masters/pricing-rules/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["PricingRules"], summary: "Get pricing rule", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      patch:  { tags: ["PricingRules"], summary: "Update tenant pricing rule", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      delete: { tags: ["PricingRules"], summary: "Delete tenant pricing rule", responses: { 204: { description: "Deleted" } } },
    },
    "/encounters/{id}/admit": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Hospitalization"], summary: "Get hospitalization (admission MDS)", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Hospitalization"], summary: "Admit IP/HH encounter — upsert hospitalization, advance journey 'admitted'", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Upserted", content: { "application/json": { schema: { type: "object" } } } }, 409: { description: "Encounter class not IMP/HH", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } } },
    },
    "/encounters/{id}/discharge": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      post: { tags: ["Hospitalization"], summary: "Discharge encounter — sets separation_mode, vent hours, cause_of_death (if deceased), derives same_day, advances journey 'discharged'", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["discharged_at", "separation_mode"], properties: { discharged_at: { type: "string", format: "date-time" }, separation_mode: { type: "string" }, mechanical_ventilation_hours: { type: "integer" }, cause_of_death: { type: "string" }, discharge_specialty: { type: "string" }, discharge_disposition: { type: "string" } } } } } }, responses: { 200: { description: "Discharged", content: { "application/json": { schema: { type: "object" } } } } } },
    },
    "/encounters/{id}/emergency": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:  { tags: ["Hospitalization"], summary: "Get emergency MDS", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } } } },
      post: { tags: ["Hospitalization"], summary: "Upsert ER triage + ED disposition (EMER encounter)", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Upserted", content: { "application/json": { schema: { type: "object" } } } }, 409: { description: "Encounter class not EMER", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } } },
    },
  },
} as const;
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
  },
} as const;
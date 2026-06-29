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
  },
} as const;
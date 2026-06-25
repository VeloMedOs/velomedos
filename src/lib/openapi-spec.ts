export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "VeloMed OS Public API",
    version: "1.0.0",
    description:
      "Read-and-write REST API for ambulance fleet, incidents, clinics, courses, and rental bookings. Authenticate with an API key issued from the Developer console using the `x-api-key` header.",
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
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/fleet": {
      get: {
        summary: "List ambulance fleet",
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Ambulance" } } } } },
          "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/fleet/{id}/location": {
      get: {
        summary: "Get the latest known location for an ambulance",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, recorded_at: { type: "string", format: "date-time" } } } } } },
          "404": { description: "No location on file" },
        },
      },
    },
    "/incidents": {
      get: {
        summary: "List recent incidents",
        responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Incident" } } } } } },
      },
      post: {
        summary: "File a new incident",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/IncidentInput" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Incident" } } } } },
      },
    },
    "/incidents/{id}": {
      get: {
        summary: "Get an incident by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Incident" } } } } },
      },
    },
    "/clinics": {
      get: { summary: "List remote clinics", responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Clinic" } } } } } } },
    },
    "/courses": {
      get: { summary: "List training courses", responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Course" } } } } } } },
    },
  },
} as const;
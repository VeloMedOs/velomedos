import { createFileRoute } from "@tanstack/react-router";
import { openApiClinicalSpec } from "@/lib/openapi-clinical-spec";

export const Route = createFileRoute("/api/clinical/v1/openapi")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(openApiClinicalSpec, null, 2), {
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          },
        }),
    },
  },
});
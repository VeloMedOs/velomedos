import { createFileRoute } from "@tanstack/react-router";
import { openApiSpec } from "@/lib/openapi-spec";

export const Route = createFileRoute("/api/public/v1/openapi")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(openApiSpec, null, 2), {
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
        }),
    },
  },
});
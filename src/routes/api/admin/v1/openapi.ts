import { createFileRoute } from "@tanstack/react-router";
import { openApiAdminSpec } from "@/lib/openapi-admin-spec";

export const Route = createFileRoute("/api/admin/v1/openapi")({
  server: {
    handlers: {
      GET: () => new Response(JSON.stringify(openApiAdminSpec, null, 2), {
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      }),
    },
  },
});
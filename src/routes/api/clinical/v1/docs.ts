import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireTenant } from "@/lib/api-clinical";
import { listDocs } from "@/lib/his-docs";

/**
 * GET /api/clinical/v1/docs
 * Returns the manifest of bundled HIS / RCM manuals visible to any tenant member.
 */
export const Route = createFileRoute("/api/clinical/v1/docs")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const guard = await requireTenant(request);
        if (!guard.ok) return guard.res;
        return json({ data: listDocs() }, 200);
      },
    },
  },
});
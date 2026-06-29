import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireTenant, requireClinicalModule } from "@/lib/api-clinical";
import { getDoc } from "@/lib/his-docs";

/**
 * GET  /api/clinical/v1/docs/{slug}   — full manual body (any tenant member).
 * PUT  /api/clinical/v1/docs/{slug}   — overlay edit. Deferred to the DB
 *                                       `his_doc` table; currently 501.
 */
export const Route = createFileRoute("/api/clinical/v1/docs/$slug")({
  server: {
    handlers: {
      OPTIONS: () => preflight(["GET", "PUT"]),
      GET: async ({ request, params }) => {
        const guard = await requireTenant(request);
        if (!guard.ok) return guard.res;
        const doc = getDoc(params.slug);
        if (!doc) return json({ error: "Unknown manual", code: "doc_not_found", request_id: crypto.randomUUID() }, 404);
        return json({ data: doc }, 200);
      },
      PUT: async ({ request }) => {
        const guard = await requireClinicalModule(request, "Documentation", { capId: "docs.write" });
        if (!guard.ok) return guard.res;
        return json({
          error: "Editable docs overlay is not yet wired up. Manuals are bundled with the platform release.",
          code: "doc_overlay_not_implemented",
          request_id: crypto.randomUUID(),
        }, 501);
      },
    },
  },
});
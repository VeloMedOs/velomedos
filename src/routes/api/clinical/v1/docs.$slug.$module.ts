import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireTenant } from "@/lib/api-clinical";
import { getDoc, sliceDocByModule } from "@/lib/his-docs";

/**
 * GET /api/clinical/v1/docs/{slug}/{module}
 *
 * Returns the slice of the manual starting at the `## <module>` heading,
 * ending at the next `##` heading. Module name is matched against either
 * the literal heading text or its slugified form.
 */
export const Route = createFileRoute("/api/clinical/v1/docs/$slug/$module")({
  server: {
    handlers: {
      OPTIONS: () => preflight(["GET"]),
      GET: async ({ request, params }) => {
        const guard = await requireTenant(request);
        if (!guard.ok) return guard.res;
        const doc = getDoc(params.slug);
        if (!doc) return json({ error: "Unknown manual", code: "doc_not_found", request_id: crypto.randomUUID() }, 404);
        const body = sliceDocByModule(doc, params.module);
        if (!body) return json({ error: "Module section not found", code: "doc_module_not_found", request_id: crypto.randomUUID() }, 404);
        return json({ data: { slug: doc.slug, module: params.module, body } }, 200);
      },
    },
  },
});
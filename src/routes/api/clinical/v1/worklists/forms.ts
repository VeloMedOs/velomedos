import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/forms?class=IMP&classification=nurse
 * Reads `public.v_clinical_forms_worklist`. Spec 05 §5A.
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/forms")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.forms.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const cls = url.searchParams.get("class");
      const classification = url.searchParams.get("classification");
      const gate = url.searchParams.get("gate_type");
      const db = serviceClient() as any;
      let q = db.from("v_clinical_forms_worklist").select("*").eq("tenant_id", auth.ctx.tenantId);
      if (cls) q = q.eq("class", cls);
      if (classification) q = q.eq("classification", classification);
      if (gate) q = q.eq("gate_type", gate);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});
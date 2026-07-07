import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/rcm-comms?encounter_id=…&kind=authorization&unread=true
 * Reads `public.v_rcm_comm_thread`. Spec 05 §3.
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/rcm-comms")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.rcm_comm.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const encId = url.searchParams.get("encounter_id");
      const kind = url.searchParams.get("kind");
      const unread = url.searchParams.get("unread");
      const db = serviceClient() as any;
      let q = db.from("v_rcm_comm_thread").select("*").eq("tenant_id", auth.ctx.tenantId);
      if (encId) q = q.eq("encounter_id", encId);
      if (kind) q = q.eq("kind", kind);
      if (unread === "true") q = q.eq("unread", true);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/gate/view?encounter_id=…
 *
 * Encounter-scoped read from `public.v_order_item_gate`. This is the
 * canonical source worklists join to render gate badges — never derive
 * `gate_state` client-side from `charge_item.status`.
 *
 * Returns `{ data: Row[] }` where Row = the view's columns.
 */
export const Route = createFileRoute("/api/clinical/v1/gate/view")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "gate.preview" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const encounterId = url.searchParams.get("encounter_id");
      if (!encounterId) return envelope("encounter_id required", "bad_request", 400);

      const db = serviceClient() as any;
      // Verify encounter ownership before exposing gate rows.
      const { data: enc } = await db.from("encounter")
        .select("id, tenant_id").eq("id", encounterId).maybeSingle();
      if (!enc || enc.tenant_id !== auth.ctx.tenantId) {
        return envelope("encounter not found", "not_found", 404);
      }

      const { data, error } = await db
        .from("v_order_item_gate")
        .select("order_item_table, order_item_id, charge_item_id, encounter_id, pricing_mode, net_minor, gate_state, exception_id, reason_code")
        .eq("tenant_id", auth.ctx.tenantId)
        .eq("encounter_id", encounterId);
      if (error) return envelope("database_error", "db_error", 500);

      return jsonData({ data: data ?? [] });
    },
  } },
});
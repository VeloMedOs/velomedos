/**
 * GET /api/clinical/v1/gate/forms-preview?encounter_id=…&order_item_table=…
 *
 * Pre-flight equivalent of the SQL BEFORE INSERT trigger. Returns
 *   { open: boolean, missing: Array<{ form_def_id, code, title }> }
 * so the client / order factory can render a friendly 403 forms_gate before
 * hitting the DB.
 *
 * Cap: gate.forms.preview.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function previewFormsGate(
  db: any,
  tenantId: string,
  encounterId: string,
  orderItemTable?: string | null,
): Promise<{ open: boolean; missing: Array<{ form_def_id: string; code: string; title: string }> }> {
  const { data: enc } = await db.from("encounter")
    .select("id, class").eq("id", encounterId).eq("tenant_id", tenantId).maybeSingle();
  if (!enc) return { open: true, missing: [] };

  // Load active mandatory pre-order bindings scoped to this encounter class
  // and, when applicable, the order-item table.
  let q = db.from("form_workflow_binding")
    .select("form_def_id, encounter_class, order_item_table")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("mandatory", true)
    .eq("trigger", "pre");
  const { data: bindings } = await q;
  const applicable = (bindings ?? []).filter((b: any) => {
    if (b.encounter_class && b.encounter_class !== enc.class) return false;
    if (orderItemTable && b.order_item_table && b.order_item_table !== orderItemTable) return false;
    return true;
  });
  if (applicable.length === 0) return { open: true, missing: [] };

  const defIds: string[] = Array.from(new Set(applicable.map((b: any) => b.form_def_id as string)));
  const [{ data: defs }, { data: instances }] = await Promise.all([
    db.from("form_def").select("id, code, title").in("id", defIds),
    db.from("clinical_form_instance").select("form_def_id, status, order_item_table, order_item_id")
      .eq("tenant_id", tenantId)
      .eq("encounter_id", encounterId)
      .in("form_def_id", defIds),
  ]);
  const submitted = new Set<string>();
  for (const row of instances ?? []) {
    if (row.status === "submitted" || row.status === "cosigned") submitted.add(row.form_def_id as string);
  }
  const missing: Array<{ form_def_id: string; code: string; title: string }> = [];
  const defMap = new Map<string, any>();
  for (const d of defs ?? []) defMap.set(d.id, d);
  for (const id of defIds) {
    if (!submitted.has(id)) {
      const d = defMap.get(id);
      missing.push({ form_def_id: id as string, code: (d?.code as string) ?? "", title: (d?.title as string) ?? "" });
    }
  }
  return { open: missing.length === 0, missing };
}

export const Route = createFileRoute("/api/clinical/v1/gate/forms-preview")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "gate.forms.preview" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const encId = url.searchParams.get("encounter_id");
      const orderItemTable = url.searchParams.get("order_item_table");
      if (!encId) return envelope("encounter_id required", "bad_request", 400);
      const db = serviceClient();
      const result = await previewFormsGate(db, auth.ctx.tenantId, encId, orderItemTable);
      return jsonData({ data: result });
    },
  } },
});
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import { DENIAL_BUCKET_ORDER } from "@/lib/rcm/denial-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/denials")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status") ?? "";
      const category = url.searchParams.get("category") ?? "";
      const q = url.searchParams.get("q") ?? "";
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const db = serviceClient() as any;
      let sel = db.from("denial_case").select("*").eq("tenant_id", auth.ctx.tenantId)
        .order("updated_at", { ascending: false }).limit(limit);
      if (status) sel = sel.eq("status", status);
      if (category) sel = sel.eq("denial_category", category);
      if (q) sel = sel.or(`claim_sequence_no.ilike.%${q}%`);
      const { data, error } = await sel;
      if (error) return envelope("database_error", "db_error", 500);
      const { data: all } = await db.from("denial_case").select("status").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = Object.fromEntries(DENIAL_BUCKET_ORDER.map((s) => [s, 0]));
      for (const r of (all ?? []) as Array<{ status: string }>) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return jsonData({ data: data ?? [], counts, pagination: { total: (data ?? []).length, limit, offset: 0 } });
    },
  } },
});
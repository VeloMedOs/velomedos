import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import { bucketOfAdmission, IP_BUCKET_ORDER, type AdmissionBucket } from "@/lib/rcm/ip-accounting-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * IP admissions worklist: returns rows augmented with `bucket` + per-bucket
 * counts. `?bucket=` restricts result rows; counts are always all-buckets so
 * the pane tiles never lie.
 */
export const Route = createFileRoute("/api/clinical/v1/ip/worklists")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const bucket = url.searchParams.get("bucket") as AdmissionBucket | null;
      const q      = url.searchParams.get("q");
      const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const db = serviceClient() as any;
      let sel: any = db.from("admission_request")
        .select("*")
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (q) sel = sel.or(`admission_no.ilike.%${q}%,admission_serial.ilike.%${q}%`);
      const { data, error } = await sel;
      if (error) return envelope("database_error", "db_error", 500);
      const rows = (data ?? []).map((r: any) => ({ ...r, bucket: bucketOfAdmission(r) }));
      const counts: Record<string, number> = Object.fromEntries(IP_BUCKET_ORDER.map((b) => [b, 0]));
      for (const r of rows) counts[r.bucket] = (counts[r.bucket] ?? 0) + 1;
      const filtered = bucket ? rows.filter((r: any) => r.bucket === bucket) : rows;
      return jsonData({ data: filtered, counts, pagination: { total: rows.length, limit, offset: 0 } });
    },
  } },
});
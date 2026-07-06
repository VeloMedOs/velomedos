import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R5 · E-Claims worklist.
 * Buckets claims by `readiness_status` + `batch_id` presence + `status`.
 * Buckets: needs_correction · hold · ready · in_batch · submitted · rejected.
 */
export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/e-claims")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const bucket = url.searchParams.get("bucket") ?? "";
      const q = url.searchParams.get("q") ?? "";
      const payerId = url.searchParams.get("payer_id") ?? "";
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const db = serviceClient() as any;

      let sel = db.from("claim")
        .select("id, encounter_id, coverage_id, claim_sequence_no, batch_id, readiness_status, snapshot_locked_at, provider_claim_no, invoice_no, status, billing_model, total_net_minor, total_patient_share_minor, total_payer_share_minor, currency, submitted_at, updated_at, adjudication_outcome")
        .eq("tenant_id", auth.ctx.tenantId)
        .order("updated_at", { ascending: false });
      if (q) sel = sel.or(`provider_claim_no.ilike.%${q}%,invoice_no.ilike.%${q}%,claim_sequence_no.ilike.%${q}%`);

      const { data, error } = await sel.limit(1000);
      if (error) return envelope("database_error", "db_error", 500);

      const encIds = Array.from(new Set((data ?? []).map((r: any) => r.encounter_id).filter(Boolean)));
      const [encs, covs] = encIds.length
        ? await Promise.all([
            db.from("encounter").select("id, encounter_number, class, journey_state").in("id", encIds).eq("tenant_id", auth.ctx.tenantId),
            db.from("coverage").select("id, payer_id").in("id", Array.from(new Set((data ?? []).map((r: any) => r.coverage_id).filter(Boolean)))),
          ])
        : [{ data: [] }, { data: [] }];
      const encMap = new Map<string, any>(((encs.data ?? []) as any[]).map((e) => [e.id, e]));
      const covMap = new Map<string, any>(((covs.data ?? []) as any[]).map((c) => [c.id, c]));

      const withBucket = (r: any) => {
        const b = r.readiness_status === "needs_correction" ? "needs_correction"
                : r.readiness_status === "hold" ? "hold"
                : r.batch_id ? "in_batch"
                : ["submitted","accepted"].includes(r.status) ? "submitted"
                : ["rejected","resubmit_required","denied"].includes(r.status) ? "rejected"
                : r.readiness_status === "ready" || ["ready","priced"].includes(r.status) ? "ready"
                : "draft";
        const cov = r.coverage_id ? covMap.get(r.coverage_id) : null;
        return {
          ...r,
          bucket: b,
          encounter: encMap.get(r.encounter_id) ?? null,
          coverage: cov,
        };
      };
      let rows = (data ?? []).map(withBucket);
      if (payerId) rows = rows.filter((r: any) => r.coverage?.payer_id === payerId);

      const counts: Record<string, number> = {
        draft: 0, needs_correction: 0, hold: 0, ready: 0, in_batch: 0, submitted: 0, rejected: 0,
      };
      for (const r of rows) counts[r.bucket] = (counts[r.bucket] ?? 0) + 1;

      const filtered = bucket ? rows.filter((r: any) => r.bucket === bucket) : rows;
      const page = filtered.slice(0, limit);
      return jsonData({ data: page, counts, pagination: { total: filtered.length, limit, offset: 0 } });
    },
  } },
});
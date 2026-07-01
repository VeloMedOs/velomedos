import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { jsonData } from "../_helpers";
import { bucketOfClaim, ALL_CLAIM_STATUSES, type ClaimBucket } from "@/lib/rcm/claim-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/clinical/v1/claims/worklist
 *
 * Query: ?bucket=&status=&payer_id=&class=&limit=&offset=&q=
 * Returns bucketed counts + a page of rows joined with encounter + visit_eligibility.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/worklist")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const url = new URL(request.url);
      const bucket = (url.searchParams.get("bucket") ?? "") as ClaimBucket | "";
      const statusParam = url.searchParams.get("status") ?? "";
      const q = url.searchParams.get("q") ?? "";
      const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
      const offset = Number(url.searchParams.get("offset") ?? "0");

      // Bucket counts across all statuses (single scan)
      const { data: statusRows } = await db.from("claim")
        .select("status")
        .eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<ClaimBucket, number> = {
        draft: 0, scrub_failed: 0, ready: 0, auth_hold: 0, coding_hold: 0,
        submitted: 0, rejected: 0, adjudicated: 0, closed: 0,
      };
      let total = 0;
      for (const r of (statusRows ?? []) as Array<{ status: string }>) {
        total++;
        counts[bucketOfClaim(r.status)]++;
      }

      // Rows
      let query = db.from("claim")
        .select("id, encounter_id, coverage_id, provider_claim_no, invoice_no, claim_type, claim_subtype, billing_model, status, total_net_minor, total_patient_share_minor, total_payer_share_minor, currency, submitted_at, adjudicated_at, adjudication_outcome, updated_at, created_at, locked_by, locked_at", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId);

      if (statusParam) {
        query = query.eq("status", statusParam);
      } else if (bucket) {
        const bucketStatuses = ALL_CLAIM_STATUSES.filter((s) => bucketOfClaim(s) === bucket);
        if (bucketStatuses.length > 0) query = query.in("status", bucketStatuses);
      }
      if (q) query = query.or(`provider_claim_no.ilike.%${q}%,invoice_no.ilike.%${q}%`);
      query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);

      const { data: rows, count } = await query;

      // Enrich with encounter + visit_eligibility for the current page
      const encIds = Array.from(new Set((rows ?? []).map((r: any) => r.encounter_id).filter(Boolean)));
      const [encsRes, vesRes] = encIds.length ? await Promise.all([
        db.from("encounter").select("id, encounter_number, class, journey_state, patient_id, coverage_id")
          .in("id", encIds).eq("tenant_id", auth.ctx.tenantId),
        db.from("visit_eligibility").select("id, encounter_id, status")
          .in("encounter_id", encIds).eq("tenant_id", auth.ctx.tenantId),
      ]) : [{ data: [] }, { data: [] }];

      const encMap = new Map<string, any>(((encsRes.data ?? []) as any[]).map((e) => [e.id, e]));
      const veMap = new Map<string, any>(((vesRes.data ?? []) as any[]).map((v) => [v.encounter_id, v]));

      const enriched = (rows ?? []).map((r: any) => ({
        ...r,
        bucket: bucketOfClaim(r.status),
        encounter: encMap.get(r.encounter_id) ?? null,
        visit_eligibility: veMap.get(r.encounter_id) ?? null,
      }));

      const etag = `"cw-${total}-${count ?? 0}-${enriched[0]?.updated_at ?? ""}"`;
      const ifNoneMatch = request.headers.get("if-none-match");
      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers: { etag } });
      }
      return new Response(JSON.stringify({
        data: enriched,
        counts,
        total,
        pagination: { total: count ?? enriched.length, limit, offset },
      }), { status: 200, headers: { "content-type": "application/json", etag } });
    },
  } },
});
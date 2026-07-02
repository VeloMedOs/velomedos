import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { requiredMethodFields, bucketOfCashCollection, type CashMethod } from "@/lib/rcm/cash-collection-sm";
import { computeInvoice } from "@/lib/rcm/vat-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R7 · Cash collections — list + create draft.
 *
 * Create draft only. Posting (with method-detail gates, session
 * eligibility, wallet/deposit consumption, VAT allocation, ZATCA queueing,
 * ERP posting) is handled by `cash.collections.$id.post.ts`.
 */
const CreateBody = z.object({
  encounter_id:     z.string().uuid().nullable().optional(),
  claim_id:         z.string().uuid().nullable().optional(),
  beneficiary_id:   z.string().uuid(),
  method:           z.enum(["cash","pos","bank_transfer","cheque","online"]),
  details:          z.record(z.string(), z.any()).optional(),
  lines:            z.array(z.object({
    description:  z.string(),
    qty:          z.number().default(1),
    unit_price_minor: z.number().int().min(0),
    discount_minor: z.number().int().min(0).default(0),
    vat_rate:     z.union([z.literal(0), z.literal(15)]).default(15),
    reporting_code: z.string().optional(),
  })).min(1),
  deposit_ids:      z.array(z.string().uuid()).default([]),
  credit_note_ids:  z.array(z.string().uuid()).default([]),
  wallet_apply_minor: z.number().int().min(0).default(0),
  session_id:       z.string().uuid().nullable().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/cash/collections")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status  = url.searchParams.get("status");
      const method  = url.searchParams.get("method");
      const bucket  = url.searchParams.get("bucket");
      const sessionId = url.searchParams.get("session_id");
      const encId   = url.searchParams.get("encounter_id");
      const claimId = url.searchParams.get("claim_id");
      const q       = url.searchParams.get("q");
      const limit   = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset  = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const db = serviceClient() as any;
      let sel: any = db.from("cash_collection")
        .select("*, beneficiary:beneficiary_id(id, full_name, mrn), encounter:encounter_id(id, encounter_number)", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status)    sel = sel.eq("status", status);
      if (method)    sel = sel.eq("method", method);
      if (sessionId) sel = sel.eq("session_id", sessionId);
      if (encId)     sel = sel.eq("encounter_id", encId);
      if (claimId)   sel = sel.eq("claim_id", claimId);
      if (q)         sel = sel.or(`receipt_no.ilike.%${q}%,pos_ref.ilike.%${q}%,bank_ref.ilike.%${q}%,cheque_no.ilike.%${q}%,online_ref.ilike.%${q}%`);
      const { data, count, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      const rows = (data ?? []).map((r: any) => ({ ...r, bucket: bucketOfCashCollection(r) }));
      const filtered = bucket ? rows.filter((r: any) => r.bucket === bucket) : rows;
      // Bucket counts (aggregate scan)
      const { data: agg } = await db.from("cash_collection")
        .select("status, session_id, outstanding_after_minor, posted_at").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = {};
      for (const r of (agg ?? []) as any[]) {
        const b = bucketOfCashCollection(r as any);
        counts[b] = (counts[b] ?? 0) + 1;
      }
      return jsonData({ data: filtered, counts, pagination: { total: count ?? filtered.length, limit, offset } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.collect" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => CreateBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const b = parsed.data;
      // Method-detail gate (server-side; posts also re-check)
      const req = requiredMethodFields(b.method as CashMethod);
      const missing = req.filter((k) => !(b.details ?? {})[k]);
      if (missing.length) {
        return envelope(`Missing method details: ${missing.join(", ")}`, "METHOD_DETAIL_MISSING", 400, { missing });
      }
      const rollup = computeInvoice(b.lines);
      const gross = rollup.total_minor;
      const applied = (b.wallet_apply_minor ?? 0); // deposit/CN apply during POST for atomicity
      const net = Math.max(0, gross - applied);
      const db = serviceClient() as any;
      const { data, error } = await db.from("cash_collection").insert({
        tenant_id: auth.ctx.tenantId,
        cashier_id: auth.ctx.userId,
        session_id: b.session_id ?? null,
        beneficiary_id: b.beneficiary_id,
        encounter_id: b.encounter_id ?? null,
        claim_id: b.claim_id ?? null,
        method: b.method,
        gross_minor: gross,
        wallet_applied_minor: b.wallet_apply_minor ?? 0,
        net_collected_minor: net,
        outstanding_after_minor: 0,
        pos_ref: b.details?.pos_ref ?? null,
        bank_ref: b.details?.bank_ref ?? null,
        bank_ref_attachment_url: b.details?.bank_ref_attachment_url ?? null,
        cheque_no: b.details?.cheque_no ?? null,
        cheque_date: b.details?.cheque_date ?? null,
        online_ref: b.details?.online_ref ?? null,
        status: "draft",
        notes: b.details?.note ?? null,
        created_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "cash.collection.draft", "cash_collection", data.id, { gross_minor: gross, method: b.method });
      return jsonData({ data: { ...data, bucket: bucketOfCashCollection(data) } }, 201);
    },
  } },
});
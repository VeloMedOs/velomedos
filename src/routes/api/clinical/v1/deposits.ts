import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, assertMasterOwnership } from "../_helpers";
import { bucketOfDeposit } from "@/lib/rcm/deposit-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Deposit worklist + collect. Bucketed by {@link bucketOfDeposit}. */
const Create = z.object({
  beneficiary_id: z.string().uuid(),
  encounter_id: z.string().uuid().nullable().optional(),
  admission_request_id: z.string().uuid().nullable().optional(),
  deposit_type: z.enum(["general","encounter","department","billing_group","order_item","caution"]).default("general"),
  scope_ref_id: z.string().uuid().nullable().optional(),
  amount_minor: z.number().int().min(0),
  currency: z.string().default("SAR"),
  method: z.enum(["cash","card","bank_transfer","wallet","insurance"]).default("cash"),
  is_caution: z.boolean().default(false),
  pos_reference: z.string().nullable().optional(),
  reference_no: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["collected","held","requested"]).default("collected"),
});

export const Route = createFileRoute("/api/clinical/v1/deposits")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const type   = url.searchParams.get("type");
      const bucket = url.searchParams.get("bucket");
      const caution = url.searchParams.get("caution");
      const bId  = url.searchParams.get("beneficiary_id");
      const eId  = url.searchParams.get("encounter_id");
      const q    = url.searchParams.get("q");
      const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      let sel: any = (serviceClient() as any).from("deposit")
        .select("*, beneficiary:beneficiary_id(id, full_name, mrn), encounter:encounter_id(id, encounter_number, class, journey_state)", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (status)  sel = sel.eq("status", status);
      if (type)    sel = sel.eq("deposit_type", type);
      if (caution === "true")  sel = sel.eq("is_caution", true);
      if (caution === "false") sel = sel.eq("is_caution", false);
      if (bId) sel = sel.eq("beneficiary_id", bId);
      if (eId) sel = sel.eq("encounter_id", eId);
      if (q)   sel = sel.or(`deposit_no.ilike.%${q}%,reference_no.ilike.%${q}%,pos_reference.ilike.%${q}%`);
      const { data, count, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      const rows = (data ?? []).map((r: any) => ({ ...r, bucket: bucketOfDeposit(r) }));
      const filtered = bucket ? rows.filter((r: any) => r.bucket === bucket) : rows;
      // Bucket counts across the full tenant (small aggregate, not the paged slice).
      const { data: all } = await (serviceClient() as any).from("deposit")
        .select("status, is_caution, available_minor, amount_minor").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = {};
      for (const r of (all ?? []) as any[]) {
        const b = bucketOfDeposit(r);
        counts[b] = (counts[b] ?? 0) + 1;
      }
      return jsonData({ data: filtered, counts, pagination: { total: count ?? 0, limit, offset } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "dep.collect" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Create.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const err1 = await assertMasterOwnership("beneficiary", parsed.data.beneficiary_id, auth.ctx.tenantId);
      if (err1) return err1;
      if (parsed.data.encounter_id) {
        const err2 = await assertMasterOwnership("encounter", parsed.data.encounter_id, auth.ctx.tenantId);
        if (err2) return err2;
      }
      const db = serviceClient() as any;
      const row = {
        tenant_id: auth.ctx.tenantId,
        beneficiary_id: parsed.data.beneficiary_id,
        encounter_id: parsed.data.encounter_id ?? null,
        admission_request_id: parsed.data.admission_request_id ?? null,
        deposit_type: parsed.data.deposit_type,
        scope_ref_id: parsed.data.scope_ref_id ?? null,
        amount_minor: parsed.data.amount_minor,
        requested_minor: parsed.data.amount_minor,
        currency: parsed.data.currency,
        method: parsed.data.method,
        is_caution: parsed.data.is_caution || parsed.data.deposit_type === "caution",
        pos_reference: parsed.data.pos_reference ?? null,
        reference_no: parsed.data.reference_no ?? null,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status,
        collected_by: parsed.data.status === "collected" ? auth.ctx.userId : null,
        received_by:  parsed.data.status === "collected" ? auth.ctx.userId : null,
        received_at:  parsed.data.status === "collected" ? new Date().toISOString() : null,
        created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
      };
      const { data: dep, error } = await db.from("deposit").insert(row).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      // If already collected, write a `collect` txn (drives ERP queue + running balance).
      if (dep.status === "collected") {
        await db.from("deposit_transaction").insert({
          tenant_id: auth.ctx.tenantId, deposit_id: dep.id, txn_type: "collect",
          amount_minor: dep.amount_minor, method: dep.method,
          receipt_no: dep.reference_no ?? dep.pos_reference ?? null,
          created_by: auth.ctx.userId,
        });
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "deposit.collect", "deposit", dep.id);
      return jsonData({ data: dep }, 201);
    },
  } },
});
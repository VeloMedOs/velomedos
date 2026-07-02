import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R7 · Cash sessions (drawer shifts) — list + open.
 *
 *  - Bucketed by status: open / closing / closed / reconciled / over_short.
 *  - Only one `open` session per (tenant, cashier) is allowed at a time.
 */
const OpenBody = z.object({
  drawer_id:            z.string().optional(),
  opening_float_minor:  z.number().int().min(0).default(0),
  note:                 z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/cash/sessions")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const openedBy = url.searchParams.get("opened_by");
      const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const db = serviceClient() as any;
      let sel: any = db.from("cash_session")
        .select("*", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("opened_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status)   sel = sel.eq("status", status);
      if (openedBy) sel = sel.eq("cashier_id", openedBy);
      const { data, count, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      // Bucket counts for the header chips
      const { data: agg } = await db.from("cash_session")
        .select("status").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = {};
      for (const r of (agg ?? []) as any[]) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return jsonData({ data, counts, pagination: { total: count ?? 0, limit, offset } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.session.open" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => OpenBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      // Enforce single-open per cashier
      const { data: prior } = await db.from("cash_session")
        .select("id").eq("tenant_id", auth.ctx.tenantId)
        .eq("cashier_id", auth.ctx.userId).eq("status", "open").maybeSingle();
      if (prior) return envelope("A session is already open for this cashier", "session_already_open", 409, { session_id: prior.id });
      const { data, error } = await db.from("cash_session").insert({
        tenant_id: auth.ctx.tenantId,
        cashier_id: auth.ctx.userId,
        opening_float_minor: parsed.data.opening_float_minor,
        notes: parsed.data.note ?? null,
        session_no: `CS-${Date.now().toString(36).toUpperCase()}`,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "cash.session.open", "cash_session", data.id, { opening_float_minor: parsed.data.opening_float_minor });
      return jsonData({ data }, 201);
    },
  } },
});
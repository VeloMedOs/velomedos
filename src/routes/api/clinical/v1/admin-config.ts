import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PatchSchema = z.object({
  entries: z.array(z.object({
    key: z.string().min(1).max(120),
    value: z.unknown(),
  })).min(1).max(50),
});
const parsePatch = parseBody((raw) => PatchSchema.parse(raw));

/**
 * GET  /api/clinical/v1/admin-config       — effective config rows
 * PATCH /api/clinical/v1/admin-config      — upsert entries (cap: admin.config.write)
 */
export const Route = createFileRoute("/api/clinical/v1/admin-config")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("rcm_admin_config")
        .select("*").eq("tenant_id", auth.ctx.tenantId).order("key");
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
    PATCH: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "admin.config.write" });
      if (!auth.ok) return auth.res;
      const parsed = await parsePatch(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const rows = parsed.data.entries.map((e) => ({
        tenant_id: auth.ctx.tenantId,
        key: e.key,
        value: e.value,
        updated_by: auth.ctx.userId,
      }));
      const { data, error } = await db.from("rcm_admin_config")
        .upsert(rows, { onConflict: "tenant_id,key" })
        .select("*");
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "admin.config.write", "rcm_admin_config", undefined, parsed.data);
      return jsonData({ data });
    },
  } },
});
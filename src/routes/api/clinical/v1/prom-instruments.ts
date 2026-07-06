import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { z } from "zod";

const Create = z.object({
  key: z.string().min(2).max(64),
  name: z.string().min(1).max(200),
  kind: z.enum(["generic", "disease_specific", "experience"]),
  condition: z.enum(["cataract", "obesity", "diabetes", "pregnancy", "other"]).nullable().optional(),
  version: z.string().default("1.0"),
  active: z.boolean().default(true),
  schema: z.record(z.string(), z.unknown()),
  description: z.string().optional(),
});
const parseCreate = parseBody((raw) => Create.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/prom-instruments")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const kind = url.searchParams.get("kind");
        const condition = url.searchParams.get("condition");
        const db = serviceClient();
        let q = db.from("prom_instrument").select("*")
          .or(`tenant_id.is.null,tenant_id.eq.${auth.ctx.tenantId}`)
          .eq("active", true)
          .order("kind", { ascending: true })
          .order("name", { ascending: true });
        if (kind) q = q.eq("kind", kind);
        if (condition) q = q.eq("condition", condition);
        const { data, error } = await q;
        if (error) return envelope("database_error", "db_error", 500);
        return jsonData({ data: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await requireClinicalRole(request, ["tenant_admin"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        const insertRow = {
          ...parsed.data,
          tenant_id: auth.ctx.tenantId,
          schema: parsed.data.schema as unknown,
        } as never;
        const { data, error } = await db.from("prom_instrument").insert(insertRow).select("*").single();
        if (error) return envelope("database_error", "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "prom_instrument.create", "prom_instrument", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});
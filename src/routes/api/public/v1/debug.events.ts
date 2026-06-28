import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

const eventSchema = z.object({
  tenant_id: z.string().uuid().optional().nullable(),
  source: z.enum(["overlay", "console", "playwright", "api", "manual"]),
  kind: z.enum(["glitch", "snapshot", "metric", "error", "info"]),
  severity: z.enum(["info", "warn", "error", "critical"]).default("info"),
  route: z.string().max(500).optional().nullable(),
  viewport: z.string().max(40).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const Route = createFileRoute("/api/public/v1/debug/events")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = await requireKey(request, "debug:write");
        if (!auth.ok) return auth.res;
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
        const list = Array.isArray(body) ? body : [body];
        const parsed = list.map((b) => eventSchema.safeParse(b));
        const bad = parsed.findIndex((p) => !p.success);
        if (bad >= 0) return json({ error: "invalid_input", index: bad, issues: (parsed[bad] as any).error.flatten() }, 400);
        const rows = parsed.map((p) => {
          const d = (p as any).data;
          // API-key callers cannot write to a different tenant
          const tenant_id = auth.via === "key" ? (auth.tenantId ?? null) : (d.tenant_id ?? null);
          return { ...d, tenant_id, created_by: null };
        });
        const db = serviceClient();
        const { data, error } = await db.from("debug_events").insert(rows).select("id, created_at");
        if (error) { console.error("debug.insert", error); return json({ error: "insert_failed" }, 500); }
        return json({ ok: true, inserted: data?.length ?? 0, ids: data?.map((r) => r.id) ?? [] });
      },
      GET: async ({ request }) => {
        const auth = await requireKey(request, "debug:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const requestedTenant = url.searchParams.get("tenant_id");
        const kind = url.searchParams.get("kind");
        const severity = url.searchParams.get("severity");
        const viewport = url.searchParams.get("viewport");
        const since = url.searchParams.get("since");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
        const db = serviceClient();
        let q = db.from("debug_events").select("*").order("created_at", { ascending: false }).limit(limit);
        if (auth.via === "key") {
          if (!auth.tenantId) return json({ error: "tenant_scope_required" }, 403);
          if (requestedTenant && requestedTenant !== auth.tenantId) return json({ error: "forbidden_cross_tenant" }, 403);
          q = q.eq("tenant_id", auth.tenantId);
        } else if (requestedTenant) {
          q = q.eq("tenant_id", requestedTenant);
        }
        if (kind) q = q.eq("kind", kind);
        if (severity) q = q.eq("severity", severity);
        if (viewport) q = q.eq("viewport", viewport);
        if (since) q = q.gte("created_at", since);
        const { data, error } = await q;
        if (error) { console.error("debug.query", error); return json({ error: "query_failed" }, 500); }
        return json({ events: data ?? [] });
      },
    },
  },
});
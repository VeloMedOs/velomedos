/**
 * AR-DRG v9.0 reference loader — platform-level (not tenant-scoped).
 *
 * Reads: any authenticated tenant user via `/api/clinical/v1` (RLS allows
 * SELECT to authenticated). This admin endpoint exists for the platform to
 * load/refresh DRG rows from CHI-provided files. Writes are gated by
 * superadmin / portal-staff via requireAdmin.
 */
import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";
import { DrgCreate } from "@/lib/mds/schema/masters";

export const Route = createFileRoute("/api/admin/v1/drgs")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "clinical:reference:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const version = url.searchParams.get("version");
        const mdc = url.searchParams.get("mdc");
        const active = url.searchParams.get("active");
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        let q = adminDb().from("drg").select("*", { count: "exact" })
          .order("drg_code", { ascending: true })
          .range(offset, offset + limit - 1);
        if (version) q = q.eq("version", version);
        if (mdc) q = q.eq("mdc", mdc);
        if (active !== null) q = q.eq("active", active === "true");
        const { data, count, error } = await q;
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "clinical:reference:write");
        if (!auth.ok) return auth.res;
        const raw = await request.json().catch(() => null);
        const parsed = DrgCreate.safeParse(raw);
        if (!parsed.success) {
          return json({
            error: "validation_failed", code: "validation",
            request_id: crypto.randomUUID(),
            issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          }, 400);
        }
        const { data, error } = await adminDb().from("drg").insert(parsed.data).select("*").single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "drg.create", "drg", data.id, { drg_code: data.drg_code, version: data.version });
        return json(data, 201);
      },
    },
  },
});
import { createFileRoute } from "@tanstack/react-router";
import { preflight, serviceClient } from "@/lib/api-server";
import { envelope, jsonData } from "@/routes/api/clinical/v1/_helpers";

/**
 * GET /api/patient/v1/proms/pending — pending PROM surveys for the bearer's beneficiary record(s).
 */
export const Route = createFileRoute("/api/patient/v1/proms/pending")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
        if (!bearer) return envelope("Missing bearer", "auth_missing", 401);
        const db = serviceClient();
        const { data: u } = await db.auth.getUser(bearer);
        if (!u?.user) return envelope("Invalid bearer", "auth_invalid", 401);
        const { data: bens } = await db.from("beneficiary").select("id").eq("patient_user_id", u.user.id);
        const ids = (bens ?? []).map((b: { id: string }) => b.id);
        if (!ids.length) return jsonData({ data: [] });
        const { data: items, error } = await db.from("prom_assignment")
          .select("id, trigger, due_at, status, channel, prom_instrument(key, name, version, schema)")
          .in("beneficiary_id", ids)
          .eq("status", "pending")
          .order("due_at", { ascending: true })
          .limit(50);
        if (error) return envelope("database_error", "db_error", 500);
        return jsonData({ data: items ?? [] });
      },
    },
  },
});
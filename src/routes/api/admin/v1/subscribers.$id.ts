import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/subscribers/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireAdmin(request, "subscribers:read");
        if (!auth.ok) return auth.res;
        const db = adminDb();
        const id = params.id;
        const [acct, subs, pays, bugs, usage, ticks] = await Promise.all([
          db.from("corporate_accounts").select("*").eq("id", id).maybeSingle(),
          db.from("portal_subscriptions").select("*").eq("subscriber_id", id),
          db.from("portal_payments").select("*").eq("subscriber_id", id).order("created_at", { ascending: false }).limit(20),
          db.from("portal_bugs").select("*").eq("subscriber_id", id).order("last_seen_at", { ascending: false }).limit(20),
          db.from("portal_usage_daily").select("*").eq("subscriber_id", id).order("day", { ascending: false }).limit(60),
          db.from("portal_tickets").select("*").eq("subscriber_id", id).order("created_at", { ascending: false }).limit(20),
        ]);
        if (!acct.data) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        return json({ subscriber: acct.data, subscriptions: subs.data ?? [], payments: pays.data ?? [], bugs: bugs.data ?? [], usage: usage.data ?? [], tickets: ticks.data ?? [] });
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { action?: "suspend" | "resume" | "cancel" | "activate"; status?: string } | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const status = body.status ?? ({ suspend: "suspended", resume: "active", cancel: "churned", activate: "active" } as Record<string, string>)[body.action ?? ""];
        if (!status) return json({ error: "missing_action_or_status", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const { data, error } = await db.from("corporate_accounts").update({ status }).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, `subscriber.${body.action ?? "status"}`, "corporate_accounts", params.id, { status });
        return json(data);
      },
    },
  },
});
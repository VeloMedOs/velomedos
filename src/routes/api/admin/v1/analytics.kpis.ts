import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/analytics/kpis")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "analytics:read"); if (!auth.ok) return auth.res;
        const db = adminDb();
        const [accts, subs] = await Promise.all([
          db.from("corporate_accounts").select("id, status, created_at"),
          db.from("portal_subscriptions").select("status, price_cents, currency, cycle"),
        ]);
        const a = (accts.data ?? []) as Array<{ status: string; created_at: string }>;
        const s = (subs.data ?? []) as Array<{ status: string; price_cents: number; cycle: string }>;
        const counters = {
          total: a.length,
          active: a.filter((x) => x.status === "active").length,
          trialing: a.filter((x) => x.status === "trialing").length,
          past_due: a.filter((x) => x.status === "past_due").length,
          suspended: a.filter((x) => x.status === "suspended").length,
          churned: a.filter((x) => x.status === "churned").length,
          engaged_30d: a.filter((x) => new Date(x.created_at) > new Date(Date.now() - 30 * 86400 * 1000)).length,
        };
        const mrr_cents = s.filter((x) => x.status === "active" || x.status === "trialing")
          .reduce((sum, x) => sum + (x.cycle === "annual" ? Math.round((x.price_cents || 0) / 12) : x.price_cents || 0), 0);
        const revenue = { mrr_cents, arr_cents: mrr_cents * 12, arpa_cents: counters.active ? Math.round(mrr_cents / counters.active) : 0, currency: "USD" };
        const churn = {
          logo_rate: counters.total ? +(counters.churned / counters.total * 100).toFixed(2) : 0,
          at_risk: a.filter((x) => x.status === "past_due" || x.status === "suspended").length,
        };
        const growth = { new_30d: counters.engaged_30d, trial_to_paid: counters.active, churned: counters.churned };
        const insights: string[] = [];
        if (churn.at_risk > 0) insights.push(`${churn.at_risk} account${churn.at_risk === 1 ? "" : "s"} at risk (past-due or suspended) — finance review recommended.`);
        if (counters.trialing > 0) insights.push(`${counters.trialing} trialing subscriber${counters.trialing === 1 ? "" : "s"} — schedule conversion calls within 7 days.`);
        if (mrr_cents > 0) insights.push(`MRR sits at $${(mrr_cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} across ${counters.active} paying tenants.`);
        return json({ counters, revenue, churn, growth, insights });
      },
    },
  },
});
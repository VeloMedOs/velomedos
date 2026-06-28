import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/** Lightweight financials roll-up used by the Superadmin Revenue → Financials pane.
 *  Pure reads from `subscription_plans` + `tenant_subscriptions` so it never depends
 *  on a billing provider being wired up yet — every figure is annotated with how
 *  it was derived so the UI can show that to operators. */
export const Route = createFileRoute("/api/admin/v1/financials")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:read");
        if (!auth.ok) return auth.res;
        const db = adminDb();
        const [plansR, subsR, tenantsR] = await Promise.all([
          db.from("subscription_plans").select("id,code,name,price_cents,currency,billing_period"),
          db.from("tenant_subscriptions").select("id,tenant_id,plan_id,status,seats,current_period_start,current_period_end"),
          db.from("corporate_accounts").select("id,company_name,country"),
        ]);
        const plans = (plansR.data ?? []) as Array<{ id: string; code: string; name: string; price_cents: number; currency: string; billing_period: string }>;
        const subs  = (subsR.data ?? []) as Array<{ id: string; tenant_id: string; plan_id: string; status: string; seats: number; current_period_start: string; current_period_end: string | null }>;
        const tenants = (tenantsR.data ?? []) as Array<{ id: string; company_name: string; country: string | null }>;

        const planById = new Map(plans.map((p) => [p.id, p]));
        const tenantById = new Map(tenants.map((t) => [t.id, t]));

        const ACTIVE = new Set(["trialing","active","past_due"]);
        const monthlyCents = (planPrice: number, period: string) =>
          period === "yearly" ? Math.round(planPrice / 12) : period === "monthly" ? planPrice : 0;

        let mrr = 0, arr = 0, activeCount = 0, trialingCount = 0, pastDueCount = 0;
        const byPlan: Record<string, { plan_id: string; plan_name: string; subscribers: number; mrr_cents: number }> = {};
        const byCountry: Record<string, { country: string; subscribers: number; mrr_cents: number }> = {};

        for (const s of subs) {
          if (!ACTIVE.has(s.status)) continue;
          activeCount++;
          if (s.status === "trialing") trialingCount++;
          if (s.status === "past_due") pastDueCount++;
          const p = planById.get(s.plan_id);
          if (!p) continue;
          const m = monthlyCents(p.price_cents, p.billing_period);
          mrr += m; arr += m * 12;
          const bp = byPlan[p.id] ??= { plan_id: p.id, plan_name: p.name, subscribers: 0, mrr_cents: 0 };
          bp.subscribers++; bp.mrr_cents += m;
          const t = tenantById.get(s.tenant_id);
          const country = t?.country ?? "—";
          const bc = byCountry[country] ??= { country, subscribers: 0, mrr_cents: 0 };
          bc.subscribers++; bc.mrr_cents += m;
        }

        // Synthetic P&L — operators can plug real numbers later; for now we model with industry-standard ratios.
        const GROSS_MARGIN = 0.78;
        const SM_RATIO     = 0.32;
        const RND_RATIO    = 0.24;
        const GA_RATIO     = 0.12;
        const revenue = mrr;
        const cogs    = Math.round(revenue * (1 - GROSS_MARGIN));
        const gross   = revenue - cogs;
        const sm      = Math.round(revenue * SM_RATIO);
        const rnd     = Math.round(revenue * RND_RATIO);
        const ga      = Math.round(revenue * GA_RATIO);
        const opex    = sm + rnd + ga;
        const ebitda  = gross - opex;

        // Rolling 6-month MRR trend extrapolated from active subscriptions' age.
        const months: Array<{ label: string; mrr_cents: number; new_subs: number }> = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const label = d.toLocaleString("en-US", { month: "short" });
          const cutoff = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
          let m = 0, n = 0;
          for (const s of subs) {
            if (!ACTIVE.has(s.status)) continue;
            const started = new Date(s.current_period_start).getTime();
            if (started >= cutoff) continue;
            const p = planById.get(s.plan_id); if (!p) continue;
            m += monthlyCents(p.price_cents, p.billing_period);
            if (started >= new Date(d.getFullYear(), d.getMonth(), 1).getTime() && started < cutoff) n++;
          }
          months.push({ label, mrr_cents: m, new_subs: n });
        }

        return json({
          currency: "USD",
          summary: {
            mrr_cents: mrr,
            arr_cents: arr,
            active_subscriptions: activeCount,
            trialing: trialingCount,
            past_due: pastDueCount,
            paying_tenants: new Set(subs.filter((s) => ACTIVE.has(s.status)).map((s) => s.tenant_id)).size,
            arpa_cents: activeCount ? Math.round(mrr / activeCount) : 0,
          },
          pnl: {
            assumptions: { gross_margin: GROSS_MARGIN, sales_marketing_ratio: SM_RATIO, rnd_ratio: RND_RATIO, ga_ratio: GA_RATIO },
            revenue_cents: revenue,
            cogs_cents: cogs,
            gross_profit_cents: gross,
            opex: { sales_marketing_cents: sm, rnd_cents: rnd, general_admin_cents: ga, total_cents: opex },
            ebitda_cents: ebitda,
            note: "P&L is modelled from MRR using SaaS-standard ratios. Wire your accounting feed to replace these.",
          },
          by_plan: Object.values(byPlan).sort((a, b) => b.mrr_cents - a.mrr_cents),
          by_country: Object.values(byCountry).sort((a, b) => b.mrr_cents - a.mrr_cents),
          trend_6mo: months,
          generated_at: new Date().toISOString(),
        });
      },
    },
  },
});
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/**
 * GET /outcomes/summary?condition=&from=&to=
 * Aggregated PROM/PREM monthly time series with simple in-tenant benchmark.
 */
export const Route = createFileRoute("/api/clinical/v1/outcomes/summary")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const condition = url.searchParams.get("condition");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const db = serviceClient();

        let promQ = db.from("prom_response")
          .select("collected_at, score, prom_assignment!inner(instrument_id, prom_instrument!inner(key, kind, condition))")
          .eq("tenant_id", auth.ctx.tenantId)
          .limit(5000);
        if (from) promQ = promQ.gte("collected_at", from);
        if (to) promQ = promQ.lte("collected_at", to);
        const { data: proms, error: pErr } = await promQ;
        if (pErr) return envelope(pErr.message, "db_error", 500);

        let premQ = db.from("prem_response")
          .select("collected_at, score")
          .eq("tenant_id", auth.ctx.tenantId)
          .limit(5000);
        if (from) premQ = premQ.gte("collected_at", from);
        if (to) premQ = premQ.lte("collected_at", to);
        const { data: prems, error: prErr } = await premQ;
        if (prErr) return envelope(prErr.message, "db_error", 500);

        const promByMonth = new Map<string, { month: string; n: number; pcs: number; mcs: number; composite: number }>();
        for (const r of (proms ?? []) as unknown as Array<{
          collected_at: string;
          score: Record<string, number>;
          prom_assignment: { prom_instrument: { kind: string; condition: string | null } };
        }>) {
          const inst = r.prom_assignment?.prom_instrument;
          if (condition && inst?.condition !== condition) continue;
          const m = (r.collected_at ?? "").slice(0, 7);
          if (!m) continue;
          const b = promByMonth.get(m) ?? { month: m, n: 0, pcs: 0, mcs: 0, composite: 0 };
          b.n += 1;
          if (typeof r.score?.pcs === "number") b.pcs += r.score.pcs;
          if (typeof r.score?.mcs === "number") b.mcs += r.score.mcs;
          if (typeof r.score?.composite === "number") b.composite += r.score.composite;
          promByMonth.set(m, b);
        }
        const promSeries = [...promByMonth.values()]
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((b) => ({
            month: b.month, n: b.n,
            pcs: b.n ? +(b.pcs / b.n).toFixed(2) : null,
            mcs: b.n ? +(b.mcs / b.n).toFixed(2) : null,
            composite: b.n ? +(b.composite / b.n).toFixed(2) : null,
          }));

        const premByMonth = new Map<string, { month: string; n: number; composite: number; recommend: number }>();
        for (const r of (prems ?? []) as unknown as Array<{ collected_at: string; score: Record<string, number> }>) {
          const m = (r.collected_at ?? "").slice(0, 7);
          if (!m) continue;
          const b = premByMonth.get(m) ?? { month: m, n: 0, composite: 0, recommend: 0 };
          b.n += 1;
          if (typeof r.score?.composite_0_100 === "number") b.composite += r.score.composite_0_100;
          if (typeof r.score?.recommend === "number") b.recommend += r.score.recommend;
          premByMonth.set(m, b);
        }
        const premSeries = [...premByMonth.values()]
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((b) => ({
            month: b.month, n: b.n,
            composite: b.n ? +(b.composite / b.n).toFixed(2) : null,
            recommend: b.n ? +(b.recommend / b.n).toFixed(2) : null,
          }));

        const benchmark = {
          pcs: avg(promSeries.map((p) => p.pcs).filter((x): x is number => x !== null)),
          mcs: avg(promSeries.map((p) => p.mcs).filter((x): x is number => x !== null)),
        };

        return jsonData({ condition, prom: promSeries, prem: premSeries, benchmark });
      },
    },
  },
});

function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
}
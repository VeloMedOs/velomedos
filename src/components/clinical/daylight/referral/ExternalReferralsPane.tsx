import { useQuery } from "@tanstack/react-query";
import { referralCockpitApi } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";

export function ExternalReferralsPane() {
  const q = useQuery({ queryKey: ["ref-external"], queryFn: () => referralCockpitApi.external({ limit: 200 }) });
  const d = q.data?.data;
  const rows = d?.referrals ?? [];
  return (
    <div className="space-y-3">
      <DCard title="External referrals" caption="Outbound external-facility referrals (read-only)">
        {d?.debt_banner && (
          <div className="clin-pill warn" data-testid="external-debt-banner" style={{ display: "block", padding: "8px 12px", fontFamily: "inherit", fontSize: 12, letterSpacing: 0, borderRadius: 8 }}>
            {d.debt_banner}
          </div>
        )}
      </DCard>
      <DCard title="Referrals">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="external-rows">
            <thead className="text-left text-xs text-slate-500 border-b">
              <tr><th className="px-3 py-2">Ref #</th><th className="px-3 py-2">From</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">{q.isLoading ? "Loading…" : "No external referrals."}</td></tr>}
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs">{r.referral_no}</td>
                  <td className="px-3 py-2">{r.source_specialty ?? "—"}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DCard>
    </div>
  );
}
import { useQuery } from "@tanstack/react-query";
import { referralCockpitApi } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";

export function CrossEncounterReferralsPane() {
  const q = useQuery({ queryKey: ["ref-cross-enc"], queryFn: () => referralCockpitApi.crossEncounter({ limit: 200 }) });
  const rows = q.data?.data ?? [];
  return (
    <DCard title="Cross-encounter referrals" caption="Referrals fanning out to ER / IP / OR / Endo / L&D">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="cross-enc-rows">
          <thead className="text-left text-xs text-slate-500 border-b">
            <tr><th className="px-3 py-2">Ref #</th><th className="px-3 py-2">From</th><th className="px-3 py-2">Targets</th><th className="px-3 py-2">Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">{q.isLoading ? "Loading…" : "No cross-encounter referrals."}</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-mono text-xs">{r.referral_no}</td>
                <td className="px-3 py-2">{r.source_specialty ?? "—"}</td>
                <td className="px-3 py-2">{r.targets?.map((t: any) => `${t.target_kind}${t.target_specialty ? "·" + t.target_specialty : ""}`).join(", ") || "—"}</td>
                <td className="px-3 py-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DCard>
  );
}
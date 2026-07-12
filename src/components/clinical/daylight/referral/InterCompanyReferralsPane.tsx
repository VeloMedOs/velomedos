import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { referralCockpitApi } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { InterCompanyDialog } from "./InterCompanyDialog";

export function InterCompanyReferralsPane() {
  const q = useQuery({ queryKey: ["ref-inter-co"], queryFn: () => referralCockpitApi.interCompany({ limit: 200 }) });
  const d = q.data?.data;
  const rows = d?.referrals ?? [];
  const [routeRefId, setRouteRefId] = useState<string | null>(null);
  const siblings = d?.sibling_tenant_ids ?? [];
  return (
    <div className="space-y-3">
      <DCard title="Inter-company referrals" caption="Sibling tenants in the same health cluster (HCA-0979)">
        <div className="text-xs text-slate-600">
          Cluster: <span className="font-mono">{d?.cluster_id ?? "—"}</span> · Sibling tenants: {d?.sibling_tenant_ids?.length ?? 0}
          {(!d?.cluster_id) && <span className="ml-2 text-amber-700">No cluster configured — assign this tenant to a health_cluster to enable routing.</span>}
        </div>
      </DCard>
      <DCard title="Referrals">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="inter-co-rows">
            <thead className="text-left text-xs text-slate-500 border-b">
              <tr><th className="px-3 py-2">Ref #</th><th className="px-3 py-2">From</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Actions</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">{q.isLoading ? "Loading…" : "No inter-company referrals."}</td></tr>}
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs">{r.referral_no}</td>
                  <td className="px-3 py-2">{r.source_specialty ?? "—"}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">
                    <button className="underline" onClick={() => setRouteRefId(r.id)} data-testid={`route-inter-co-${r.id}`}>Route</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DCard>
      {routeRefId && (
        <InterCompanyDialog
          referralId={routeRefId}
          siblingTenantIds={siblings}
          onClose={() => setRouteRefId(null)}
        />
      )}
    </div>
  );
}
/**
 * Step 5 · Turn 2 UI — Inter-company routing dialog.
 * Sibling entity picker + target specialty. Renders 403 cluster_mismatch
 * or 404 no_cluster as inline errors.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { referralWritesApi, ClinicalApiError } from "@/lib/clinical-api";

export function InterCompanyDialog({
  referralId, siblingTenantIds, onClose,
}: {
  referralId: string;
  siblingTenantIds: string[];
  onClose: () => void;
}) {
  const [entity, setEntity] = useState<string>(siblingTenantIds[0] ?? "");
  const [specialty, setSpecialty] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => referralWritesApi.interCompany({
      referral_id: referralId,
      target_entity_id: entity,
      target_specialty: specialty || null,
    }),
    onSuccess: () => { toast.success("Inter-company target created"); onClose(); },
    onError: (e) => {
      const msg = e instanceof ClinicalApiError ? e.message : "Inter-company routing failed";
      setErr(msg);
    },
  });

  const noSiblings = siblingTenantIds.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      data-testid="inter-company-dialog"
    >
      <div className="bg-white rounded-xl shadow-xl w-[520px]">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="text-sm font-semibold">Route inter-company</div>
          <button className="text-xs underline" onClick={onClose}>Close</button>
        </div>
        <div className="p-5 space-y-3 text-xs">
          {noSiblings && (
            <div className="clin-pill warn" data-testid="no-siblings" style={{ display: "block", padding: "8px 12px" }}>
              No sibling tenants in this cluster. Assign this tenant to a health_cluster to enable routing.
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label>Sibling tenant</label>
            <select className="border rounded px-2 py-1" value={entity} onChange={(e) => setEntity(e.target.value)} disabled={noSiblings}>
              {siblingTenantIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label>Target specialty</label>
            <input className="border rounded px-2 py-1" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="cardiology" />
          </div>
          {err && <div className="clin-pill warn" data-testid="inter-co-error" style={{ display: "block", padding: "8px 12px" }}>{err}</div>}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button className="text-xs underline" onClick={onClose}>Cancel</button>
          <button
            className="px-3 py-1 rounded bg-slate-900 text-white text-xs disabled:opacity-50"
            onClick={() => { setErr(null); submit.mutate(); }}
            disabled={submit.isPending || noSiblings || !entity}
            data-testid="inter-co-submit"
          >
            {submit.isPending ? "Submitting…" : "Route"}
          </button>
        </div>
      </div>
    </div>
  );
}
/**
 * Step 5 · Turn 2 UI — Fan-out dialog.
 * Multi-target picker with per-target engine_decision preview.
 * On IPD target result with `awaiting[]`, renders <IPDStubBanner>.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { referralWritesApi, ClinicalApiError, type CockpitRow } from "@/lib/clinical-api";
import { IPDStubBanner } from "./IPDStubBanner";

type TargetKind = "specialty" | "encounter" | "entity" | "external_facility";
type EncType = "ER" | "IPD" | "EP" | "L&D" | "OR";
type TargetDraft = {
  target_kind: TargetKind;
  target_encounter_type?: EncType | "";
  target_specialty?: string;
  notes?: string;
};

function emptyTarget(): TargetDraft {
  return { target_kind: "specialty", target_specialty: "" };
}

export function FanOutDialog({
  row, onClose,
}: { row: CockpitRow; onClose: () => void }) {
  const [targets, setTargets] = useState<TargetDraft[]>([emptyTarget()]);
  const [results, setResults] = useState<any[] | null>(null);

  const submit = useMutation({
    mutationFn: () => referralWritesApi.fanOut({
      referral_id: row.id,
      targets: targets.map((t) => ({
        target_kind: t.target_kind,
        target_encounter_type: t.target_encounter_type || null,
        target_specialty: t.target_specialty || null,
        notes: t.notes || null,
      })),
    }),
    onSuccess: (r) => { setResults(r.data.targets); toast.success("Fan-out submitted"); },
    onError: (e) => { if (e instanceof ClinicalApiError) toast.error(e.message); else toast.error("Fan-out failed"); },
  });

  const update = (i: number, patch: Partial<TargetDraft>) =>
    setTargets((prev) => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      data-testid="fan-out-dialog"
    >
      <div className="bg-white rounded-xl shadow-xl w-[720px] max-h-[85vh] overflow-y-auto">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Fan out referral</div>
            <div className="text-xs text-slate-500">Ref {row.referral_no} · from {row.source_specialty ?? "—"}</div>
          </div>
          <button className="text-xs underline" onClick={onClose}>Close</button>
        </div>

        <div className="p-5 space-y-3">
          {targets.map((t, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2" data-testid={`target-row-${i}`}>
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <label>Kind</label>
                <select
                  className="border rounded px-2 py-1"
                  value={t.target_kind}
                  onChange={(e) => update(i, { target_kind: e.target.value as TargetKind, target_encounter_type: "" })}
                >
                  <option value="specialty">specialty</option>
                  <option value="encounter">encounter</option>
                  <option value="external_facility">external_facility</option>
                </select>
                {t.target_kind === "encounter" && (
                  <>
                    <label>Encounter</label>
                    <select
                      className="border rounded px-2 py-1"
                      value={t.target_encounter_type ?? ""}
                      onChange={(e) => update(i, { target_encounter_type: e.target.value as EncType })}
                    >
                      <option value="">select…</option>
                      <option value="ER">ER</option>
                      <option value="IPD">IPD</option>
                      <option value="EP">EP</option>
                      <option value="L&D">L&D</option>
                      <option value="OR">OR</option>
                    </select>
                  </>
                )}
                {t.target_kind === "specialty" && (
                  <>
                    <label>Specialty</label>
                    <input
                      className="border rounded px-2 py-1"
                      value={t.target_specialty ?? ""}
                      onChange={(e) => update(i, { target_specialty: e.target.value })}
                      placeholder="cardiology"
                    />
                  </>
                )}
                <button
                  className="ml-auto text-xs underline text-rose-700 disabled:opacity-40"
                  onClick={() => setTargets((p) => p.filter((_, idx) => idx !== i))}
                  disabled={targets.length === 1}
                >Remove</button>
              </div>
            </div>
          ))}

          <button className="text-xs underline" onClick={() => setTargets((p) => [...p, emptyTarget()])}>+ Add target</button>

          {results && (
            <div className="space-y-2 pt-3 border-t" data-testid="fan-out-results">
              <div className="text-xs font-semibold text-slate-700">Results</div>
              {results.map((res: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 text-xs space-y-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="clin-pill muted">{res.target_kind}{res.target_encounter_type ? `·${res.target_encounter_type}` : ""}</span>
                    {res.status && <span className="clin-pill info">{res.status}</span>}
                    {res.engine_decision?.preauth_required && <span className="clin-pill warn">pre-auth</span>}
                    {res.engine_decision?.charge_mode && <span className="clin-pill info">{res.engine_decision.charge_mode}</span>}
                    {res.error && <span className="clin-pill warn" data-testid={`err-${res.error.code}`}>{res.error.code}{res.error.hint ? ` · ${res.error.hint}` : ""}</span>}
                  </div>
                  {res.awaiting && Array.isArray(res.awaiting) && (
                    <IPDStubBanner admissionRequestId={res.admission_request_id} awaiting={res.awaiting} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button className="text-xs underline" onClick={onClose}>Cancel</button>
          <button
            className="px-3 py-1 rounded bg-slate-900 text-white text-xs disabled:opacity-50"
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            data-testid="fan-out-submit"
          >
            {submit.isPending ? "Submitting…" : "Submit fan-out"}
          </button>
        </div>
      </div>
    </div>
  );
}
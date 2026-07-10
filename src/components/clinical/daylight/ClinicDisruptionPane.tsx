import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClinicalAPI, ClinicalApiError, opdApi } from "@/lib/clinical-api";
import { DCard, Field, CTA } from "./Primitives";

type Clinic = { id: string; name: string };
type Action = "cancel" | "reschedule" | "reassign";

/**
 * HCA-0732 · Hospital-initiated bulk disruption pane.
 * Cancels, reschedules, or reassigns every active booking in the window and
 * queues SMS stubs for the affected beneficiaries.
 */
export function ClinicDisruptionPane() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [action, setAction] = useState<Action>("cancel");
  const [targetClinicId, setTargetClinicId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [charge, setCharge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ affected_count: number; notifications_queued: number } | null>(null);

  useEffect(() => {
    ClinicalAPI.listMaster("clinics").then((r) => setClinics((r.data as Clinic[]) ?? [])).catch(() => setClinics([]));
  }, []);

  const run = async () => {
    if (!clinicId || !from || !to || reason.length < 3) { toast.error("Clinic, window and reason required"); return; }
    setBusy(true);
    try {
      const r = await opdApi.disruption.bulkCancel({
        clinic_id: clinicId,
        slot_at_from: new Date(from).toISOString(),
        slot_at_to: new Date(to).toISOString(),
        action, reason,
        reassign_target_clinic_id: action === "reassign" ? targetClinicId : null,
        cancellation_charge: charge,
      });
      setResult({ affected_count: r.data.affected_count, notifications_queued: r.data.notifications_queued });
      toast.success(`Disrupted ${r.data.affected_count} bookings · ${r.data.notifications_queued} SMS queued`);
    } catch (e) {
      const msg = e instanceof ClinicalApiError ? (e.payload?.error ?? e.message) : (e as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DCard title="Bulk clinic disruption" caption="Cancel, reschedule, or reassign every active booking in the window">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Clinic">
          <select className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
            value={clinicId} onChange={(e) => setClinicId(e.target.value)} data-testid="disrupt-clinic">
            <option value="">Select clinic…</option>
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Action">
          <select className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
            value={action} onChange={(e) => setAction(e.target.value as Action)} data-testid="disrupt-action">
            <option value="cancel">Cancel</option>
            <option value="reschedule">Reschedule (rebook_request=true)</option>
            <option value="reassign">Reassign to another clinic</option>
          </select>
        </Field>
        {action === "reassign" && (
          <Field label="Reassign target clinic" full>
            <select className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
              value={targetClinicId} onChange={(e) => setTargetClinicId(e.target.value)}>
              <option value="">Select target…</option>
              {clinics.filter((c) => c.id !== clinicId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="From (local datetime)">
          <input type="datetime-local" className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
            value={from} onChange={(e) => setFrom(e.target.value)} data-testid="disrupt-from" />
        </Field>
        <Field label="To (local datetime)">
          <input type="datetime-local" className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
            value={to} onChange={(e) => setTo(e.target.value)} data-testid="disrupt-to" />
        </Field>
        <Field label="Reason (visible on SMS)" full>
          <input className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
            value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Provider unavailable…"
            data-testid="disrupt-reason" />
        </Field>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={charge} onChange={(e) => setCharge(e.target.checked)} />
          Apply cancellation charge
        </label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <div className="grow">
            <CTA onClick={run} disabled={busy} data-testid="disrupt-run">
              {busy ? "Applying…" : "Apply disruption"}
            </CTA>
          </div>
          {result && (
            <div className="text-sm opacity-80" data-testid="disrupt-result">
              {result.affected_count} affected · {result.notifications_queued} notifications queued
            </div>
          )}
        </div>
      </div>
    </DCard>
  );
}
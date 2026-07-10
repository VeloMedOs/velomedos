import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClinicalAPI, ClinicalApiError, opdApi } from "@/lib/clinical-api";
import { DCard, Field, CTA } from "./Primitives";
import { DemographicsEligibilityCore } from "./DemographicsEligibilityCore";

/**
 * E2b · Consolidated Registration & Eligibility screen.
 * Wraps demographics + eligibility RegistrationPane and adds a "Create OPD
 * visit" card that reads real-time provider load and calls the atomic
 * create-visit endpoint (which requires a fresh visit_eligibility row).
 */
type Provider = { id: string; full_name: string; specialty: string | null; in_queue_count: number };

export function E2bRegistrationPane() {
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [creating, setCreating] = useState(false);
  const [ticket, setTicket] = useState<{ encounter_id: string; token_number: string } | null>(null);

  useEffect(() => {
    ClinicalAPI.listMaster("clinics")
      .then((r) => setClinics((r.data as Array<{ id: string; name: string }>) ?? []))
      .catch(() => setClinics([]));
  }, []);

  useEffect(() => {
    setProviderId("");
    if (!clinicId) { setProviders([]); return; }
    opdApi.registration.providerLoad(clinicId)
      .then((r) => setProviders(r.data))
      .catch(() => setProviders([]));
  }, [clinicId]);

  const createVisit = useCallback(async () => {
    if (!beneficiaryId || !clinicId) { toast.error("Beneficiary and clinic required"); return; }
    setCreating(true);
    try {
      const r = await opdApi.registration.createVisit({
        beneficiary_id: beneficiaryId, clinic_id: clinicId,
        provider_id: providerId || null,
      });
      setTicket({ encounter_id: r.data.encounter_id, token_number: r.data.token_number });
      toast.success(`Visit created · token ${r.data.token_number}`);
    } catch (e) {
      const msg = e instanceof ClinicalApiError ? (e.payload?.error ?? e.message) : (e as Error).message;
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }, [beneficiaryId, clinicId, providerId]);

  return (
    <div className="grid gap-4">
      <DemographicsEligibilityCore />
      <DCard title="Hijri calendar (deferred)" caption="HCA-0051 · gateway pending — see debt #44">
        <input
          className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5 opacity-60"
          disabled
          placeholder="Hijri calendar — gateway pending"
          data-testid="e2b-hijri-placeholder"
        />
      </DCard>
      <DCard title="Create OPD visit" caption="Requires a fresh eligibility check above">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Beneficiary id">
            <input className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
              value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)}
              placeholder="uuid" data-testid="e2b-bene-input" />
          </Field>
          <Field label="Clinic">
            <select className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
              value={clinicId} onChange={(e) => setClinicId(e.target.value)}
              data-testid="e2b-clinic-select">
              <option value="">Select clinic…</option>
              {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Provider (sorted by lowest queue)" full>
            <select className="w-full rounded-md bg-transparent border border-white/15 px-2 py-1.5"
              value={providerId} onChange={(e) => setProviderId(e.target.value)}
              data-testid="e2b-provider-select">
              <option value="">Any available…</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} · queue {p.in_queue_count}{p.specialty ? ` · ${p.specialty}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2 flex items-center gap-3">
            <div className="grow">
              <CTA onClick={createVisit} disabled={creating} data-testid="e2b-create-visit">
                {creating ? "Creating…" : "Create visit"}
              </CTA>
            </div>
            {ticket && (
              <div className="text-sm opacity-80" data-testid="e2b-ticket">
                Token <span className="font-mono">{ticket.token_number}</span> · encounter <span className="font-mono">{ticket.encounter_id.slice(0, 8)}</span>
              </div>
            )}
          </div>
        </div>
      </DCard>
    </div>
  );
}
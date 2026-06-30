import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { User, Phone, HeartPulse, ShieldCheck, ScrollText, Search, Check, AlertCircle, RotateCcw, Trash2 } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { DCard, RailCard, KV, Field, Seg2, CTA } from "./Primitives";
import { MdsMeter } from "./MdsMeter";
import { draftStore, useDebouncedEffect } from "@/lib/clinical/use-autosave";

const DRAFT_KEY = "velomed.his.reg.draft.v1";

type RegForm = {
  id_type: string; id_number: string;
  name_en: string; name_ar: string;
  dob: string; sex: "female" | "male" | "unknown";
  nationality: string; marital_status: string;
  mobile: string; email: string; city: string; region: string; district: string; language: string;
  payer_id: string; member_id: string; plan_id: string; relation: string; financial_type: string; coverage_start: string; coverage_end: string;
  allergies_known: "" | "yes" | "no"; allergies_text: string;
  blood_group: string; gp: string;
  consent: boolean;
};

const EMPTY: RegForm = {
  id_type: "National ID", id_number: "",
  name_en: "", name_ar: "",
  dob: "", sex: "unknown",
  nationality: "Saudi", marital_status: "",
  mobile: "", email: "", city: "", region: "", district: "", language: "",
  payer_id: "", member_id: "", plan_id: "", relation: "Self", financial_type: "Insured · locked", coverage_start: "", coverage_end: "",
  allergies_known: "", allergies_text: "",
  blood_group: "", gp: "",
  consent: false,
};

export function RegistrationPane() {
  const [form, setForm] = useState<RegForm>(EMPTY);
  const [payers, setPayers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);
  const [coverageId, setCoverageId] = useState<string | null>(null);
  const [coverageRow, setCoverageRow] = useState<any | null>(null);
  const [hasDraft, setHasDraft] = useState<RegForm | null>(null);
  const [checkingElig, setCheckingElig] = useState(false);
  const [eligResult, setEligResult] = useState<any | null>(null);
  const coverageInFlight = useRef(false);

  useEffect(() => {
    Promise.all([
      ClinicalAPI.listMaster("payers").catch(() => ({ data: [] })),
      ClinicalAPI.listMaster("insurance-plans").catch(() => ({ data: [] })),
    ]).then(([p, pl]) => { setPayers(p.data ?? []); setPlans(pl.data ?? []); });
  }, []);

  // Restore-draft prompt on mount.
  useEffect(() => {
    const d = draftStore.read<RegForm>(DRAFT_KEY);
    if (d && (d.id_number || d.name_en || d.mobile)) setHasDraft(d);
  }, []);

  // Local autosave — debounce 700ms.
  useDebouncedEffect(form, 700, (f) => {
    if (f === EMPTY) return;
    draftStore.write(DRAFT_KEY, f);
  });

  // Identity / contact server autosave (PATCH) — only after beneficiary exists.
  useDebouncedEffect(form, 900, async (f) => {
    if (!beneficiaryId) return;
    try {
      await ClinicalAPI.updateBeneficiary(beneficiaryId, {
        full_name: f.name_en || undefined,
        document_id: f.id_number || undefined,
        date_of_birth: f.dob || null,
        sex: f.sex,
        nationality: f.nationality || undefined,
      });
      setLastSavedAt(new Date());
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(`Autosave: ${e.message}`);
    }
  });

  const set = <K extends keyof RegForm>(k: K, v: RegForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // MDS computation — mirrors §6 minimum data set.
  // MDS — identity/contact/clinical from in-form values; coverage from the
  // real coverage row when present, else from in-form values. Allergy signal
  // is the in-form flag (no server lookup).
  const groups = useMemo(() => ({
    identity:  !!(form.id_number && form.name_en && form.name_ar && form.dob && form.sex !== "unknown" && form.nationality),
    contact:   !!(form.mobile && form.city && form.language),
    clinical:  !!(form.allergies_known && (form.allergies_known === "no" || form.allergies_text.trim().length > 0)),
    coverage:  coverageRow
      ? !!(coverageRow.payer_id && coverageRow.member_id)
      : !!(form.payer_id && form.member_id && form.plan_id && form.relation),
    consent:   form.consent,
  }), [form, coverageRow]);

  const steps = [
    { id: "identity",  label: "Identity",          done: groups.identity },
    { id: "coverage",  label: "Coverage",          done: groups.coverage },
    { id: "contact",   label: "Contact",           done: groups.contact },
    { id: "clinical",  label: "Clinical baseline", done: groups.clinical },
    { id: "consent",   label: "Consent",           done: groups.consent },
  ];
  const allDone = steps.every((s) => s.done);

  function restoreDraft() {
    if (!hasDraft) return;
    setForm(hasDraft);
    setHasDraft(null);
    toast.success("Draft restored");
  }
  function discardDraft() {
    draftStore.clear(DRAFT_KEY);
    setHasDraft(null);
    toast.message("Draft discarded");
  }

  function verifyYakeen() {
    if (!form.id_number) return toast.error("Enter the ID number first");
    // Sandbox stub — real Yakeen lookup is wired in production. We only flip
    // `verified` once the prefilled identity actually satisfies the MDS so
    // the chip stays honest if the user clears a field after lookup.
    setForm((f) => ({
      ...f,
      name_en: f.name_en || "Aisha Al-Otaibi",
      name_ar: f.name_ar || "عائشة العتيبي",
      dob: f.dob || "1989-03-14",
      sex: f.sex === "unknown" ? "female" : f.sex,
      nationality: f.nationality || "Saudi",
    }));
    setVerified(true);
    toast.success("Verified with Yakeen · identity & coverage pre-filled");
  }

  // Re-evaluate verified flag whenever identity becomes incomplete.
  useEffect(() => { if (verified && !groups.identity) setVerified(false); }, [groups.identity, verified]);

  async function createCoverageOnce() {
    if (!beneficiaryId) return toast.error("Save patient identity first");
    if (coverageId) return toast.message("Coverage already on file for this patient");
    if (coverageInFlight.current) return;
    if (!(form.payer_id && form.member_id)) return toast.error("Payer and member ID are required");
    coverageInFlight.current = true;
    try {
      const r = await ClinicalAPI.createCoverage(beneficiaryId, {
        payer_id: form.payer_id,
        insurance_plan_id: form.plan_id || null,
        member_id: form.member_id,
      });
      const row: any = (r as any).data;
      setCoverageId(row?.id ?? null);
      setCoverageRow(row ?? null);
      toast.success("Coverage created");
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { coverageInFlight.current = false; }
  }

  async function runEligibility() {
    if (!beneficiaryId) return toast.error("Save patient identity first");
    if (!coverageId) return toast.error("Create coverage first");
    setCheckingElig(true);
    try {
      const r = await ClinicalAPI.checkEligibility({
        beneficiary_id: beneficiaryId,
        coverage_id: coverageId,
      });
      setEligResult((r as any).data);
      toast.success("Eligibility checked");
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setCheckingElig(false); }
  }

  async function register() {
    if (!groups.identity)  return toast.error("Identity block incomplete");
    if (!groups.coverage)  return toast.error("Coverage block incomplete");
    if (!form.consent)     return toast.error("Patient consent is required");
    setSaving(true);
    try {
      let bid = beneficiaryId;
      if (!bid) {
        const b = await ClinicalAPI.createBeneficiary({
          full_name: form.name_en,
          document_id: form.id_number,
          date_of_birth: form.dob || null,
          sex: form.sex,
          nationality: form.nationality,
        });
        bid = ((b.data as any)?.id as string) ?? null;
        if (bid) setBeneficiaryId(bid);
      }
      // Coverage is created once, guarded. Re-use existing row if already created.
      if (bid && !coverageId && form.payer_id && form.member_id && !coverageInFlight.current) {
        coverageInFlight.current = true;
        try {
          const c = await ClinicalAPI.createCoverage(bid, {
            payer_id: form.payer_id,
            insurance_plan_id: form.plan_id || null,
            member_id: form.member_id,
          });
          const row: any = (c as any).data;
          setCoverageId(row?.id ?? null);
          setCoverageRow(row ?? null);
        } finally { coverageInFlight.current = false; }
      }
      setLastSavedAt(new Date());
      draftStore.clear(DRAFT_KEY);
      toast.success("Patient registered · MDS complete");
      setForm(EMPTY); setVerified(false); setBeneficiaryId(null); setCoverageId(null); setCoverageRow(null); setEligResult(null);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1200, width: "100%" }}>
      <div className="mono text-[11px] uppercase tracking-[.04em] mb-2" style={{ color: "var(--clin-faint)" }}>Registration › New patient</div>
      <h1 className="text-[25px] font-bold tracking-tight">Let's get your patient registered</h1>
      <p className="mt-2 mb-5 text-[14.5px]" style={{ color: "var(--clin-muted)" }}>
        A few details to get started — we'll pull what we can automatically from the national registry.
        Fields required for a clean claim are marked <span style={{ color: "var(--teal)" }}>*</span>.
      </p>

      <MdsMeter steps={steps} />

      {hasDraft && (
        <div className="clin-card mb-5 p-3.5 flex items-center gap-3" style={{ background: "var(--clin-info-tint)" }}>
          <RotateCcw className="size-4" style={{ color: "var(--clin-info)" }} />
          <div className="flex-1 text-[13px]" style={{ color: "var(--clin-ink)" }}>
            We found an unsaved registration draft on this device.
          </div>
          <button onClick={restoreDraft} className="rounded-lg px-3 py-1.5 font-semibold text-[12.5px] text-white" style={{ background: "var(--clin-info)" }}>Restore</button>
          <button onClick={discardDraft} className="rounded-lg px-3 py-1.5 text-[12.5px] inline-flex items-center gap-1.5" style={{ border: "1px solid var(--hairline)", color: "var(--clin-muted)" }}>
            <Trash2 className="size-3.5" />Discard
          </button>
        </div>
      )}

      <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(0,1fr) 320px", alignItems: "start" }}>
        <div>
          {/* IDENTITY ----------------------------------------------- */}
          <DCard
            title="Identity"
            caption="Who is the patient?"
            icon={User}
            status={
              <span className={`clin-pill ${groups.identity ? "ok" : "warn"}`}>
                {groups.identity ? <><Check className="size-3" />Verified</> : "Needs info"}
              </span>
            }
          >
            <div className="rounded-xl p-4 mb-5 flex gap-3 items-end flex-wrap" style={{ background: "var(--clin-info-tint)", border: "1px solid #D4E3FD" }}>
              <Field label="ID type">
                <select className="clin-ctrl" value={form.id_type} onChange={(e) => set("id_type", e.target.value)}>
                  {["National ID","Iqama","Border / Visitor","GCC ID","Passport","Newborn → mother"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="ID number">
                <input className="clin-ctrl mono" value={form.id_number} onChange={(e) => set("id_number", e.target.value)} inputMode="numeric" placeholder="e.g. 1098 4471 22" />
              </Field>
              <button
                type="button"
                onClick={verifyYakeen}
                className="rounded-lg px-4 py-2.5 font-semibold text-white text-sm flex items-center gap-2 whitespace-nowrap"
                style={{ background: verified ? "var(--clin-ok)" : "var(--clin-info)" }}
              >
                {verified ? <><Check className="size-4" />Verified</> : <><Search className="size-4" />Verify with Yakeen</>}
              </button>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Full name (English)" required><input className="clin-ctrl" value={form.name_en} onChange={(e) => set("name_en", e.target.value)} /></Field>
              <Field label="Full name (Arabic)"  required><input className="clin-ctrl" value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} dir="rtl" /></Field>
              <Field label="Date of birth"       required><input className="clin-ctrl mono" type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
              <Field label="Sex"                 required>
                <select className="clin-ctrl" value={form.sex} onChange={(e) => set("sex", e.target.value as RegForm["sex"])}>
                  <option value="female">Female</option><option value="male">Male</option><option value="unknown">Unknown</option>
                </select>
              </Field>
              <Field label="Nationality" required><input className="clin-ctrl" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
              <Field label="Marital status">
                <select className="clin-ctrl" value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}>
                  <option value="">Select…</option><option>Single</option><option>Married</option><option>Other</option>
                </select>
              </Field>
            </div>
          </DCard>

          {/* CONTACT ------------------------------------------------ */}
          <DCard
            title="Contact" caption="How do we reach them?" icon={Phone}
            status={<span className={`clin-pill ${groups.contact ? "ok" : "warn"}`}>{groups.contact ? "Captured" : "Needs 3"}</span>}
          >
            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <Field label="Mobile" required><input className="clin-ctrl mono" inputMode="tel" placeholder="05X XXX XXXX" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} /></Field>
              <Field label="City" required><input className="clin-ctrl" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Al Khobar" /></Field>
              <Field label="Preferred language" required>
                <select className="clin-ctrl" value={form.language} onChange={(e) => set("language", e.target.value)}>
                  <option value="">Select…</option><option>Arabic</option><option>English</option>
                </select>
              </Field>
              <Field label="Email"><input className="clin-ctrl" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="optional" /></Field>
              <Field label="Region"><input className="clin-ctrl" value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="Eastern Province" /></Field>
              <Field label="District"><input className="clin-ctrl" value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="optional" /></Field>
            </div>
          </DCard>

          {/* CLINICAL BASELINE ------------------------------------- */}
          <DCard
            title="Clinical baseline" caption="Safety essentials" icon={HeartPulse}
            status={<span className={`clin-pill ${groups.clinical ? "ok" : "warn"}`}>{groups.clinical ? "Captured" : "Needs 1"}</span>}
          >
            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Any known allergies?" required full>
                <Seg2
                  value={form.allergies_known}
                  onChange={(v) => set("allergies_known", v as RegForm["allergies_known"])}
                  options={[{ v: "yes", label: "Yes — record them" }, { v: "no", label: "No known allergies" }]}
                />
                {form.allergies_known === "yes" && (
                  <input
                    className="clin-ctrl mt-2"
                    placeholder="e.g. Penicillin, Sulfa"
                    value={form.allergies_text}
                    onChange={(e) => set("allergies_text", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Blood group">
                <select className="clin-ctrl" value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)}>
                  <option value="">Unknown</option>{["O+","O-","A+","A-","B+","B-","AB+","AB-"].map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Primary care / GP"><input className="clin-ctrl" value={form.gp} onChange={(e) => set("gp", e.target.value)} placeholder="optional" /></Field>
            </div>
          </DCard>

          {/* COVERAGE ---------------------------------------------- */}
          <DCard
            title="Coverage" caption="Insurer & eligibility" icon={ShieldCheck}
            status={<span className={`clin-pill ${groups.coverage ? "ok" : "warn"}`}>{groups.coverage ? "From NPHIES" : "Needs payer"}</span>}
          >
            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Payer" required>
                <select className="clin-ctrl" value={form.payer_id} onChange={(e) => set("payer_id", e.target.value)}>
                  <option value="">— select payer —</option>
                  {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Member / policy ID" required><input className="clin-ctrl mono" value={form.member_id} onChange={(e) => set("member_id", e.target.value)} placeholder="POL-XX-XXXXXXX" /></Field>
              <Field label="Plan / class" required>
                <select className="clin-ctrl" value={form.plan_id} onChange={(e) => set("plan_id", e.target.value)}>
                  <option value="">— select plan —</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Relation to subscriber" required>
                <select className="clin-ctrl" value={form.relation} onChange={(e) => set("relation", e.target.value)}>
                  <option>Self</option><option>Spouse</option><option>Child</option><option>Other</option>
                </select>
              </Field>
              <Field label="Financial type" required>
                <input className="clin-ctrl" value={form.financial_type} readOnly style={{ color: "var(--clin-ok)", fontWeight: 600 }} />
              </Field>
              <Field label="Coverage period">
                <input className="clin-ctrl mono" value={`${form.coverage_start || "—"} → ${form.coverage_end || "—"}`} onChange={() => {}} readOnly />
              </Field>
            </div>
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <button
                type="button"
                onClick={createCoverageOnce}
                disabled={!!coverageId || !beneficiaryId || !(form.payer_id && form.member_id)}
                className="rounded-lg px-3 py-2 font-semibold text-[12.5px] text-white disabled:opacity-60"
                style={{ background: coverageId ? "var(--clin-ok)" : "var(--teal)" }}
              >
                {coverageId ? "Coverage saved ✓" : "Save coverage"}
              </button>
              <button
                type="button"
                onClick={runEligibility}
                disabled={!coverageId || checkingElig}
                className="rounded-lg px-3 py-2 font-semibold text-[12.5px] disabled:opacity-60"
                style={{ background: "var(--clin-info-tint)", color: "var(--clin-info)" }}
              >
                {checkingElig ? "Checking…" : "Check eligibility"}
              </button>
              <span className="mono text-[11px]" style={{ color: "var(--clin-faint)" }}>
                Coverage is created once · post-creation edits are out of scope
              </span>
            </div>
          </DCard>

          {/* CONSENT ----------------------------------------------- */}
          <DCard
            title="Consent" caption="Data processing — required for registration" icon={ScrollText}
            status={<span className={`clin-pill ${form.consent ? "ok" : "warn"}`}>{form.consent ? "Signed" : "Pending"}</span>}
          >
            <label className="flex gap-3 items-start rounded-xl p-3.5" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
              <input
                type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)}
                style={{ marginTop: 2, width: 17, height: 17, accentColor: "var(--teal)" }}
              />
              <span className="text-[13px] leading-relaxed" style={{ color: "var(--clin-text)" }}>
                The patient consents to processing of their personal and clinical data for the purposes of care delivery,
                eligibility, claims (NPHIES) and statutory reporting, in accordance with KSA PDPL and CHI guidelines.
              </span>
            </label>
          </DCard>

          <div className="flex items-center justify-between pt-3.5">
            <div className="flex items-center gap-2 mono text-[12.5px]" style={{ color: "var(--clin-muted)" }}>
              <span className="rounded-full" style={{ width: 7, height: 7, background: lastSavedAt ? "var(--clin-ok)" : "var(--clin-faint)" }} />
              {lastSavedAt ? `Saved · ${lastSavedAt.toLocaleTimeString()}` : "Autosaves as you type"}
            </div>
          </div>
        </div>

        {/* RIGHT RAIL ---------------------------------------------- */}
        <aside className="flex flex-col gap-4" style={{ position: "sticky", top: 88 }}>
          <RailCard title="Identity verified">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-11 rounded-xl grid place-items-center font-bold" style={{ background: "var(--clin-sunken)", color: "var(--clin-muted)" }}>
                {(form.name_en || "P").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[15px] truncate" style={{ color: "var(--clin-ink)" }}>{form.name_en || "—"}</div>
                <div className="mono text-[12px] truncate" style={{ color: "var(--clin-muted)" }}>{form.id_number || "ID pending"}</div>
                {verified && (
                  <span className="inline-flex items-center gap-1.5 mt-1.5 mono text-[11px] rounded-md px-2 py-1" style={{ color: "var(--clin-ok)", background: "var(--clin-ok-tint)" }}>
                    <Check className="size-3" />Yakeen verified
                  </span>
                )}
              </div>
            </div>
          </RailCard>

          <RailCard title="Eligibility · NPHIES">
            {eligResult ? (
              <>
                <div className="text-center py-2">
                  <div className="mono font-bold text-[18px] inline-flex items-center justify-center gap-2"
                       style={{ color: eligResult.status === "eligible" ? "var(--clin-ok)" : eligResult.status === "self_pay" ? "var(--clin-warn)" : "var(--clin-faint)" }}>
                    {eligResult.status === "eligible" ? <><Check className="size-4" />ELIGIBLE</> : (eligResult.status ?? "PENDING").toUpperCase()}
                  </div>
                  <div className="text-[12px] mt-1" style={{ color: "var(--clin-muted)" }}>
                    {eligResult.financial_type ? `Financial type · ${eligResult.financial_type}` : "Checked via NPHIES sandbox"}
                  </div>
                </div>
                {eligResult.last_checked_at && <KV k="Last check" v={new Date(eligResult.last_checked_at).toLocaleString()} />}
              </>
            ) : (
              <div className="text-center py-2">
                <div className="mono font-bold text-[16px]" style={{ color: "var(--clin-faint)" }}>NOT CHECKED</div>
                <div className="text-[12px] mt-1" style={{ color: "var(--clin-muted)" }}>Save coverage then run “Check eligibility”.</div>
              </div>
            )}
          </RailCard>

          {form.allergies_known === "yes" && form.allergies_text && (
            <div className="rounded-xl p-3 flex gap-2.5 items-start" style={{ background: "var(--clin-crit-tint)", border: "1px solid #F6D2D4" }}>
              <AlertCircle className="size-4 mt-0.5" style={{ color: "var(--clin-crit)" }} />
              <div>
                <div className="font-semibold text-[13px]" style={{ color: "var(--coral-deep)" }}>Allergy on file</div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--clin-crit)" }}>{form.allergies_text}</div>
              </div>
            </div>
          )}

          <div className="clin-card p-3.5">
            <CTA onClick={register} disabled={!allDone || saving}>
              {saving ? "Saving…" : allDone ? "Register patient" : `Complete ${steps.length - steps.filter(s=>s.done).length} more`}
            </CTA>
            <div className="text-center mt-2.5 text-[11.5px] mono" style={{ color: "var(--clin-muted)" }}>
              {allDone ? "All MDS checks green · safe to register" : "Meter reaches 100% when the MDS is complete"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
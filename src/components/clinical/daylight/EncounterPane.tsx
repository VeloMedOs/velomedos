import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Activity, Stethoscope, RefreshCw, Plus, Hospital, Heart, Wind, Droplet, Thermometer, Wand2, FileText, Save, ShieldCheck, ListChecks } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { DCard, RailCard, KV, Field, CTA } from "./Primitives";
import { PatientBanner, type BannerPatient } from "./PatientBanner";
import { DiagnosisRail, type DxRow } from "./DiagnosisRail";
import { VitalsLegend } from "./VitalsLegend";
import { DischargePanel } from "./DischargePanel";
import { classify, worstTone, type Tone } from "@/lib/clinical/vital-ranges";
import { CC_TEMPLATES } from "@/lib/clinical/cc-templates";

type Enc = { id: string; class: string; status: string; journey_state: string; reimbursement_model: string; beneficiary_id: string; started_at: string };
type Vital = {
  id: string; recorded_at?: string;
  systolic_mmhg?: number | null; diastolic_mmhg?: number | null;
  heart_rate_bpm?: number | null; respiratory_rate_bpm?: number | null;
  spo2_pct?: number | null; temperature_c?: number | null;
};

/**
 * Daylight encounter workspace.
 * Left rail: encounter list. Center: patient banner + vitals tiles + diagnoses
 * + journey controls. Right rail: encounter context.
 */
export function EncounterPane() {
  const [list, setList] = useState<Enc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enc, setEnc] = useState<any | null>(null);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [dx, setDx] = useState<DxRow[]>([]);
  const [charges, setCharges] = useState<any[]>([]);
  const [drg, setDrg] = useState<any | null>(null);
  const [elig, setElig] = useState<any | null>(null);
  const [busy, setBusy] = useState<null | "admit" | "discharge" | "sign" | "eligibility">(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const ccDraft = useRef("");

  async function refreshList() {
    try {
      const r = await ClinicalAPI.listEncounters();
      const arr = r.data as Enc[];
      setList(arr);
      if (!selectedId && arr[0]) setSelectedId(arr[0].id);
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }
  useEffect(() => { refreshList(); /* eslint-disable-next-line */ }, []);

  async function loadEnc(id: string) {
    try {
      const [encRes, vitalsRes, dxRes, chgRes, drgRes, eligRes] = await Promise.all([
        ClinicalAPI.getEncounter(id),
        ClinicalAPI.clinicalFetchVitals?.(id) ?? fetchVitalsViaApi(id),
        ClinicalAPI.listDiagnoses(id).catch(() => ({ data: [] as DxRow[] })),
        ClinicalAPI.listCharges(id).catch(() => ({ data: { charges: [], totals: {}, currency: "SAR" } as any })),
        ClinicalAPI.getDrg(id).catch(() => ({ data: { current: null, history: [] } })),
        ClinicalAPI.listEligibility({ encounter_id: id }).catch(() => ({ data: [] })),
      ]);
      const d: any = encRes.data;
      setEnc(d);
      setVitals(((vitalsRes as any)?.data ?? []) as Vital[]);
      setDx((dxRes as any).data as DxRow[]);
      const ch = (chgRes as any).data;
      setCharges(Array.isArray(ch) ? ch : (ch?.charges ?? []));
      setDrg((drgRes as any).data?.current ?? null);
      const eligRows = (eligRes as any).data as any[];
      setElig(eligRows.length > 0 ? eligRows[0] : null);
      const cc = d?.chief_complaint ?? "";
      setChiefComplaint(cc); ccDraft.current = cc;
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }
  useEffect(() => { if (selectedId) loadEnc(selectedId); }, [selectedId]);

  const latest = vitals[vitals.length - 1];
  const vitalTones: Tone[] = useMemo(() => {
    if (!latest) return [];
    return [
      classify("hr", latest.heart_rate_bpm ?? null),
      classify("sbp", latest.systolic_mmhg ?? null),
      classify("dbp", latest.diastolic_mmhg ?? null),
      classify("spo2", latest.spo2_pct ?? null),
      classify("temp_c", latest.temperature_c ?? null),
      classify("rr", latest.respiratory_rate_bpm ?? null),
    ];
  }, [latest]);

  // Encounter MDS — chief complaint, ≥1 vitals reading, ≥1 primary diagnosis,
  // disposition (separation_mode set on discharge). Mirrors §6.
  const mdsSteps = useMemo(() => {
    const hasPrimary = dx.some((d) => d.role === "principal" || d.rank === 1 || d.rank === "1");
    return [
      { id: "cc", label: "Chief complaint", done: !!(chiefComplaint && chiefComplaint.trim().length > 2) },
      { id: "vitals", label: "Vitals", done: vitals.length > 0 },
      { id: "dx", label: "Primary diagnosis", done: hasPrimary },
      { id: "disp", label: "Disposition", done: !!enc?.separation_mode || enc?.journey_state === "discharged" },
    ];
  }, [chiefComplaint, vitals.length, dx, enc?.separation_mode, enc?.journey_state]);
  const mdsPct = Math.round((mdsSteps.filter((s) => s.done).length / mdsSteps.length) * 100);

  const banner: BannerPatient | null = enc?.beneficiary
    ? {
        full_name: enc.beneficiary.full_name ?? "Patient",
        mrn: enc.beneficiary.mrn ?? enc.beneficiary.id?.slice(0, 8),
        document_id: enc.beneficiary.document_id,
        sex: enc.beneficiary.sex,
        age_years: enc.beneficiary.date_of_birth ? Math.floor((Date.now() - new Date(enc.beneficiary.date_of_birth).getTime()) / (365.25 * 86400e3)) : null,
        allergies: enc.beneficiary.allergies ?? [],
        coverage_label: enc.coverage?.payer_name ? `${enc.coverage.payer_name} · ${enc.coverage.status ?? "eligible"}` : null,
        coverage_status: (enc.coverage?.status as any) ?? "eligible",
        encounter_label: `${enc.class?.toUpperCase()} · ${enc.journey_state}`,
        mds_pct: mdsPct,
      }
    : null;

  async function saveChiefComplaint(next: string) {
    if (!enc) return;
    const trimmed = next.trim();
    if (trimmed === (enc.chief_complaint ?? "").trim()) return;
    try {
      await ClinicalAPI.updateEncounter(enc.id, { chief_complaint: trimmed || null });
      setEnc((e: any) => ({ ...(e ?? {}), chief_complaint: trimmed }));
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }

  async function admit() {
    if (!enc) return;
    const can = enc.class === "IMP" || enc.class === "inpatient";
    const allowed = ["registered", "encounter_open", "clinically_documented"].includes(enc.journey_state);
    if (!can) return toast.error("Admit is only available on inpatient encounters");
    if (!allowed) return toast.error(`Cannot admit from ${enc.journey_state}`);
    setBusy("admit");
    const prev = enc;
    setEnc({ ...enc, journey_state: "admitted" });
    try { await ClinicalAPI.admit(enc.id, { admit_source: "emergency" }); toast.success("Admitted"); loadEnc(enc.id); }
    catch (e) { setEnc(prev); if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function runEligibility() {
    if (!enc) return;
    if (!enc.coverage_id) return toast.error("No coverage attached to this encounter");
    setBusy("eligibility");
    try {
      const r = await ClinicalAPI.checkEligibility({
        beneficiary_id: enc.beneficiary_id,
        coverage_id: enc.coverage_id,
        encounter_id: enc.id,
      });
      setElig((r as any).data);
      toast.success("Eligibility checked");
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "320px minmax(0,1fr)", minHeight: "calc(100vh - 60px)" }}>
      {/* LEFT — encounter list */}
      <aside className="border-r" style={{ borderColor: "var(--hairline)", background: "var(--clin-raised)" }}>
        <div className="flex items-center justify-between px-4 py-3 sticky top-[60px] z-[8]" style={{ background: "var(--clin-raised)", borderBottom: "1px solid var(--hairline)" }}>
          <div>
            <div className="mono uppercase text-[10px] tracking-[0.12em]" style={{ color: "var(--clin-faint)" }}>Encounters</div>
            <div className="font-semibold text-[14px]" style={{ color: "var(--clin-ink)" }}>Today's caseload</div>
          </div>
          <button onClick={refreshList} className="size-8 rounded-lg grid place-items-center" style={{ background: "#fff", border: "1px solid var(--hairline)", color: "var(--clin-muted)" }} aria-label="Refresh">
            <RefreshCw className="size-4" />
          </button>
        </div>
        <div>
          {list.length === 0 && <div className="p-4 text-[12.5px]" style={{ color: "var(--clin-muted)" }}>No encounters open.</div>}
          {list.map((e) => {
            const on = e.id === selectedId;
            return (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className="w-full text-left px-4 py-3 flex flex-col gap-1 transition"
                style={{
                  background: on ? "var(--clin-teal-tint)" : "transparent",
                  borderLeft: `3px solid ${on ? "var(--teal)" : "transparent"}`,
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="mono uppercase text-[10px] tracking-[0.12em]" style={{ color: on ? "var(--teal)" : "var(--clin-muted)" }}>{e.class}</span>
                  <span className="mono text-[10.5px]" style={{ color: "var(--clin-faint)" }}>{new Date(e.started_at).toLocaleDateString()}</span>
                </div>
                <div className="text-[13px] font-medium" style={{ color: "var(--clin-ink)" }}>#{e.id.slice(0, 8)}</div>
                <div className="text-[12px]" style={{ color: "var(--clin-muted)" }}>{e.journey_state} · {e.reimbursement_model}</div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* CENTER */}
      <div className="min-w-0">
        {banner && <PatientBanner p={banner} />}

        {!enc ? (
          <div className="p-10 text-[13px]" style={{ color: "var(--clin-muted)" }}>Pick an encounter on the left.</div>
        ) : (
          <div className="grid gap-5 p-7" style={{ gridTemplateColumns: "minmax(0,1fr) 340px", alignItems: "start" }}>
            <div>
              {/* Presenting complaint --------------------------------------- */}
              <DCard title="Presenting complaint" icon={FileText} caption="Inline-edit · autosaves on blur">
                <div className="flex flex-wrap gap-2 mb-3">
                  {CC_TEMPLATES.map((g) => (
                    <details key={g.key} className="rounded-lg" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
                      <summary className="cursor-pointer list-none px-2.5 py-1.5 inline-flex items-center gap-1.5 mono text-[11px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
                        <Wand2 className="size-3" />{g.label}
                      </summary>
                      <div className="px-2 py-1.5 flex flex-col gap-1">
                        {g.items.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="text-left text-[12.5px] px-2 py-1 rounded hover:bg-white"
                            style={{ color: "var(--clin-ink)" }}
                            onClick={() => {
                              const sep = chiefComplaint.trim() ? "\n\n" : "";
                              const next = `${t.body}${sep}${chiefComplaint}`;
                              setChiefComplaint(next); ccDraft.current = next;
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
                <textarea
                  className="clin-ctrl w-full"
                  rows={4}
                  value={chiefComplaint}
                  onChange={(e) => { setChiefComplaint(e.target.value); ccDraft.current = e.target.value; }}
                  onBlur={() => saveChiefComplaint(ccDraft.current)}
                  placeholder="Patient reports…"
                />
              </DCard>

              {/* Three-Second vitals row */}
              <DCard
                title="Three-second scan · vitals"
                icon={Activity}
                caption={latest?.recorded_at ? new Date(latest.recorded_at).toLocaleString() : "No readings yet"}
                status={
                  <span className={`clin-pill ${worstTone(vitalTones) === "crit" ? "crit" : worstTone(vitalTones) === "warn" ? "warn" : "ok"}`}>
                    {worstTone(vitalTones).toUpperCase()}
                  </span>
                }
              >
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  <VitalTile icon={Heart}      label="Heart rate" unit="bpm"
                    value={latest?.heart_rate_bpm ?? null} tone={classify("hr", latest?.heart_rate_bpm ?? null)} />
                  <VitalTile icon={Wind}       label="Blood pressure" unit="mmHg"
                    value={latest?.systolic_mmhg && latest?.diastolic_mmhg ? `${latest.systolic_mmhg}/${latest.diastolic_mmhg}` : null}
                    tone={worstTone([classify("sbp", latest?.systolic_mmhg ?? null), classify("dbp", latest?.diastolic_mmhg ?? null)])} />
                  <VitalTile icon={Droplet}    label="SpO₂" unit="%"
                    value={latest?.spo2_pct ?? null} tone={classify("spo2", latest?.spo2_pct ?? null)} />
                  <VitalTile icon={Thermometer} label="Temp" unit="°C"
                    value={latest?.temperature_c ?? null} tone={classify("temp_c", latest?.temperature_c ?? null)} />
                  <VitalTile icon={Wind}       label="Resp rate" unit="/min"
                    value={latest?.respiratory_rate_bpm ?? null} tone={classify("rr", latest?.respiratory_rate_bpm ?? null)} />
                </div>
                <div className="mt-3"><VitalsLegend /></div>
                <VitalsRecorder encId={enc.id} onSaved={(v) => setVitals((s) => [...s, v])} />
              </DCard>

              {/* Diagnoses */}
              <DCard title="Diagnoses" icon={Stethoscope} caption="ICD-10-AM · search, rank, remove">
                <DiagnosisRail encId={enc.id} rows={dx} onChange={setDx} />
              </DCard>

              {/* Procedures & orders --------------------------------------- */}
              <DCard
                title="Procedures & orders"
                icon={ListChecks}
                caption="ACHI / SBS — charged on this encounter"
              >
                {charges.length === 0 ? (
                  <span className="text-[12.5px]" style={{ color: "var(--clin-muted)" }}>No procedures charged yet.</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {charges.map((c) => (
                      <span key={c.id} className="rounded-lg px-2.5 py-1.5 inline-flex items-center gap-2" style={{ background: "var(--clin-teal-tint)", color: "var(--teal)" }}>
                        <span className="mono font-bold text-[12px]">{c.code ?? c.service_code ?? "—"}</span>
                        <span className="text-[12.5px]">{c.display ?? c.description ?? ""}</span>
                        {c.quantity != null && <span className="mono text-[10px] opacity-70">×{c.quantity}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </DCard>
            </div>

            <aside className="flex flex-col gap-4" style={{ position: "sticky", top: 130 }}>
              <RailCard title="Encounter">
                <KV k="Class" v={enc.class?.toUpperCase()} />
                <KV k="Journey" v={enc.journey_state} tone={enc.journey_state === "discharged" ? "ok" : "info"} />
                <KV k="Reimbursement" v={enc.reimbursement_model} />
                <KV k="Started" v={new Date(enc.started_at).toLocaleString()} />
              </RailCard>

              <RailCard title="Encounter MDS · CHI">
                <KV k="Completeness" v={`${mdsPct}%`} tone={mdsPct === 100 ? "ok" : "warn"} />
                {mdsSteps.map((s) => (
                  <KV key={s.id} k={s.label} v={s.done ? "✓" : "—"} tone={s.done ? "ok" : undefined} />
                ))}
              </RailCard>

              <RailCard title="Coding · DRG grouping">
                {drg ? (
                  <>
                    <KV k="DRG" v={drg.drg_code ?? drg.code ?? "—"} tone="info" />
                    {drg.drg_label && <KV k="Label" v={drg.drg_label} />}
                    {drg.weight != null && <KV k="Weight" v={String(drg.weight)} />}
                    {drg.grouper_version && <KV k="Grouper" v={drg.grouper_version} />}
                  </>
                ) : (
                  <div className="text-[12.5px]" style={{ color: "var(--clin-muted)" }}>
                    Not yet grouped. Complete coding, then run the grouper from the Coding · DRG tab.
                  </div>
                )}
              </RailCard>

              <RailCard title="NPHIES eligibility">
                {elig ? (
                  <>
                    <KV k="Status" v={elig.status ?? "—"} tone={elig.status === "eligible" ? "ok" : elig.status === "self_pay" ? "warn" : "info"} />
                    {elig.financial_type && <KV k="Financial type" v={elig.financial_type} />}
                    {elig.last_checked_at && <KV k="Last check" v={new Date(elig.last_checked_at).toLocaleString()} />}
                  </>
                ) : (
                  <div className="text-[12.5px] mb-2" style={{ color: "var(--clin-muted)" }}>No eligibility on file for this encounter.</div>
                )}
                <button
                  disabled={busy === "eligibility" || !enc.coverage_id}
                  onClick={runEligibility}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-semibold text-[12.5px] disabled:opacity-60"
                  style={{ background: "var(--clin-info-tint)", color: "var(--clin-info)" }}
                >
                  <ShieldCheck className="size-3.5" />{busy === "eligibility" ? "Checking…" : "Check eligibility"}
                </button>
              </RailCard>

              <RailCard title="Journey actions">
                <div className="flex flex-col gap-2">
                  {(enc.class === "IMP" || enc.class === "inpatient") &&
                    ["registered", "encounter_open", "clinically_documented"].includes(enc.journey_state) && (
                    <CTA disabled={busy === "admit"} onClick={admit}>
                      <span className="inline-flex items-center gap-2"><Hospital className="size-4" />{busy === "admit" ? "Admitting…" : "Admit"}</span>
                    </CTA>
                  )}
                  {["admitted", "active"].includes(enc.journey_state) && (
                    <DischargePanel encId={enc.id} onDone={() => { loadEnc(enc.id); refreshList(); }} />
                  )}
                  <button
                    disabled={busy === "sign"}
                    onClick={async () => {
                      if (!enc) return;
                      setBusy("sign");
                      try {
                        await ClinicalAPI.updateEncounter(enc.id, { chief_complaint: chiefComplaint || null });
                        toast.success("Encounter saved");
                      } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
                      finally { setBusy(null); }
                    }}
                    className="w-full rounded-xl py-2.5 font-semibold text-sm inline-flex items-center justify-center gap-2"
                    style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)", color: "var(--clin-ink)" }}
                  >
                    <Save className="size-4" />{busy === "sign" ? "Saving…" : "Save & sign"}
                  </button>
                </div>
              </RailCard>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/** Helper — direct GET via the existing pattern; encapsulated to keep
 * components fetch-free. */
async function fetchVitalsViaApi(encId: string): Promise<{ data: any[] }> {
  const url = `/api/clinical/v1/encounters/${encId}/vitals`;
  // Reuse the same auth/error pipeline as ClinicalAPI by delegating through
  // the typed clinicalFetch import.
  const { clinicalFetch } = await import("@/lib/clinical-api");
  return clinicalFetch<{ data: any[] }>(url);
}

function VitalTile({ icon: Icon, label, value, unit, tone }: { icon: any; label: string; value: any; unit: string; tone: "ok" | "warn" | "crit" }) {
  const map = {
    ok:   { bg: "var(--clin-ok-tint)",   fg: "var(--clin-ok)" },
    warn: { bg: "var(--clin-warn-tint)", fg: "var(--clin-warn)" },
    crit: { bg: "var(--clin-crit-tint)", fg: "var(--clin-crit)" },
  };
  const t = map[tone];
  const has = value != null && value !== "";
  return (
    <div className="rounded-xl p-3.5" style={{ background: has ? t.bg : "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" style={{ color: has ? t.fg : "var(--clin-faint)" }} />
        <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>{label}</span>
      </div>
      <div className="mono font-bold mt-1.5" style={{ color: has ? t.fg : "var(--clin-faint)", fontSize: 22, lineHeight: 1.1 }}>
        {has ? value : "—"} <span className="text-[11px] font-medium" style={{ color: "var(--clin-muted)" }}>{has ? unit : ""}</span>
      </div>
    </div>
  );
}

function VitalsRecorder({ encId, onSaved }: { encId: string; onSaved: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ systolic: "", diastolic: "", heart_rate: "", spo2: "", temperature_c: "", respiratory_rate: "" });
  async function save() {
    try {
      const body = {
        systolic_mmhg: form.systolic ? Number(form.systolic) : null,
        diastolic_mmhg: form.diastolic ? Number(form.diastolic) : null,
        heart_rate_bpm: form.heart_rate ? Number(form.heart_rate) : null,
        spo2_pct: form.spo2 ? Number(form.spo2) : null,
        temperature_c: form.temperature_c ? Number(form.temperature_c) : null,
        respiratory_rate_bpm: form.respiratory_rate ? Number(form.respiratory_rate) : null,
      };
      const r = await ClinicalAPI.addVitals(encId, body);
      toast.success("Vitals recorded");
      onSaved({ ...(r.data ?? {}), ...body, recorded_at: new Date().toISOString() });
      setForm({ systolic: "", diastolic: "", heart_rate: "", spo2: "", temperature_c: "", respiratory_rate: "" });
      setOpen(false);
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }
  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-[12.5px]" style={{ background: "var(--clin-teal-tint)", color: "var(--teal)" }}>
      <Plus className="size-4" />Record vitals
    </button>
  );
  return (
    <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
      <Field label="Systolic"><input className="clin-ctrl mono" inputMode="numeric" value={form.systolic} onChange={(e) => setForm({ ...form, systolic: e.target.value })} /></Field>
      <Field label="Diastolic"><input className="clin-ctrl mono" inputMode="numeric" value={form.diastolic} onChange={(e) => setForm({ ...form, diastolic: e.target.value })} /></Field>
      <Field label="Heart rate"><input className="clin-ctrl mono" inputMode="numeric" value={form.heart_rate} onChange={(e) => setForm({ ...form, heart_rate: e.target.value })} /></Field>
      <Field label="SpO₂"><input className="clin-ctrl mono" inputMode="numeric" value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} /></Field>
      <Field label="Temp °C"><input className="clin-ctrl mono" inputMode="decimal" value={form.temperature_c} onChange={(e) => setForm({ ...form, temperature_c: e.target.value })} /></Field>
      <Field label="Resp rate"><input className="clin-ctrl mono" inputMode="numeric" value={form.respiratory_rate} onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })} /></Field>
      <div className="col-span-3 flex gap-2">
        <button onClick={save} className="rounded-lg px-4 py-2 font-semibold text-sm text-white" style={{ background: "var(--teal)" }}>Save reading</button>
        <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm" style={{ border: "1px solid var(--hairline)", color: "var(--clin-text)" }}>Cancel</button>
      </div>
    </div>
  );
}

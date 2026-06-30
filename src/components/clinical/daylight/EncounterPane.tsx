import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, Stethoscope, RefreshCw, Plus, Hospital, CheckCircle2, Heart, Wind, Droplet, Thermometer } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { DCard, RailCard, KV, Field, CTA } from "./Primitives";
import { PatientBanner, type BannerPatient } from "./PatientBanner";

type Enc = { id: string; class: string; status: string; journey_state: string; reimbursement_model: string; beneficiary_id: string; started_at: string };
type Vital = { id: string; recorded_at?: string; systolic_bp?: number | null; diastolic_bp?: number | null; heart_rate?: number | null; spo2?: number | null; temperature_c?: number | null; respiratory_rate?: number | null };
type Dx = { id: string; code: string; display?: string | null; rank?: string | null; role?: string | null };

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
  const [dx, setDx] = useState<Dx[]>([]);
  const [busy, setBusy] = useState(false);

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
      const r = await ClinicalAPI.getEncounter(id);
      const d: any = r.data;
      setEnc(d);
      setVitals(d.vitals ?? []);
      setDx(d.diagnoses ?? []);
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }
  useEffect(() => { if (selectedId) loadEnc(selectedId); }, [selectedId]);

  const latest = vitals[vitals.length - 1];
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
      }
    : null;

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
          <div className="grid gap-5 p-7" style={{ gridTemplateColumns: "minmax(0,1fr) 320px", alignItems: "start" }}>
            <div>
              {/* Three-Second vitals row */}
              <DCard title="Vitals · last reading" icon={Activity} caption={latest?.recorded_at ? new Date(latest.recorded_at).toLocaleString() : "No readings yet"}>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  <VitalTile icon={Heart}      label="Heart rate" unit="bpm"
                    value={latest?.heart_rate ?? null} tone={tone(latest?.heart_rate, 60, 100)} />
                  <VitalTile icon={Wind}       label="Blood pressure" unit="mmHg"
                    value={latest?.systolic_bp && latest?.diastolic_bp ? `${latest.systolic_bp}/${latest.diastolic_bp}` : null}
                    tone={tone(latest?.systolic_bp, 90, 140)} />
                  <VitalTile icon={Droplet}    label="SpO₂" unit="%"
                    value={latest?.spo2 ?? null} tone={latest?.spo2 != null && latest.spo2 < 92 ? "crit" : latest?.spo2 != null && latest.spo2 < 95 ? "warn" : "ok"} />
                  <VitalTile icon={Thermometer} label="Temp" unit="°C"
                    value={latest?.temperature_c ?? null} tone={tone(latest?.temperature_c, 36, 37.8)} />
                  <VitalTile icon={Wind}       label="Resp rate" unit="/min"
                    value={latest?.respiratory_rate ?? null} tone={tone(latest?.respiratory_rate, 12, 20)} />
                </div>
                <VitalsRecorder encId={enc.id} onSaved={(v) => setVitals((s) => [...s, v])} />
              </DCard>

              {/* Diagnoses */}
              <DCard title="Diagnoses" icon={Stethoscope} caption="ICD-10-AM · coded">
                <div className="flex flex-wrap gap-2 mb-4">
                  {dx.length === 0 && <span className="text-[12.5px]" style={{ color: "var(--clin-muted)" }}>No diagnoses recorded.</span>}
                  {dx.map((d) => (
                    <span key={d.id} className="rounded-lg px-2.5 py-1.5 inline-flex items-center gap-2" style={{ background: "var(--clin-info-tint)", color: "var(--clin-info)" }}>
                      <span className="mono font-bold text-[12px]">{d.code}</span>
                      <span className="text-[12.5px]">{d.display ?? ""}</span>
                      {d.rank && <span className="mono text-[10px] uppercase opacity-70">· {d.rank}</span>}
                    </span>
                  ))}
                </div>
                <DiagnosisAdder encId={enc.id} onAdded={(d) => setDx((s) => [...s, d])} />
              </DCard>
            </div>

            <aside className="flex flex-col gap-4" style={{ position: "sticky", top: 130 }}>
              <RailCard title="Encounter">
                <KV k="Class" v={enc.class?.toUpperCase()} />
                <KV k="Journey" v={enc.journey_state} tone={enc.journey_state === "discharged" ? "ok" : "info"} />
                <KV k="Reimbursement" v={enc.reimbursement_model} />
                <KV k="Started" v={new Date(enc.started_at).toLocaleString()} />
              </RailCard>

              <RailCard title="Journey">
                <div className="flex flex-col gap-2">
                  {enc.class === "inpatient" && !["admitted","discharged"].includes(enc.journey_state) && (
                    <CTA
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try { await ClinicalAPI.admit(enc.id, { admit_source: "emergency" }); toast.success("Admitted"); loadEnc(enc.id); }
                        catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
                        finally { setBusy(false); }
                      }}>
                      <span className="inline-flex items-center gap-2"><Hospital className="size-4" />Admit</span>
                    </CTA>
                  )}
                  {["admitted","active"].includes(enc.journey_state) && (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try { await ClinicalAPI.discharge(enc.id, { discharge_disposition: "home", separation_mode: "routine" }); toast.success("Discharged"); loadEnc(enc.id); refreshList(); }
                        catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
                        finally { setBusy(false); }
                      }}
                      className="w-full rounded-xl py-2.5 font-semibold text-sm"
                      style={{ background: "var(--clin-ok)", color: "#fff" }}>
                      <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4" />Discharge</span>
                    </button>
                  )}
                </div>
              </RailCard>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function tone(v: number | null | undefined, lo: number, hi: number): "ok" | "warn" | "crit" {
  if (v == null) return "ok";
  if (v < lo * 0.85 || v > hi * 1.15) return "crit";
  if (v < lo || v > hi) return "warn";
  return "ok";
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
        systolic_bp: form.systolic ? Number(form.systolic) : null,
        diastolic_bp: form.diastolic ? Number(form.diastolic) : null,
        heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
        spo2: form.spo2 ? Number(form.spo2) : null,
        temperature_c: form.temperature_c ? Number(form.temperature_c) : null,
        respiratory_rate: form.respiratory_rate ? Number(form.respiratory_rate) : null,
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

function DiagnosisAdder({ encId, onAdded }: { encId: string; onAdded: (d: any) => void }) {
  const [code, setCode] = useState("");
  const [display, setDisplay] = useState("");
  const [rank, setRank] = useState<"principal" | "secondary">("secondary");
  async function add() {
    if (!code) return toast.error("Diagnosis code required (ICD-10-AM)");
    try {
      const r = await ClinicalAPI.addDiagnosis(encId, { code, display, rank, role: "discharge" });
      toast.success("Diagnosis added");
      onAdded({ ...(r.data ?? {}), code, display, rank });
      setCode(""); setDisplay("");
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "140px 1fr 130px auto" }}>
      <Field label="ICD code"><input className="clin-ctrl mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="J18.9" /></Field>
      <Field label="Display"><input className="clin-ctrl" value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="Pneumonia, unspecified organism" /></Field>
      <Field label="Rank">
        <select className="clin-ctrl" value={rank} onChange={(e) => setRank(e.target.value as any)}>
          <option value="principal">principal</option><option value="secondary">secondary</option>
        </select>
      </Field>
      <div className="flex items-end">
        <button onClick={add} className="rounded-lg px-4 py-2.5 font-semibold text-sm text-white" style={{ background: "var(--teal)" }}>Add</button>
      </div>
    </div>
  );
}
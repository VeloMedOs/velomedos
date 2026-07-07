/**
 * ClinicalForm host — Dev Spec §5 / DoD C6.
 *
 * Reads `clinical_form_instance` + `form_def`, renders each field via a
 * FIELD_RENDERERS registry (correction Y6: Turn 3's Form Builder must edit
 * the same schema and see the same field types), and enforces the
 * cross-cutting behaviours:
 *   - paste-highlight yellow (persisted in paste_ranges)
 *   - meaning validation on submit (rejects lone "." / non-alphanumeric)
 *   - addendum-not-amend after submit/cosign
 *   - print empty form with mandatory placeholders
 *   - MAP compute (both SBP + DBP required)
 *   - pregnancy-mandatory for females 15-55
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Printer, Save, Send } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { validateMandatoryMeaning } from "@/lib/clinical/form-validation";
import { PasteHighlightField, type PasteRange } from "./PasteHighlightField";
import { AddendumEditor, type Addendum } from "./AddendumEditor";
import { printEmptyForm } from "./PrintEmptyForm";
import { MapField } from "./fields/MapField";
import { FallRiskField } from "./fields/FallRiskField";
import { PregnancyMandatoryField } from "./fields/PregnancyMandatoryField";

type FieldDef = {
  id: string;
  label: string;
  type: string; // text | textarea | boolean | number | map | fall_risk | pregnancy | select
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  instruments?: Array<{ code: string; label: string }>;
};

type Ctx = {
  gender?: string | null;
  ageYears?: number | null;
};

/**
 * Field renderer registry. Turn 3's Form Builder edits form_def.schema; every
 * field type known here must round-trip through the builder's field-type
 * dropdown.
 */
const FIELD_RENDERERS: Record<string, (props: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  pasteRanges: PasteRange[];
  onPasteRanges: (r: PasteRange[]) => void;
  disabled?: boolean;
  ctx: Ctx;
}) => React.ReactNode> = {
  text: ({ field, value, onChange, disabled }) => (
    <input className="clin-ctrl w-full" type="text" disabled={disabled}
      value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
  ),
  string: (p) => FIELD_RENDERERS.text(p),
  textarea: ({ field, value, onChange, pasteRanges, onPasteRanges, disabled }) => (
    <PasteHighlightField
      fieldId={field.id}
      value={(value as string) ?? ""}
      onChange={onChange}
      ranges={pasteRanges}
      onRangesChange={onPasteRanges}
      disabled={disabled}
    />
  ),
  boolean: ({ value, onChange, disabled }) => (
    <label className="inline-flex items-center gap-2 text-[12.5px]">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      Yes
    </label>
  ),
  number: ({ value, onChange, disabled }) => (
    <input className="clin-ctrl mono" type="number" disabled={disabled}
      value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} />
  ),
  select: ({ field, value, onChange, disabled }) => (
    <select className="clin-ctrl" value={(value as string) ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>Select</option>
      {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
  map: ({ value, onChange, disabled }) => {
    const v = (value as { sbp: number | null; dbp: number | null } | undefined) ?? { sbp: null, dbp: null };
    return (
      <MapField
        sbp={v.sbp} dbp={v.dbp}
        onChangeSbp={(sbp) => onChange({ ...v, sbp })}
        onChangeDbp={(dbp) => onChange({ ...v, dbp })}
      />
    );
  },
  fall_risk: ({ field, value, onChange, disabled }) => {
    const v = (value as { instrument: string | null; score: number | null } | undefined) ?? { instrument: null, score: null };
    return (
      <FallRiskField
        instruments={field.instruments ?? [{ code: "morse", label: "Morse" }, { code: "hendrich", label: "Hendrich II" }]}
        value={v.instrument}
        onChange={(instrument) => onChange({ ...v, instrument })}
        score={v.score}
        onChangeScore={(score) => onChange({ ...v, score })}
      />
    );
  },
  pregnancy: ({ value, onChange, ctx }) => (
    <PregnancyMandatoryField
      gender={ctx.gender ?? null}
      ageYears={ctx.ageYears ?? null}
      value={(value as string) ?? null}
      onChange={onChange}
    />
  ),
};

export function ClinicalForm({
  instanceId,
  ctx = {},
  onSubmitted,
}: {
  instanceId: string;
  ctx?: Ctx;
  onSubmitted?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<any | null>(null);
  const [def, setDef] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [pasteRanges, setPasteRanges] = useState<Record<string, PasteRange[]>>({});
  const [busy, setBusy] = useState<"save" | "submit" | "addendum" | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await ClinicalAPI.getFormInstance(instanceId);
        const inst = (r.data as any)?.instance ?? r.data;
        setInstance(inst);
        setAnswers(inst?.answers ?? {});
        setPasteRanges((inst?.paste_ranges as Record<string, PasteRange[]>) ?? {});
        // form_def is either embedded or fetch via masters (best-effort)
        const inlineDef = (r.data as any)?.form_def;
        if (inlineDef) setDef(inlineDef);
        else {
          const list = await ClinicalAPI.listMaster("form-defs").catch(() => ({ data: [] as any[] }));
          setDef((list.data as any[]).find((d) => d.id === inst?.form_def_id) ?? null);
        }
      } catch (e) {
        if (e instanceof ClinicalApiError) toast.error(e.message);
      } finally { setLoading(false); }
    })();
  }, [instanceId]);

  const fields: FieldDef[] = useMemo(() => (def?.schema?.fields as FieldDef[]) ?? [], [def]);
  const locked = instance?.status === "submitted" || instance?.status === "cosigned";
  const addenda: Addendum[] = (instance?.addenda as Addendum[]) ?? [];

  function setAnswer(id: string, value: unknown) {
    setAnswers((a) => ({ ...a, [id]: value }));
    // Clear the issue for this field once the user edits.
    setIssues((prev) => { if (!prev[id]) return prev; const next = { ...prev }; delete next[id]; return next; });
  }

  function setRanges(id: string, r: PasteRange[]) {
    setPasteRanges((prev) => ({ ...prev, [id]: r }));
  }

  async function saveDraft() {
    if (!instance) return;
    setBusy("save");
    try {
      await ClinicalAPI.saveFormInstanceDraft(instance.id, { answers, paste_ranges: [pasteRanges] as unknown as unknown[] });
      toast.success("Draft saved");
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function submit() {
    if (!instance) return;
    // Client-side meaning validation — server enforces canonically.
    const meaningIssues = validateMandatoryMeaning(answers, fields);
    if (meaningIssues.length > 0) {
      const map: Record<string, string> = {};
      for (const i of meaningIssues) map[i.field] = i.message;
      setIssues(map);
      toast.error("Fill required fields with meaningful text.");
      return;
    }
    setBusy("submit");
    try {
      await ClinicalAPI.submitFormInstance(instance.id, { answers, paste_ranges: [pasteRanges] as unknown as unknown[] });
      toast.success("Form submitted");
      onSubmitted?.();
    } catch (e) {
      if (e instanceof ClinicalApiError) {
        if (e.code === "MEANING_INVALID") setIssues((e.payload as any)?.issues ?? {});
        toast.error(e.message);
      }
    } finally { setBusy(null); }
  }

  async function appendAddendum(body: string) {
    if (!instance) return;
    try { await ClinicalAPI.appendFormAddendum(instance.id, { body }); toast.success("Addendum appended"); }
    catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }

  if (loading) return <div className="p-6 text-[12.5px]" style={{ color: "var(--clin-muted)" }}>Loading form…</div>;
  if (!instance || !def) return <div className="p-6 text-[12.5px]" style={{ color: "var(--clin-muted)" }}>Form not found.</div>;

  return (
    <div className="clin-card p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4" style={{ color: "var(--clin-muted)" }} />
          <h2 className="text-[14.5px] font-semibold" style={{ color: "var(--clin-ink)" }}>{def.title}</h2>
          {locked && <span className="clin-pill info">Locked</span>}
        </div>
        <button
          type="button"
          onClick={() => printEmptyForm(def.title, fields)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px]"
          style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)", color: "var(--clin-ink)" }}
        >
          <Printer className="size-3.5" />Print empty form
        </button>
      </header>

      {locked ? (
        <div className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.id}>
              <div className="mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--clin-faint)" }}>{f.label}</div>
              <div className="text-[12.5px] whitespace-pre-wrap" style={{ color: "var(--clin-ink)" }}>
                {String(answers[f.id] ?? "—")}
              </div>
            </div>
          ))}
          <AddendumEditor original={JSON.stringify(answers)} addenda={addenda} locked={false} onAppend={appendAddendum} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {fields.map((f) => {
              const Renderer = FIELD_RENDERERS[f.type] ?? FIELD_RENDERERS.text;
              return (
                <div key={f.id}>
                  <label className="mono text-[10.5px] uppercase tracking-wide" htmlFor={f.id} style={{ color: "var(--clin-faint)" }}>
                    {f.label}{f.required && <span style={{ color: "var(--clin-crit)" }}> *</span>}
                  </label>
                  <Renderer
                    field={f}
                    value={answers[f.id]}
                    onChange={(v) => setAnswer(f.id, v)}
                    pasteRanges={pasteRanges[f.id] ?? []}
                    onPasteRanges={(r) => setRanges(f.id, r)}
                    ctx={ctx}
                  />
                  {issues[f.id] && (
                    <div className="text-[11px] mt-1" style={{ color: "var(--clin-crit)" }}>{issues[f.id]}</div>
                  )}
                </div>
              );
            })}
          </div>
          <footer className="mt-5 flex gap-2 justify-end">
            <button type="button" disabled={busy !== null} onClick={saveDraft}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold disabled:opacity-60"
              style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)", color: "var(--clin-ink)" }}>
              <Save className="size-3.5" />{busy === "save" ? "Saving…" : "Save draft"}
            </button>
            <button type="button" disabled={busy !== null} onClick={submit}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--teal)" }}>
              <Send className="size-3.5" />{busy === "submit" ? "Submitting…" : "Submit"}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
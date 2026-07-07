/**
 * Fall-risk field — accepts any instrument passed in from form_def (Morse,
 * Hendrich, or custom). Never Morse-only.
 */
export type FallRiskInstrument = { code: string; label: string; scale?: string };

export function FallRiskField({
  instruments, value, onChange, score, onChangeScore,
}: {
  instruments: FallRiskInstrument[];
  value: string | null;
  onChange: (code: string) => void;
  score: number | null;
  onChangeScore: (n: number | null) => void;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--clin-muted)" }}>
        Instrument
        <select className="clin-ctrl" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>Pick an instrument</option>
          {instruments.map((i) => (<option key={i.code} value={i.code}>{i.label}</option>))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--clin-muted)" }}>
        Score
        <input className="clin-ctrl mono" inputMode="numeric" value={score ?? ""} onChange={(e) => onChangeScore(e.target.value ? Number(e.target.value) : null)} />
      </label>
    </div>
  );
}
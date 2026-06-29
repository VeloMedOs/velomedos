import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export type SurveyItem = {
  id: string;
  label: string;
  type: "scale" | "number" | "single_choice";
  min?: number;
  max?: number;
  required?: boolean;
  domain?: string;
  options?: Array<{ value: number; label: string }>;
};

export type SurveySchema = {
  items: SurveyItem[];
  scoring: string;
};

/**
 * Stateless, accessible PROM/PREM renderer used by both the clinician scratchpad
 * and the patient portal. Answers are emitted as a plain numeric map.
 */
export function PromSurveyRenderer({
  schema,
  initial,
  disabled,
  onSubmit,
}: {
  schema: SurveySchema;
  initial?: Record<string, number>;
  disabled?: boolean;
  onSubmit: (answers: Record<string, number>) => Promise<void> | void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>(initial ?? {});
  const [busy, setBusy] = useState(false);

  const missingRequired = useMemo(
    () => schema.items.filter((i) => i.required && answers[i.id] === undefined).map((i) => i.id),
    [schema, answers],
  );

  function setAnswer(id: string, v: number) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  async function handleSubmit() {
    if (missingRequired.length || disabled) return;
    setBusy(true);
    try { await onSubmit(answers); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {schema.items.map((item) => (
        <div key={item.id} className="rounded-lg border border-hairline p-4 bg-card/40">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              {item.domain && (
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                  {item.domain}{item.required ? " · required" : ""}
                </div>
              )}
            </div>
            {answers[item.id] !== undefined && (
              <CheckCircle2 className="size-4 text-stable shrink-0" />
            )}
          </div>
          {renderControl(item, answers[item.id], (v) => setAnswer(item.id, v), disabled)}
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {schema.items.length - Object.keys(answers).length === 0
            ? "All items answered"
            : `${schema.items.length - Object.keys(answers).length} remaining`}
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || busy || missingRequired.length > 0}
          className="px-4 h-9 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground disabled:opacity-40"
        >
          {busy ? "Submitting…" : "Submit response"}
        </button>
      </div>
      {missingRequired.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-emergency">
          <AlertTriangle className="size-3" />
          {missingRequired.length} required item{missingRequired.length > 1 ? "s" : ""} missing
        </div>
      )}
    </div>
  );
}

function renderControl(
  item: SurveyItem,
  value: number | undefined,
  onChange: (v: number) => void,
  disabled?: boolean,
) {
  if (item.type === "single_choice" && item.options?.length) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {item.options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`text-left text-sm px-3 py-2 rounded border transition ${
              value === o.value
                ? "border-action bg-action/10 text-foreground"
                : "border-hairline hover:border-action/50 text-muted-foreground"
            }`}
          >
            <span className="mono text-[10px] uppercase tracking-widest mr-2 text-action">{o.value}</span>
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  if (item.type === "scale") {
    const min = item.min ?? 1;
    const max = item.max ?? 5;
    const range = Array.from({ length: max - min + 1 }, (_, i) => i + min);
    return (
      <div className="flex flex-wrap gap-2">
        {range.map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`size-9 rounded mono text-xs border transition ${
              value === v
                ? "border-action bg-action text-action-foreground"
                : "border-hairline hover:border-action/50 text-muted-foreground"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    );
  }
  return (
    <input
      type="number"
      disabled={disabled}
      min={item.min}
      max={item.max}
      value={value ?? ""}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
      className="w-32 h-9 px-3 rounded border border-hairline bg-card/60 text-sm"
    />
  );
}
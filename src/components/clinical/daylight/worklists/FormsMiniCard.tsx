/**
 * FormsMiniCard — encounter-scoped, classification-filtered open forms list.
 * Reads v_clinical_forms_worklist via worklistsApi.forms. Independent of HimCommCard.
 */
import { useEffect, useState } from "react";
import { worklistsApi, ClinicalApiError, type FormsWorklistRow, type FormClassification } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";

export function FormsMiniCard({
  encounterId, classification, maxRows = 5,
}: {
  encounterId: string;
  classification: FormClassification;
  maxRows?: number;
}) {
  const [rows, setRows] = useState<FormsWorklistRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await worklistsApi.forms({ encounter_id: encounterId, classification });
        if (!cancel) setRows((r.data ?? []).filter((f) =>
          f.status === "pending" || f.status === "in_progress" || f.status === "draft",
        ));
      } catch (e) {
        if (!cancel) setErr(e instanceof ClinicalApiError ? e.message : "Failed to load forms");
      }
    })();
    return () => { cancel = true; };
  }, [encounterId, classification]);

  const shown = rows.slice(0, maxRows);
  return (
    <DCard title="Open forms" caption={`${classification} · ${rows.length}`}>
      {err ? <div className="clin-pill crit">{err}</div> : null}
      {!shown.length ? (
        <div className="text-xs" style={{ color: "var(--clin-muted)" }}>No open forms.</div>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((f) => (
            <li key={f.instance_id} className="flex items-center justify-between text-xs">
              <a
                href={`/clinical?tab=forms-worklist&instance=${f.instance_id}`}
                className="truncate mr-2"
                style={{ color: "var(--clin-ink)", fontWeight: 600 }}
              >{f.title}</a>
              <span className={`clin-pill ${f.is_overdue ? "crit" : "muted"}`}>
                {f.is_overdue ? `${f.overdue_days ?? 0}d late` : f.status}
              </span>
            </li>
          ))}
          {rows.length > maxRows && (
            <li className="text-[10px] mono uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>
              +{rows.length - maxRows} more
            </li>
          )}
        </ul>
      )}
    </DCard>
  );
}
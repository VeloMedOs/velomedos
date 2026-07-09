import { AlertCircle, Baby, Shield, Stethoscope } from "lucide-react";

export type BannerPatient = {
  full_name: string;
  mrn?: string | null;
  document_id?: string | null;
  sex?: string | null;
  age_years?: number | null;
  allergies?: string[];
  coverage_label?: string | null;        // e.g. "Insurer A · Gold · ELIGIBLE"
  coverage_status?: "eligible" | "pending" | "ineligible" | null;
  encounter_label?: string | null;       // e.g. "OP · Cardiology · today"
  mds_pct?: number;                       // 0-100
  is_pregnant?: boolean;                  // HCA-0240 — active pregnancy episode
};

/**
 * Sticky one-line identity strip per HIS design system §5 (rule 2).
 * Never re-look up identity; allergies are always visible.
 */
export function PatientBanner({ p, sticky = true }: { p: BannerPatient; sticky?: boolean }) {
  const initials = p.full_name
    .split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "PT";
  const covTone =
    p.coverage_status === "eligible" ? "ok" :
    p.coverage_status === "ineligible" ? "crit" :
    p.coverage_status === "pending" ? "warn" : "muted";
  return (
    <div
      className="flex items-center gap-4 px-6 py-3"
      style={{
        background: "#fff",
        borderBottom: "1px solid var(--hairline)",
        position: sticky ? "sticky" : undefined,
        top: sticky ? 60 : undefined,
        zIndex: 9,
      }}
    >
      <div className="size-11 rounded-xl grid place-items-center font-bold text-[15px]" style={{ background: "linear-gradient(135deg,#E5F7F3,#E8F0FE)", color: "var(--teal)" }}>
        {initials}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-[17px] truncate" style={{ color: "var(--clin-ink)" }}>{p.full_name}</div>
        <div className="mono text-[11.5px] mt-0.5" style={{ color: "var(--clin-muted)" }}>
          {[
            p.sex ? p.sex[0].toUpperCase() : null,
            p.age_years != null ? `${p.age_years}y` : null,
            p.mrn ? `MRN ${p.mrn}` : null,
            p.document_id ?? null,
          ].filter(Boolean).join(" · ")}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap ml-2">
        {p.allergies && p.allergies.length > 0 ? (
          <span className="clin-pill crit">
            <AlertCircle className="size-3" />
            ALLERGY · {p.allergies.slice(0, 2).join(", ").toUpperCase()}
          </span>
        ) : (
          <span className="clin-pill ok"><Shield className="size-3" />NKDA</span>
        )}
        {p.is_pregnant && (
          <span className="clin-pill warn animate-pulse" data-testid="banner-pregnancy" title="Active pregnancy episode">
            <Baby className="size-3" />PREGNANT
          </span>
        )}
        {p.coverage_label && (
          <span className={`clin-pill ${covTone}`}>
            <Shield className="size-3" />{p.coverage_label}
          </span>
        )}
        {p.encounter_label && (
          <span className="clin-pill info">
            <Stethoscope className="size-3" />{p.encounter_label}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {typeof p.mds_pct === "number" && (
        <div className="text-right">
          <div className="mono uppercase text-[9px] tracking-[0.1em]" style={{ color: "var(--clin-faint)" }}>Encounter MDS</div>
          <div className="mono font-bold text-[15px]" style={{ color: "var(--teal)" }}>{Math.round(p.mds_pct)}%</div>
        </div>
      )}
    </div>
  );
}
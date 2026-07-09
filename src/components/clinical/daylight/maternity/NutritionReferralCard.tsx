import { useEffect, useState } from "react";
import { opdApi } from "@/lib/clinical-api";

/**
 * Step 4 · Turn 4 — Doctor-worklist card surfacing auto-generated
 * nutrition referrals (HCA-0255). "Open referral" is a deep-link stub;
 * the Referral Cockpit is Step 5.
 */
export function NutritionReferralCard({ encounterId }: { encounterId?: string }) {
  const [rows, setRows] = useState<Array<{ id: string; referral_no: string; created_at: string }>>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await opdApi.nutrition.pendingReferrals(encounterId ? { encounter_id: encounterId } : undefined);
        if (alive) setRows(r.data.rows.map((x) => ({ id: x.id, referral_no: x.referral_no, created_at: x.created_at })));
      } catch { /* silent — card just hides */ }
    })();
    return () => { alive = false; };
  }, [encounterId]);

  if (rows.length === 0) return null;

  return (
    <div className="clin-card p-4" data-testid="nutrition-referral-card">
      <div className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Nutrition referral suggested</div>
        <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">{rows.length}</span>
      </div>
      <p className="mt-2 text-sm">
        Nursing screening flagged a moderate/high nutrition risk on this pregnancy encounter.
      </p>
      <ul className="mt-2 space-y-1 text-xs mono">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between">
            <span>{r.referral_no}</span>
            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
      <button className="mt-3 mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline opacity-70 cursor-not-allowed" disabled>
        Open referral (cockpit — Step 5)
      </button>
    </div>
  );
}
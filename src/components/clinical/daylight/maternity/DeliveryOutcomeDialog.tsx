import { useState } from "react";
import { toast } from "sonner";
import { opdApi } from "@/lib/clinical-api";
import { ClinicalApiError } from "@/lib/clinical-api";

/**
 * Step 4 · Turn 4 — D7 chart-close hook: mark pregnancy episode delivered.
 * Minimal presentation surface; caller decides when to render.
 */
export function DeliveryOutcomeDialog({
  episodeId, onClosed,
}: { episodeId: string; onClosed?: (endDate: string) => void }) {
  const [end, setEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await opdApi.maternity.deliveryClose({ episode_id: episodeId, end_date: end });
      toast.success("Pregnancy episode closed.");
      onClosed?.(r.data.end_date);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="clin-card p-4" data-testid="delivery-outcome-dialog">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Chart close · pregnancy outcome</div>
      <label className="flex flex-col gap-1 mt-3">
        <span className="text-xs">Delivery date</span>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
          className="text-sm mono border border-hairline rounded px-2 py-1 w-[180px]" />
      </label>
      <button
        disabled={busy}
        onClick={submit}
        className="mt-3 mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated disabled:opacity-50"
      >Close pregnancy episode</button>
    </div>
  );
}
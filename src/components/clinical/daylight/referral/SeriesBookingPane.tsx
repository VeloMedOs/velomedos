/**
 * Step 5 · Turn 2 UI — Series booking pane.
 * Service picker filtered server-side (sub_category='series_therapy').
 * Submits to `referralWritesApi.series`; renders resulting bookings; a 422
 * `not_a_series_specialty` surfaces the debt #18 hint.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { referralWritesApi, ClinicalApiError } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";

export function SeriesBookingPane() {
  const services = useQuery({
    queryKey: ["series-eligible-services"],
    queryFn: () => referralWritesApi.seriesEligibleServices(),
  });
  const list = services.data?.data ?? [];

  const [originEnc, setOriginEnc] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [sessionCount, setSessionCount] = useState(6);
  const [cadenceDays, setCadenceDays] = useState(14);
  const [firstAt, setFirstAt] = useState<string>("");
  const [providerId, setProviderId] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => referralWritesApi.series({
      origin_encounter_id: originEnc,
      service_id: serviceId,
      session_count: sessionCount,
      cadence_days: cadenceDays,
      first_session_at: firstAt || null,
      provider_id: providerId || null,
    }),
    onSuccess: (r) => { setResult(r.data); setErr(null); toast.success(`Booked ${r.data.booking_ids.length} sessions`); },
    onError: (e) => {
      setResult(null);
      if (e instanceof ClinicalApiError) {
        const isNonSeries = e.code === "not_a_series_specialty";
        setErr(isNonSeries ? `${e.message} · debt #18 · catalog seed` : e.message);
      } else setErr("Series booking failed");
    },
  });

  return (
    <div className="space-y-3" data-testid="series-booking-pane">
      <DCard title="Series-referral booking" caption="Physiotherapy · Dialysis · Psychotherapy (sub_category='series_therapy')">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span>Origin encounter ID</span>
            <input className="border rounded px-2 py-1" value={originEnc} onChange={(e) => setOriginEnc(e.target.value)} placeholder="uuid" />
          </label>
          <label className="flex flex-col gap-1">
            <span>Service (series-eligible)</span>
            <select className="border rounded px-2 py-1" value={serviceId} onChange={(e) => setServiceId(e.target.value)} data-testid="series-service-select">
              <option value="">{services.isLoading ? "Loading…" : "Select service"}</option>
              {list.map((s) => (
                <option key={s.id} value={s.id}>{s.name ?? s.id}{s.specialty ? ` · ${s.specialty}` : ""}</option>
              ))}
            </select>
            {!services.isLoading && list.length === 0 && (
              <span className="text-amber-700">No series-eligible services seeded — debt #18</span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span>Session count</span>
            <input type="number" min={2} max={52} className="border rounded px-2 py-1"
              value={sessionCount} onChange={(e) => setSessionCount(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span>Cadence (days)</span>
            <input type="number" min={1} max={90} className="border rounded px-2 py-1"
              value={cadenceDays} onChange={(e) => setCadenceDays(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span>First session at</span>
            <input type="datetime-local" className="border rounded px-2 py-1"
              value={firstAt} onChange={(e) => setFirstAt(e.target.value ? new Date(e.target.value).toISOString() : "")} />
          </label>
          <label className="flex flex-col gap-1">
            <span>Provider (optional)</span>
            <input className="border rounded px-2 py-1" value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder="uuid" />
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            className="px-3 py-1 rounded bg-slate-900 text-white text-xs disabled:opacity-50"
            disabled={submit.isPending || !originEnc || !serviceId}
            onClick={() => submit.mutate()}
            data-testid="series-submit"
          >
            {submit.isPending ? "Booking…" : "Book series"}
          </button>
        </div>

        {err && (
          <div className="mt-3 clin-pill warn" data-testid="series-error" style={{ display: "block", padding: "8px 12px" }}>{err}</div>
        )}

        {result && (
          <div className="mt-3 text-xs space-y-1" data-testid="series-result">
            <div>Referral: <span className="font-mono">{result.referral_id}</span></div>
            <div>Series: <span className="font-mono">{result.series_id ?? "—"}</span></div>
            <div>Bookings ({result.booking_ids.length}):</div>
            <ul className="pl-4 list-disc">
              {result.booking_ids.map((id: string) => <li key={id} className="font-mono">{id}</li>)}
            </ul>
          </div>
        )}
      </DCard>
    </div>
  );
}
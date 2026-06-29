import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, ClipboardList, Send, Bell, Sparkles, BarChart3 } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { PromSurveyRenderer, type SurveySchema } from "./PromSurveyRenderer";

type Instrument = {
  id: string; key: string; name: string; kind: string;
  condition: string | null; version: string; active: boolean;
  schema: SurveySchema;
};
type Assignment = {
  id: string; beneficiary_id: string; instrument_id: string;
  trigger: string; status: string; due_at: string | null;
  channel: string; reminder_count: number;
  prom_instrument?: { name: string; kind: string; condition: string | null; version: string };
};

/**
 * Phase 11 — VBHC PROMs / PREMs workspace.
 * - Assign instruments to a beneficiary on a clinical trigger.
 * - Browse pending / completed assignments, nudge, render survey, submit to NPHIES PRM.
 * - View aggregated outcomes time-series + tenant benchmark.
 */
export function OutcomesPane() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [active, setActive] = useState<Assignment | null>(null);
  const [activeSchema, setActiveSchema] = useState<SurveySchema | null>(null);
  const [activeResponse, setActiveResponse] = useState<Record<string, unknown> | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [conditionFilter, setConditionFilter] = useState<string>("");
  const [summary, setSummary] = useState<{
    prom: Array<{ month: string; n: number; pcs: number | null; mcs: number | null; composite: number | null }>;
    prem: Array<{ month: string; n: number; composite: number | null; recommend: number | null }>;
    benchmark: { pcs: number | null; mcs: number | null };
  } | null>(null);

  // Assignment form
  const [form, setForm] = useState({ beneficiary_id: "", instrument_id: "", trigger: "baseline", due_at: "" });

  async function loadAll() {
    try {
      const [inst, asg, sum] = await Promise.all([
        ClinicalAPI.listPromInstruments(),
        ClinicalAPI.listPromAssignments({ status: filterStatus || undefined, limit: 100 }),
        ClinicalAPI.outcomesSummary({ condition: conditionFilter || undefined }),
      ]);
      setInstruments(inst.data as Instrument[]);
      setAssignments(asg.data as Assignment[]);
      setSummary({ prom: sum.prom, prem: sum.prem, benchmark: sum.benchmark });
    } catch (e) {
      const err = e as ClinicalApiError;
      toast.error(err.message ?? "Failed to load VBHC data");
    }
  }

  useEffect(() => { void loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterStatus, conditionFilter]);

  async function openAssignment(a: Assignment) {
    setActive(a);
    setActiveSchema(null);
    setActiveResponse(null);
    try {
      const detail = await ClinicalAPI.getPromAssignment(a.id);
      const inst = (detail.data?.prom_instrument ?? null) as { schema: SurveySchema } | null;
      setActiveSchema(inst?.schema ?? null);
      setActiveResponse((detail.data?.response ?? null) as Record<string, unknown> | null);
    } catch (e) {
      const err = e as ClinicalApiError;
      toast.error(err.message ?? "Failed to load assignment");
    }
  }

  async function createAssignment() {
    if (!form.beneficiary_id || !form.instrument_id) {
      toast.error("Beneficiary and instrument required");
      return;
    }
    try {
      await ClinicalAPI.createPromAssignment({
        beneficiary_id: form.beneficiary_id,
        instrument_id: form.instrument_id,
        trigger: form.trigger,
        due_at: form.due_at || undefined,
      });
      toast.success("Assignment created");
      setForm({ beneficiary_id: "", instrument_id: "", trigger: "baseline", due_at: "" });
      await loadAll();
    } catch (e) {
      const err = e as ClinicalApiError;
      toast.error(err.message ?? "Failed to create assignment");
    }
  }

  async function nudge(id: string) {
    try { await ClinicalAPI.remindPromAssignment(id); toast.success("Reminder sent"); await loadAll(); }
    catch (e) { toast.error((e as ClinicalApiError).message); }
  }

  async function respond(answers: Record<string, number>) {
    if (!active) return;
    try {
      await ClinicalAPI.respondPromAssignment(active.id, { answers, source: "staff" });
      toast.success("Response saved & scored");
      await openAssignment(active);
      await loadAll();
    } catch (e) {
      const err = e as ClinicalApiError;
      toast.error(err.message ?? "Failed to save response");
    }
  }

  async function submitToNphies(id: string) {
    try {
      const r = await ClinicalAPI.submitPromAssignment(id);
      toast.success(r.sandbox ? "Submitted (sandbox)" : `Submitted · ${r.http_status}`);
      await loadAll();
    } catch (e) {
      const err = e as ClinicalApiError;
      toast.error(err.message ?? "Submission failed");
    }
  }

  const promScale = useMemo(() => buildScale(summary?.prom.map((p) => p.pcs ?? 0) ?? []), [summary?.prom]);

  return (
    <section className="space-y-6">
      {/* Top metrics + benchmark */}
      <div className="grid lg:grid-cols-4 gap-3">
        <MetricCard icon={ClipboardList} label="Instruments" value={String(instruments.length)} />
        <MetricCard icon={Activity} label="Active surveys" value={String(assignments.filter((a) => a.status === "pending").length)} />
        <MetricCard icon={Sparkles} label="Avg PCS T-score" value={summary?.benchmark.pcs?.toFixed(1) ?? "—"} sub="Physical health" />
        <MetricCard icon={Sparkles} label="Avg MCS T-score" value={summary?.benchmark.mcs?.toFixed(1) ?? "—"} sub="Mental health" />
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-4">
        {/* Assignments list + create */}
        <div className="rounded-xl border border-hairline bg-card/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Assignments</div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-7 px-2 rounded mono text-[10px] uppercase tracking-widest bg-card/60 border border-hairline"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="rounded-lg border border-hairline p-3 space-y-2 bg-card/60">
            <div className="mono text-[10px] uppercase tracking-widest text-action">New assignment</div>
            <input
              placeholder="Beneficiary ID (uuid)"
              value={form.beneficiary_id}
              onChange={(e) => setForm({ ...form, beneficiary_id: e.target.value })}
              className="w-full h-8 px-2 rounded border border-hairline bg-card/80 text-xs mono"
            />
            <select
              value={form.instrument_id}
              onChange={(e) => setForm({ ...form, instrument_id: e.target.value })}
              className="w-full h-8 px-2 rounded border border-hairline bg-card/80 text-xs"
            >
              <option value="">Select instrument…</option>
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>{i.name} · v{i.version}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}
                className="h-8 px-2 rounded border border-hairline bg-card/80 text-xs"
              >
                <option value="baseline">Baseline</option>
                <option value="pre_op">Pre-op</option>
                <option value="post_op">Post-op</option>
                <option value="followup">Follow-up</option>
              </select>
              <input
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => setForm({ ...form, due_at: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                className="h-8 px-2 rounded border border-hairline bg-card/80 text-xs"
              />
            </div>
            <button onClick={createAssignment} className="w-full h-8 rounded mono text-[10px] uppercase tracking-widest bg-stable text-stable-foreground">
              Assign
            </button>
          </div>

          <div className="divide-y divide-hairline">
            {assignments.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">No assignments</div>
            )}
            {assignments.map((a) => (
              <button
                key={a.id}
                onClick={() => openAssignment(a)}
                className={`w-full text-left py-2 px-1 flex items-center justify-between gap-2 hover:bg-card/60 transition ${
                  active?.id === a.id ? "bg-card/70" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm truncate">{a.prom_instrument?.name ?? a.instrument_id.slice(0, 8)}</div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    {a.trigger} · {a.channel}
                    {a.due_at && <span>· due {new Date(a.due_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </button>
            ))}
          </div>
        </div>

        {/* Survey + actions */}
        <div className="rounded-xl border border-hairline bg-card/40 p-4">
          {!active && (
            <div className="text-sm text-muted-foreground p-8 text-center">
              Select an assignment to render its survey, capture a staff-entered response, or push to NPHIES PRM.
            </div>
          )}
          {active && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-base font-semibold">{active.prom_instrument?.name ?? "Survey"}</div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {active.trigger} · status {active.status}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {active.status === "pending" && (
                    <button onClick={() => nudge(active.id)} className="px-3 h-8 rounded mono text-[10px] uppercase tracking-widest bg-card/70 border border-hairline flex items-center gap-1">
                      <Bell className="size-3" /> Remind
                    </button>
                  )}
                  {activeResponse && (
                    <button onClick={() => submitToNphies(active.id)} className="px-3 h-8 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground flex items-center gap-1">
                      <Send className="size-3" /> Submit PRM
                    </button>
                  )}
                </div>
              </div>

              {activeResponse && (
                <div className="rounded-lg border border-stable/40 bg-stable/5 p-3">
                  <div className="mono text-[10px] uppercase tracking-widest text-stable mb-1">Captured score</div>
                  <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground">
                    {JSON.stringify((activeResponse as { score?: unknown }).score ?? {}, null, 2)}
                  </pre>
                </div>
              )}

              {activeSchema ? (
                <PromSurveyRenderer
                  schema={activeSchema}
                  initial={(activeResponse?.answers as Record<string, number> | undefined) ?? undefined}
                  disabled={active.status === "completed"}
                  onSubmit={respond}
                />
              ) : (
                <div className="text-xs text-muted-foreground">Loading instrument…</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Outcomes summary */}
      <div className="rounded-xl border border-hairline bg-card/40 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-action" />
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Outcomes timeline</div>
          </div>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="h-7 px-2 rounded mono text-[10px] uppercase tracking-widest bg-card/60 border border-hairline"
          >
            <option value="">All conditions</option>
            <option value="cataract">Cataract</option>
            <option value="obesity">Obesity</option>
            <option value="diabetes">Diabetes</option>
            <option value="pregnancy">Pregnancy</option>
            <option value="other">Other</option>
          </select>
        </div>

        {(!summary || summary.prom.length === 0) && (
          <div className="text-xs text-muted-foreground py-6 text-center">No PROM responses yet — assign and capture surveys to populate the trendline.</div>
        )}
        {summary && summary.prom.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
                  <th className="text-left py-1">Month</th>
                  <th className="text-right py-1">N</th>
                  <th className="text-right py-1">PCS</th>
                  <th className="text-right py-1">MCS</th>
                  <th className="text-right py-1">Composite</th>
                  <th className="py-1">vs PCS scale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {summary.prom.map((m) => (
                  <tr key={m.month}>
                    <td className="py-1 mono text-[11px]">{m.month}</td>
                    <td className="py-1 text-right mono text-[11px]">{m.n}</td>
                    <td className="py-1 text-right">{m.pcs ?? "—"}</td>
                    <td className="py-1 text-right">{m.mcs ?? "—"}</td>
                    <td className="py-1 text-right">{m.composite ?? "—"}</td>
                    <td className="py-1 pl-2">
                      <div className="h-2 rounded bg-card/60 overflow-hidden">
                        <div
                          className="h-full bg-action"
                          style={{ width: `${promScale.percent(m.pcs ?? 0)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {summary && summary.prem.length > 0 && (
          <div className="pt-2">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">PREM (experience)</div>
            <div className="grid sm:grid-cols-3 gap-2">
              {summary.prem.slice(-3).map((m) => (
                <div key={m.month} className="rounded border border-hairline p-2 bg-card/60">
                  <div className="mono text-[10px] text-muted-foreground">{m.month}</div>
                  <div className="text-base font-semibold">{m.composite ?? "—"}</div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Recommend {m.recommend ?? "—"}/5 · n={m.n}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className="size-4 text-action" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
      {sub && <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-action/15 text-action",
    completed: "bg-stable/15 text-stable",
    expired: "bg-emergency/15 text-emergency",
    cancelled: "bg-muted/30 text-muted-foreground",
  };
  return <span className={`mono text-[10px] px-2 py-0.5 rounded ${map[status] ?? "bg-muted/30 text-muted-foreground"}`}>{status}</span>;
}

function buildScale(values: number[]) {
  const nums = values.filter((v) => v > 0);
  const min = nums.length ? Math.min(...nums, 20) : 20;
  const max = nums.length ? Math.max(...nums, 70) : 70;
  const range = Math.max(1, max - min);
  return {
    percent: (v: number) => v <= 0 ? 0 : Math.max(2, Math.min(100, Math.round(((v - min) / range) * 100))),
  };
}
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminFetch } from "@/lib/admin-fetch";
import { BusinessIntakeForm } from "@/components/BusinessIntakeForm";
import { Plus, X, History, ArrowRight, ChevronRight, GitMerge, Globe, Headphones, Users, Trash2, RefreshCw } from "lucide-react";

const STAGES = ["request","contacted","demo","prospect","lead","negotiation","subscribed","rejected"] as const;
type Stage = typeof STAGES[number];

const STAGE_META: Record<Stage, { label: string; tone: string }> = {
  request:     { label: "Request",     tone: "bg-muted text-muted-foreground" },
  contacted:   { label: "Contacted",   tone: "bg-sky/15 text-sky" },
  demo:        { label: "Demo",        tone: "bg-sky/25 text-sky" },
  prospect:    { label: "Prospect",    tone: "bg-caution/20 text-caution" },
  lead:        { label: "Lead",        tone: "bg-teal/20 text-teal" },
  negotiation: { label: "Negotiation", tone: "bg-teal/30 text-teal" },
  subscribed:  { label: "Subscribed",  tone: "bg-stable/20 text-stable" },
  rejected:    { label: "Rejected",    tone: "bg-coral/20 text-coral" },
};

const SOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  website: Globe, call_center: Headphones, partner: Users, referral: Users, event: Users, other: ChevronRight,
};

type Req = {
  id: string; company_name: string; legal_name: string | null; nick_name: string | null;
  vat_number: string | null; cr_number: string | null; website_url: string | null;
  contact_name: string; contact_email: string; contact_phone: string | null;
  country: string | null; city: string | null;
  fleet_size: number | null; expected_seats: number | null;
  use_case: string | null; notes: string | null;
  source: string; source_detail: string | null;
  stage: Stage; status: string;
  converted_tenant_id: string | null;
  created_at: string;
};

type Event = {
  id: string; kind: string; from_stage: string | null; to_stage: string | null;
  note: string | null; created_at: string;
};

export function PipelineBoard() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Req | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const j = await adminFetch<{ requests: Req[] }>("/api/admin/v1/business-requests");
      setRequests(j.requests);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function advance(r: Req, stage: Stage, note?: string) {
    try {
      await adminFetch(`/api/admin/v1/business-requests/${r.id}/advance`, {
        method: "POST", body: { stage, note },
      });
      toast.success(`${r.company_name} → ${STAGE_META[stage].label}`);
      // optimistic
      setRequests((prev) => prev.map((x) => x.id === r.id ? { ...x, stage } : x));
      if (open?.id === r.id) setOpen({ ...open, stage });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(r: Req) {
    if (!confirm(`Delete request from ${r.company_name}?`)) return;
    try {
      await adminFetch(`/api/admin/v1/business-requests/${r.id}`, { method: "DELETE" });
      setRequests((prev) => prev.filter((x) => x.id !== r.id));
      if (open?.id === r.id) setOpen(null);
      toast.success("Deleted");
    } catch (e) { toast.error((e as Error).message); }
  }

  const cols: Stage[] = ["request","contacted","demo","prospect","lead","negotiation","subscribed"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{requests.length} requests · pipeline</div>
        <div className="flex items-center gap-1.5">
          <button onClick={load} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated inline-flex items-center gap-1">
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> reload
          </button>
          <button onClick={() => setCreating(true)} className="mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded bg-teal text-background font-bold inline-flex items-center gap-1">
            <Plus className="size-3" /> New business
          </button>
        </div>
      </div>

      <div className="grid gap-2 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(220px, 1fr))` }}>
        {cols.map((s) => {
          const items = requests.filter((r) => r.stage === s);
          return (
            <div key={s} className="rounded-lg border border-hairline bg-panel/60 flex flex-col min-h-[200px]">
              <div className="flex items-center justify-between p-2 border-b border-hairline">
                <span className={`mono text-[10px] uppercase px-2 py-0.5 rounded ${STAGE_META[s].tone}`}>{STAGE_META[s].label}</span>
                <span className="mono text-[10px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="p-1.5 space-y-1.5 flex-1">
                {items.map((r) => {
                  const Icon = SOURCE_ICON[r.source] ?? ChevronRight;
                  return (
                    <button key={r.id} onClick={() => setOpen(r)}
                      className="block w-full text-left rounded border border-hairline bg-panel hover:bg-panel-elevated p-2 space-y-1">
                      <div className="font-semibold text-sm truncate">{r.nick_name || r.company_name}</div>
                      <div className="mono text-[10px] text-muted-foreground truncate flex items-center gap-1">
                        <Icon className="size-3" /> {r.source} · {r.contact_email}
                      </div>
                      <div className="mono text-[10px] text-muted-foreground flex justify-between">
                        <span>{r.city ?? r.country ?? "—"}</span>
                        <span>{r.expected_seats ? `${r.expected_seats} seats` : (r.fleet_size ? `fleet ${r.fleet_size}` : "—")}</span>
                      </div>
                    </button>
                  );
                })}
                {items.length === 0 && <div className="text-[11px] text-muted-foreground text-center py-4">empty</div>}
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <Modal onClose={() => setCreating(false)} title="Log a new business">
          <BusinessIntakeForm mode="admin" defaultSource="call_center" onCreated={() => { setCreating(false); load(); }} />
        </Modal>
      )}

      {open && (
        <RequestDetail
          request={open}
          onClose={() => setOpen(null)}
          onAdvance={(s, n) => advance(open, s, n)}
          onDelete={() => remove(open)}
        />
      )}
    </div>
  );
}

function RequestDetail({ request, onClose, onAdvance, onDelete }: {
  request: Req; onClose: () => void;
  onAdvance: (s: Stage, note?: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const j = await adminFetch<{ request: Req; events: Event[] }>(`/api/admin/v1/business-requests/${request.id}`);
      setEvents(j.events);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [request.id]);

  return (
    <Modal onClose={onClose} title={request.nick_name || request.company_name} wide>
      <div className="grid md:grid-cols-[1fr_320px] gap-4 text-sm">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Detail k="Legal name" v={request.legal_name} />
            <Detail k="Trading name" v={request.company_name} />
            <Detail k="VAT No." v={request.vat_number} mono />
            <Detail k="CR No."  v={request.cr_number}  mono />
            <Detail k="Website" v={request.website_url} link />
            <Detail k="Source" v={`${request.source}${request.source_detail ? " · " + request.source_detail : ""}`} />
            <Detail k="Country / city" v={[request.country, request.city].filter(Boolean).join(" · ") || "—"} />
            <Detail k="Fleet / seats" v={`${request.fleet_size ?? "—"} / ${request.expected_seats ?? "—"}`} />
            <Detail k="Contact" v={`${request.contact_name} · ${request.contact_email}${request.contact_phone ? " · " + request.contact_phone : ""}`} />
          </div>
          {request.use_case && <Block label="Use case">{request.use_case}</Block>}
          {request.notes && <Block label="Notes">{request.notes}</Block>}

          <div className="rounded-lg border border-hairline bg-panel/40 p-3 space-y-2">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><GitMerge className="size-3" /> Advance stage</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button key={s} disabled={s === request.stage}
                  onClick={() => onAdvance(s, note || undefined).then(() => setNote(""))}
                  className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${s === request.stage ? "border-teal text-teal bg-teal/10 cursor-default" : "border-hairline hover:bg-panel-elevated"}`}>
                  {STAGE_META[s].label}
                </button>
              ))}
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (saved in history)"
              className="w-full h-9 px-3 rounded bg-input border border-hairline text-xs" />
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-panel/40 p-3 space-y-2">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><History className="size-3" /> History · {events.length}</div>
          <div className="space-y-1.5 max-h-[420px] overflow-auto">
            {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
            {!loading && events.length === 0 && <div className="text-xs text-muted-foreground">No events yet.</div>}
            {events.map((ev) => (
              <div key={ev.id} className="border-l-2 border-teal/40 pl-2">
                <div className="mono text-[10px] uppercase tracking-widest text-sky flex items-center gap-1">
                  {ev.kind} {ev.from_stage && ev.to_stage && <>· {ev.from_stage} <ArrowRight className="size-2.5" /> {ev.to_stage}</>}
                </div>
                {ev.note && <div className="text-xs">{ev.note}</div>}
                <div className="mono text-[9px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <button onClick={onDelete} className="w-full mono text-[10px] uppercase tracking-widest px-2 py-1.5 rounded border border-coral/40 text-coral hover:bg-coral/10 inline-flex items-center justify-center gap-1">
            <Trash2 className="size-3" /> Delete request
          </button>
        </aside>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className={`bg-panel border border-hairline rounded-xl w-full ${wide ? "max-w-4xl" : "max-w-2xl"} max-h-[88vh] overflow-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="size-7 grid place-items-center rounded hover:bg-panel-elevated"><X className="size-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Detail({ k, v, mono, link }: { k: string; v: string | null; mono?: boolean; link?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
      {link && v
        ? <a href={v} target="_blank" rel="noreferrer" className="text-sky hover:underline break-all">{v}</a>
        : <div className={`${mono ? "mono" : ""} break-words`}>{v || "—"}</div>}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-panel/40 p-3 space-y-1">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xs whitespace-pre-wrap">{children}</div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({ component: Audit });

type Entry = { id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; payload: Record<string, unknown> | null; at: string };

function Audit() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(200).then(({ data }) => {
      if (data) setRows(data as Entry[]);
    });
  }, []);

  const filtered = filter ? rows.filter((r) => `${r.action} ${r.entity}`.toLowerCase().includes(filter.toLowerCase())) : rows;

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Compliance · audit trail</div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ScrollText className="size-6 text-action" /> Audit log</h1>
        </div>
        <input placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 px-3 rounded bg-input border border-hairline text-sm mono" />
      </div>
      <div className="rounded-lg border border-hairline bg-panel overflow-hidden">
        <div className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{filtered.length} entries</div>
        <ul className="divide-y divide-hairline max-h-[640px] overflow-y-auto">
          {filtered.map((r) => (
            <li key={r.id} className="px-4 py-2.5 grid grid-cols-[160px_180px_1fr] gap-3 items-start text-sm">
              <div className="mono text-[11px] text-muted-foreground">{new Date(r.at).toLocaleString()}</div>
              <div className="mono text-[11px]"><span className="text-action">{r.action}</span><div className="text-muted-foreground">{r.entity}{r.entity_id ? `/${r.entity_id.slice(0, 8)}` : ""}</div></div>
              <pre className="mono text-[11px] text-muted-foreground whitespace-pre-wrap break-all">{r.payload ? JSON.stringify(r.payload) : "—"}</pre>
            </li>
          ))}
          {filtered.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No audit entries</li>}
        </ul>
      </div>
    </div>
  );
}
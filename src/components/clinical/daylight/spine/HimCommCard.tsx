/**
 * Spine primitive · <HimCommCard>
 *
 * Coder ↔ physician clarification thread. Reads v_him_comm_thread via
 * worklistsApi.himComms; composes via postHimComm. Marks unread inbound
 * (not authored by self) messages as read on view. Turn 2b.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { worklistsApi, ClinicalApiError, type HimCommRow } from "@/lib/clinical-api";
import { supabase } from "@/integrations/supabase/client";

export function HimCommCard({ encounterId, className }: { encounterId?: string | null; className?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<HimCommRow[]>([]);
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const marked = useRef<Set<string>>(new Set());

  useEffect(() => { supabase.auth.getUser().then((r) => setMe(r.data.user?.id ?? null)); }, []);

  useEffect(() => {
    if (!encounterId) return;
    let cancel = false;
    (async () => {
      try {
        const r = await worklistsApi.himComms({ encounter_id: encounterId });
        if (cancel) return;
        const list = r.data ?? [];
        setRows(list);
        // Bounded mark-read: only inbound, not authored by me, not read yet.
        list
          .filter((m) => m.direction === "inbound" && m.read_at === null && m.author !== me && !marked.current.has(m.id))
          .forEach((m) => {
            marked.current.add(m.id);
            worklistsApi.markHimCommRead(m.id).catch(() => marked.current.delete(m.id));
          });
      } catch (e) {
        if (!cancel) setErr(e instanceof ClinicalApiError ? e.message : "Failed to load HIM notes");
      }
    })();
    return () => { cancel = true; };
  }, [encounterId, me]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)), [rows]);

  async function post() {
    if (!encounterId || !body.trim()) return;
    try {
      const r = await worklistsApi.postHimComm({ encounter_id: encounterId, body: body.trim() });
      setRows((prev) => [r.data, ...prev]);
      setBody("");
    } catch (e) {
      setErr(e instanceof ClinicalApiError ? e.message : "Failed to post");
    }
  }

  function openLink(m: HimCommRow) {
    if (m.form_instance_id) router.navigate({ to: "/clinical", search: { tab: "forms-worklist" } });
    else if (m.coding_row_id)   router.navigate({ to: "/clinical", search: { tab: "coding" } });
  }

  return (
    <div className={cn("clin-card p-2 space-y-2", className)}>
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] mono uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>
          HIM · coder ↔ physician
        </div>
        <span className="text-[10px]" style={{ color: "var(--clin-muted)" }}>{sorted.length}</span>
      </div>
      {err ? <div className="clin-pill crit mx-1">{err}</div> : null}
      {!encounterId ? (
        <div className="text-xs px-1" style={{ color: "var(--clin-muted)" }}>Select an encounter to see HIM notes.</div>
      ) : !sorted.length ? (
        <div className="text-xs px-1" style={{ color: "var(--clin-muted)" }}>No coding notes yet.</div>
      ) : (
        <ol className="space-y-2">
          {sorted.map((m) => (
            <li
              key={m.id}
              onClick={() => (m.form_instance_id || m.coding_row_id) && openLink(m)}
              className={cn("rounded-md border px-3 py-2 text-xs", (m.form_instance_id || m.coding_row_id) && "cursor-pointer")}
              style={{ borderColor: "var(--hairline)", background: "var(--clin-raised)", color: "var(--clin-ink)" }}
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
                <span>{m.author_name ?? "—"}{m.channel ? ` · ${m.channel}` : ""}{m.direction === "inbound" && m.read_at === null ? " · unread" : ""}</span>
                <time>{new Date(m.created_at).toLocaleString()}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
      {encounterId ? (
        <div className="flex items-end gap-2 px-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Note to coder / physician…"
            className="clin-ctrl flex-1 mono text-xs"
            style={{ minHeight: 44, padding: 6 }}
          />
          <button
            type="button"
            onClick={post}
            disabled={!body.trim()}
            className="px-3 h-8 rounded mono text-[10px] uppercase tracking-widest text-white disabled:opacity-40"
            style={{ background: "var(--teal)" }}
          >Post</button>
        </div>
      ) : null}
    </div>
  );
}

// Legacy shape kept for compat with any older callers — no-op wrapper.
export type HimCommMessage = { id: string; author: string; role?: string | null; note: string; at: string };
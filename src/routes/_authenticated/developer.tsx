import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Copy, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/developer")({ component: Developer });

type Key = { id: string; name: string; prefix: string; last_used_at: string | null; created_at: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "").replace(/\//g, "").replace(/=/g, "");
  return `vmk_${b64}`;
}

function Developer() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase.from("api_keys").select("id,name,prefix,last_used_at,created_at").order("created_at", { ascending: false });
    if (data) setKeys(data as Key[]);
  }
  useEffect(() => { refresh(); }, []);

  async function issue() {
    if (!name.trim()) return toast.error("Name required");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const raw = randomKey();
    const prefix = raw.slice(0, 12);
    const hashed = await sha256Hex(raw);
    const { error } = await supabase.from("api_keys").insert({ name, owner_id: user.id, prefix, hashed_key: hashed });
    if (error) return toast.error(error.message);
    setIssued(raw);
    setName("");
    refresh();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Requests using it will start failing immediately.")) return;
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Developer console</div>
          <h1 className="text-2xl font-bold tracking-tight">API keys</h1>
        </div>
        <Link to="/api-docs" className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel">Open API docs →</Link>
      </div>

      <div className="rounded-lg border border-hairline bg-panel p-4 space-y-3">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Issue new key</div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production server" className="flex-1 h-10 px-3 rounded bg-input border border-hairline text-sm" />
          <button onClick={issue} className="h-10 px-4 rounded bg-action text-action-foreground mono text-xs uppercase tracking-widest font-bold">Generate</button>
        </div>
        {issued && (
          <div className="rounded-md border border-caution/50 bg-caution/10 p-3 space-y-2">
            <div className="mono text-[10px] uppercase tracking-widest text-caution">Copy now — shown once</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs break-all">{issued}</code>
              <button onClick={() => { navigator.clipboard.writeText(issued); toast.success("Copied"); }} className="size-8 grid place-items-center rounded hover:bg-panel-elevated"><Copy className="size-4" /></button>
            </div>
            <button onClick={() => setIssued(null)} className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">I've saved it</button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-hairline bg-panel overflow-hidden">
        <div className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Active keys · {keys.length}</div>
        {keys.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No keys yet</div>}
        {keys.map((k) => (
          <div key={k.id} className="px-4 py-3 border-b border-hairline last:border-0 flex items-center justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2"><KeyRound className="size-4 text-action" />{k.name}</div>
              <div className="mono text-[11px] text-muted-foreground">{k.prefix}… · created {new Date(k.created_at).toLocaleDateString()} · last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</div>
            </div>
            <button onClick={() => revoke(k.id)} className="size-9 grid place-items-center rounded text-muted-foreground hover:text-emergency hover:bg-emergency/10"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
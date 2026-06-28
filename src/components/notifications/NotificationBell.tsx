import { useEffect, useState } from "react";
import { Bell, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

type Note = { id: string; title: string; body: string | null; severity: string; link_to: string | null; created_at: string };

/**
 * In-app notification bell, mirroring the success-story pattern from RufayQ.
 * Reads `ops_notifications` and `ops_notification_reads` directly via RLS so
 * patients and business members only see notifications targeted to them.
 * Polls every 30s — no realtime channel required for this scope.
 */
export function NotificationBell({ className }: { className?: string }) {
  const [items, setItems] = useState<Note[]>([]);
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  async function load() {
    const { data: notes } = await supabase
      .from("ops_notifications")
      .select("id,title,body,severity,link_to,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((notes ?? []) as Note[]);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: rs } = await supabase
        .from("ops_notification_reads")
        .select("notification_id")
        .eq("user_id", user.id);
      setReads(new Set((rs ?? []).map((r: { notification_id: string }) => r.notification_id)));
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  async function markRead(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("ops_notification_reads").upsert({ notification_id: id, user_id: user.id } as never, { onConflict: "notification_id,user_id" });
    setReads(new Set([...reads, id]));
  }

  async function markAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const unread = items.filter((i) => !reads.has(i.id));
    if (unread.length === 0) return;
    await supabase.from("ops_notification_reads").upsert(
      unread.map((i) => ({ notification_id: i.id, user_id: user.id })) as never,
      { onConflict: "notification_id,user_id" },
    );
    setReads(new Set(items.map((i) => i.id)));
  }

  const unreadCount = items.filter((i) => !reads.has(i.id)).length;

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative size-9 grid place-items-center rounded-lg border border-hairline bg-panel hover:bg-panel-elevated text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-coral text-[9px] text-background grid place-items-center mono font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-xl border border-hairline bg-panel shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-hairline">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Notifications</div>
            <div className="flex items-center gap-1">
              <button onClick={markAll} title="Mark all read" className="size-7 grid place-items-center rounded-md hover:bg-panel-elevated text-muted-foreground"><Check className="size-3.5" /></button>
              <button onClick={() => setOpen(false)} className="size-7 grid place-items-center rounded-md hover:bg-panel-elevated text-muted-foreground"><X className="size-3.5" /></button>
            </div>
          </div>
          {items.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No notifications</div>}
          <ul className="divide-y divide-hairline/60">
            {items.map((n) => {
              const unread = !reads.has(n.id);
              const sevColor =
                n.severity === "critical" ? "text-coral" :
                n.severity === "warning" ? "text-caution" :
                n.severity === "success" ? "text-stable" : "text-sky";
              return (
                <li key={n.id} className={`p-3 ${unread ? "bg-panel-elevated/30" : ""}`}>
                  {n.link_to ? (
                    <a href={n.link_to} onClick={() => markRead(n.id)} className="block">
                      <NoteBody n={n} unread={unread} sevColor={sevColor} />
                    </a>
                  ) : (
                    <div onClick={() => markRead(n.id)} className="block cursor-pointer">
                      <NoteBody n={n} unread={unread} sevColor={sevColor} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function NoteBody({ n, unread, sevColor }: { n: Note; unread: boolean; sevColor: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1 size-1.5 rounded-full ${unread ? "bg-teal" : "bg-transparent"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium truncate">{n.title}</div>
          <div className={`mono text-[9px] uppercase tracking-widest ${sevColor}`}>{n.severity}</div>
        </div>
        {n.body && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
        <div className="mono text-[9.5px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString()}</div>
      </div>
    </div>
  );
}
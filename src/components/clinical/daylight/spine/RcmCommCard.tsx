/**
 * Spine primitive · <RcmCommCard>
 *
 * Thread renderer over `authorization_communication` + `denial_communication`.
 * Presentational; the API routes remain the write path.
 */
import { cn } from "@/lib/utils";

export type RcmCommMessage = {
  id: string;
  direction: "inbound" | "outbound";
  channel?: string | null;
  body?: string | null;
  at: string;
  actor?: string | null;
  kind: "authorization" | "denial";
};

export function RcmCommCard({ messages, className }: { messages: RcmCommMessage[]; className?: string }) {
  if (!messages.length) {
    return <div className={cn("clin-card p-3 text-xs", className)} style={{ color: "var(--clin-muted)" }}>No RCM communications yet.</div>;
  }
  return (
    <ol className={cn("clin-card p-2 space-y-2", className)}>
      {messages.map((m) => (
        <li
          key={m.id}
          className="rounded-md border px-3 py-2 text-xs"
          style={{
            borderColor: "var(--hairline)",
            background: m.direction === "outbound" ? "var(--clin-info-tint)" : "var(--clin-sunken)",
            color: "var(--clin-ink)",
          }}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
            <span>{m.kind} · {m.direction} · {m.channel ?? "portal"}</span>
            <time>{new Date(m.at).toLocaleString()}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap">{m.body ?? ""}</p>
        </li>
      ))}
    </ol>
  );
}
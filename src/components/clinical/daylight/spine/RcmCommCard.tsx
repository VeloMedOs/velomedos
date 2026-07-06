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
    return <div className={cn("rounded-lg border border-dashed p-3 text-xs text-muted-foreground", className)}>No RCM communications yet.</div>;
  }
  return (
    <ol className={cn("space-y-2", className)}>
      {messages.map((m) => (
        <li key={m.id} className={cn(
          "rounded-md border px-3 py-2 text-xs",
          m.direction === "outbound" ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50",
        )}>
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>{m.kind} · {m.direction} · {m.channel ?? "portal"}</span>
            <time>{new Date(m.at).toLocaleString()}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap">{m.body ?? ""}</p>
        </li>
      ))}
    </ol>
  );
}
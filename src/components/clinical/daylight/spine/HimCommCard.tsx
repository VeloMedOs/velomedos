/**
 * Spine primitive · <HimCommCard>
 *
 * Coding / HIM clarification thread over `clinical_audit` + `clinical_coding`
 * notes. Presentational.
 */
import { cn } from "@/lib/utils";

export type HimCommMessage = {
  id: string;
  author: string;
  role?: string | null;
  note: string;
  at: string;
};

export function HimCommCard({ messages, className }: { messages: HimCommMessage[]; className?: string }) {
  if (!messages.length) {
    return <div className={cn("clin-card p-3 text-xs", className)} style={{ color: "var(--clin-muted)" }}>No coding notes yet.</div>;
  }
  return (
    <ol className={cn("clin-card p-2 space-y-2", className)}>
      {messages.map((m) => (
        <li
          key={m.id}
          className="rounded-md border px-3 py-2 text-xs"
          style={{ borderColor: "var(--hairline)", background: "var(--clin-raised)", color: "var(--clin-ink)" }}
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
            <span>{m.author}{m.role ? ` · ${m.role}` : ""}</span>
            <time>{new Date(m.at).toLocaleString()}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap">{m.note}</p>
        </li>
      ))}
    </ol>
  );
}
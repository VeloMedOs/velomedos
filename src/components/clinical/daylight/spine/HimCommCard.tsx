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
    return <div className={cn("rounded-lg border border-dashed p-3 text-xs text-muted-foreground", className)}>No coding notes yet.</div>;
  }
  return (
    <ol className={cn("space-y-2", className)}>
      {messages.map((m) => (
        <li key={m.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>{m.author}{m.role ? ` · ${m.role}` : ""}</span>
            <time>{new Date(m.at).toLocaleString()}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap">{m.note}</p>
        </li>
      ))}
    </ol>
  );
}
/**
 * Textarea wrapper that highlights pasted text in yellow — Dev Spec §5
 * "copy-paste highlighted yellow". Pasted ranges are persisted on the parent
 * so ClinicalForm can save them alongside the answer.
 */
import { useRef, useState, type ChangeEvent, type ClipboardEvent, type ReactNode } from "react";

export type PasteRange = { start: number; end: number };

export function PasteHighlightField({
  value, onChange, ranges, onRangesChange, disabled, placeholder, rows = 4, fieldId,
}: {
  value: string;
  onChange: (next: string) => void;
  ranges: PasteRange[];
  onRangesChange: (r: PasteRange[]) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  fieldId?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const el = ref.current;
    if (!el) return;
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;
    e.preventDefault();
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + pasted + value.slice(end);
    const insertLen = pasted.length;
    const shifted = ranges
      .map((r) => (r.start >= end
        ? { start: r.start - (end - start) + insertLen, end: r.end - (end - start) + insertLen }
        : r))
      .filter((r) => r.end > r.start);
    shifted.push({ start, end: start + insertLen });
    onChange(next);
    onRangesChange(shifted);
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    if (ranges.length > 0 && e.target.value.length < value.length) onRangesChange([]);
  }

  return (
    <div>
      <textarea
        ref={ref}
        id={fieldId}
        className="clin-ctrl w-full"
        rows={rows}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onPaste={handlePaste}
        onChange={handleChange}
      />
      {ranges.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="mono text-[10.5px] uppercase tracking-wide underline"
            style={{ color: "var(--clin-muted)" }}
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? "Hide paste preview" : "Show paste preview"}
          </button>
          {preview && (
            <div
              className="mt-1 rounded-md px-3 py-2 text-[12.5px] whitespace-pre-wrap"
              style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)", color: "var(--clin-ink)" }}
              data-paste-preview
            >
              {renderHighlighted(value, ranges)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderHighlighted(text: string, ranges: PasteRange[]): ReactNode {
  if (ranges.length === 0) return text;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const chunks: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((r, i) => {
    if (r.start > cursor) chunks.push(text.slice(cursor, r.start));
    chunks.push(
      <span key={i} className="bg-yellow-200 text-inherit" data-pasted>
        {text.slice(r.start, r.end)}
      </span>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) chunks.push(text.slice(cursor));
  return chunks;
}
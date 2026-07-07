/**
 * Print an empty form — Dev Spec §5. Uses a print-only child window with
 * mandatory field placeholders "________ (required)".
 */
export type PrintField = { id: string; label: string; required?: boolean; type?: string };

export function printEmptyForm(title: string, fields: PrintField[]): void {
  const win = window.open("", "_blank", "width=720,height=900");
  if (!win) return;
  const rows = fields.map((f) => `
    <div class="row">
      <label>${escapeHtml(f.label)}${f.required ? ' <span class="req">(required)</span>' : ""}</label>
      <div class="blank">${f.type === "boolean" ? "☐ Yes  ☐ No" : "________________________________________"}</div>
    </div>`).join("");
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; padding: 32px; color: #15233B; }
      h1 { font-size: 18px; margin-bottom: 24px; }
      .row { margin-bottom: 20px; }
      label { font-weight: 600; display: block; margin-bottom: 4px; font-size: 12px; }
      .req { color: #C7362F; font-weight: 500; }
      .blank { font-family: 'JetBrains Mono', monospace; letter-spacing: 2px; color: #64748B; }
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>${rows}
    <script>window.onload = () => window.print();</script>
    </body></html>`);
  win.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
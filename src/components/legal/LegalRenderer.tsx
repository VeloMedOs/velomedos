import { useMemo } from "react";

/** Minimal, safe Markdown renderer for legal documents.
 *  Supports: h2/h3 headings, paragraphs, unordered lists, **bold**, [text](url), inline code, hr.
 *  Escapes raw HTML to prevent injection from CMS content. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-panel-elevated mono text-[12px]">$1</code>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safeHref = /^(https?:|mailto:|\/)/i.test(href) ? href : "#";
    return `<a class="text-teal underline underline-offset-2 hover:text-teal/80" href="${safeHref}">${label}</a>`;
  });
  return out;
}

function render(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p class="mt-3 text-[14.5px] leading-7 text-foreground/85">${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list.length) { out.push(`<ul class="mt-3 space-y-1.5 list-disc pl-5 text-[14.5px] leading-7 text-foreground/85">${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`); list = []; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (/^###\s+/.test(line)) { flushPara(); flushList(); out.push(`<h3 class="mt-7 text-[15px] font-semibold tracking-tight text-foreground">${inline(line.replace(/^###\s+/, ""))}</h3>`); continue; }
    if (/^##\s+/.test(line))  { flushPara(); flushList(); out.push(`<h2 class="mt-10 text-[18px] font-semibold tracking-tight text-foreground border-l-2 border-teal pl-3">${inline(line.replace(/^##\s+/, ""))}</h2>`); continue; }
    if (/^---+$/.test(line))  { flushPara(); flushList(); out.push('<hr class="my-6 border-hairline" />'); continue; }
    if (/^\s*-\s+/.test(line)){ flushPara(); list.push(line.replace(/^\s*-\s+/, "")); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return out.join("\n");
}

export function LegalRenderer({ markdown }: { markdown: string }) {
  const html = useMemo(() => render(markdown), [markdown]);
  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
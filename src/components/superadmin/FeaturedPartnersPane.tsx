import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { toast } from "sonner";
import { Globe, Eye, EyeOff } from "lucide-react";

type Sub = {
  id: string; company_name: string; status: string; country?: string | null;
  display_publicly?: boolean; display_consent?: boolean;
  display_name?: string | null; display_city?: string | null;
  display_type?: string | null; logo_url?: string | null; featured_order?: number | null;
};

export function FeaturedPartnersPane() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = (await adminFetch("/api/admin/v1/business-requests")) as Response;
    if (!r.ok) { toast.error("Failed to load subscribers"); return; }
    const data = await r.json();
    const list = (data.rows ?? data.items ?? data ?? []) as Sub[];
    setRows(list.filter((s) => ["lead", "subscribed", "prospect", "demo"].includes(s.status)));
  }
  useEffect(() => { load(); }, []);

  async function patch(id: string, body: Partial<Sub>) {
    setBusy(id);
    const r = (await adminFetch(`/api/admin/v1/business-requests/${id}/featured`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Response;
    setBusy(null);
    if (!r.ok) { toast.error("Update failed"); return; }
    toast.success("Updated");
    load();
  }

  const filtered = rows.filter((r) => !q || r.company_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <section className="rounded-xl border border-hairline bg-panel p-4 lg:p-5 space-y-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest text-teal">Featured partners</div>
          <div className="text-base font-semibold flex items-center gap-2"><Globe className="size-4" /> Public marquee control</div>
          <div className="text-xs text-muted-foreground mt-1">Only rows toggled <em>publicly + consent</em> appear in the website marquee via <code className="mono">/api/public/v1/partners</code>.</div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="bg-background border border-hairline rounded px-2 py-1 text-xs" />
      </header>

      <div className="overflow-x-auto border border-hairline rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-background/40">
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="p-2">Subscriber</th>
              <th className="p-2">Display name</th>
              <th className="p-2">City</th>
              <th className="p-2">Type</th>
              <th className="p-2">Logo URL</th>
              <th className="p-2">Order</th>
              <th className="p-2">Consent</th>
              <th className="p-2">Public</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-hairline align-middle">
                <td className="p-2">
                  <div className="font-medium text-foreground">{s.company_name}</div>
                  <div className="text-muted-foreground mono text-[10px]">{s.status}</div>
                </td>
                <td className="p-2"><input defaultValue={s.display_name ?? s.company_name} onBlur={(e) => e.target.value !== (s.display_name ?? "") && patch(s.id, { display_name: e.target.value })} className="bg-background border border-hairline rounded px-1.5 py-1 w-40" /></td>
                <td className="p-2"><input defaultValue={s.display_city ?? s.country ?? ""} onBlur={(e) => patch(s.id, { display_city: e.target.value })} className="bg-background border border-hairline rounded px-1.5 py-1 w-28" /></td>
                <td className="p-2">
                  <select defaultValue={s.display_type ?? "hospital"} onChange={(e) => patch(s.id, { display_type: e.target.value })} className="bg-background border border-hairline rounded px-1.5 py-1">
                    <option value="hospital">Hospital</option><option value="clinic_group">Clinic group</option><option value="ems">EMS</option><option value="payer_tpa">Payer/TPA</option>
                  </select>
                </td>
                <td className="p-2"><input defaultValue={s.logo_url ?? ""} onBlur={(e) => patch(s.id, { logo_url: e.target.value || null })} className="bg-background border border-hairline rounded px-1.5 py-1 w-40" placeholder="https://…" /></td>
                <td className="p-2"><input type="number" defaultValue={s.featured_order ?? 100} onBlur={(e) => patch(s.id, { featured_order: Number(e.target.value) || null })} className="bg-background border border-hairline rounded px-1.5 py-1 w-16" /></td>
                <td className="p-2">
                  <button onClick={() => patch(s.id, { display_consent: !s.display_consent, display_consent_source: "superadmin_toggle" } as Partial<Sub>)}
                    className={`mono text-[10px] uppercase px-2 py-1 rounded ${s.display_consent ? "bg-teal/15 text-teal" : "bg-hairline text-muted-foreground"}`}>
                    {s.display_consent ? "yes" : "no"}
                  </button>
                </td>
                <td className="p-2">
                  <button disabled={busy === s.id} onClick={() => patch(s.id, { display_publicly: !s.display_publicly })}
                    className={`mono text-[10px] uppercase px-2 py-1 rounded inline-flex items-center gap-1 ${s.display_publicly ? "bg-teal/15 text-teal" : "bg-hairline text-muted-foreground"}`}>
                    {s.display_publicly ? <><Eye className="size-3" /> shown</> : <><EyeOff className="size-3" /> hidden</>}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No qualifying subscribers yet — advance leads from the Pipeline first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
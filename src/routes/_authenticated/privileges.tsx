import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Search, Shield, UserCog, Sparkles } from "lucide-react";
import {
  ROLE_META, ROLE_ORDER, CAPABILITIES, capabilitiesByArea,
  effectiveCapabilities, type AppRole,
} from "@/lib/role-matrix";
import { adminEndpointCount, openApiAdminSpec } from "@/lib/openapi-admin-spec";

export const Route = createFileRoute("/_authenticated/privileges")({
  head: () => ({ meta: [
    { title: "Role privileges · VeloMed OS" },
    { name: "description", content: "Reference matrix of every VeloMed OS platform role and the capabilities each one grants." },
  ] }),
  component: PrivilegesPage,
});

type Profile = { id: string; full_name: string | null; email: string | null };
type RoleRow = { user_id: string; role: AppRole };

function PrivilegesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: r }, { data: u }] = await Promise.all([
        (supabase as any).from("profiles").select("id,full_name,email").limit(500),
        (supabase as any).from("user_roles").select("user_id,role"),
        supabase.auth.getUser(),
      ]);
      setProfiles((p ?? []) as Profile[]);
      setRoles((r ?? []) as RoleRow[]);
      if (u?.user?.id) setSelected(u.user.id);
    })();
  }, []);

  const rolesByUser = useMemo(() => {
    const m = new Map<string, AppRole[]>();
    for (const r of roles) {
      if (!m.has(r.user_id)) m.set(r.user_id, []);
      m.get(r.user_id)!.push(r.role);
    }
    return m;
  }, [roles]);

  const areas = capabilitiesByArea();
  const selectedRoles = (selected && rolesByUser.get(selected)) || [];
  const selectedProfile = profiles.find((p) => p.id === selected) || null;
  const effective = effectiveCapabilities(selectedRoles);
  const effectiveIds = new Set(effective.map((c) => c.id));
  const filteredProfiles = profiles
    .filter((p) => ((p.email ?? "") + " " + (p.full_name ?? "")).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);

  return (
    <main className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-action flex items-center gap-2"><Shield className="size-3" /> VeloMed OS</div>
          <h1 className="text-2xl font-bold tracking-tight">Role privileges matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">Every capability across the 8 platform roles. Pick a user to see their effective permissions.</p>
        </div>
        <Link to="/superadmin" className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated">← Superadmin</Link>
      </header>

      {/* Role cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLE_ORDER.map((r) => {
          const m = ROLE_META[r];
          const count = CAPABILITIES.filter((c) => c.roles.includes(r)).length;
          return (
            <div key={r} className="rounded-xl border border-hairline bg-panel p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${m.tone}`}>{m.label}</span>
                <span className="mono text-[10px] text-muted-foreground">{m.scope}</span>
              </div>
              <div className="text-xs text-muted-foreground leading-snug">{m.blurb}</div>
              <div className="mono text-[10px] uppercase tracking-widest text-action">{count} capabilities</div>
            </div>
          );
        })}
      </section>

      {/* Effective permissions resolver */}
      <section className="rounded-xl border border-hairline bg-panel p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2"><UserCog className="size-4 text-action" />
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Effective permissions for</div>
          </div>
          <div className="flex items-center gap-1 bg-panel-elevated rounded px-2 py-0.5 text-xs">
            <Search className="size-3 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search user…" className="bg-transparent outline-none w-56" />
          </div>
        </div>
        {q && (
          <div className="flex flex-wrap gap-1">
            {filteredProfiles.map((p) => (
              <button key={p.id} onClick={() => { setSelected(p.id); setQ(""); }}
                className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${selected === p.id ? "border-action bg-action/20 text-action" : "border-hairline hover:bg-panel-elevated"}`}>
                {p.email ?? p.full_name ?? p.id.slice(0,8)}
              </button>
            ))}
            {filteredProfiles.length === 0 && <span className="text-xs text-muted-foreground">No matches.</span>}
          </div>
        )}
        {selectedProfile && (
          <div className="flex items-center justify-between flex-wrap gap-2 border-t border-hairline pt-3">
            <div>
              <div className="font-semibold">{selectedProfile.full_name ?? selectedProfile.email}</div>
              <div className="mono text-[11px] text-muted-foreground">{selectedProfile.email}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedRoles.length === 0
                ? <span className="mono text-[10px] text-muted-foreground">No roles assigned</span>
                : selectedRoles.map((r) => (
                    <span key={r} className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${ROLE_META[r].tone}`}>{ROLE_META[r].label}</span>
                  ))}
            </div>
          </div>
        )}
      </section>

      {/* Capability matrix */}
      <section className="space-y-3">
        {Object.entries(areas).map(([area, caps]) => (
          <div key={area} className="rounded-xl border border-hairline bg-panel overflow-hidden">
            <div className="px-4 py-2 border-b border-hairline flex items-center justify-between gap-2">
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{area}</span>
              <span className="mono text-[10px] uppercase tracking-widest text-action/80 flex items-center gap-2">
                {caps.length} capabilities
                {area === "Admin API" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-action/30 bg-action/10 text-action">
                    <Sparkles className="size-3" /> {adminEndpointCount()} endpoints · {Object.keys(openApiAdminSpec.paths).length} routes
                  </span>
                )}
              </span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="mono text-[9px] uppercase tracking-widest text-muted-foreground bg-panel-elevated/40">
                  <tr>
                    <th className="text-left p-3 w-[34%]">Capability</th>
                    {ROLE_ORDER.map((r) => (
                      <th key={r} className="p-2 text-center" title={ROLE_META[r].label}>{r.replace("_"," ")}</th>
                    ))}
                    <th className="p-2 text-center">You</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {caps.map((c) => (
                    <tr key={c.id} className={effectiveIds.has(c.id) ? "bg-action/5" : ""}>
                      <td className="p-3">
                        <div className="font-medium">{c.label}</div>
                        <div className="text-xs text-muted-foreground">{c.description}</div>
                      </td>
                      {ROLE_ORDER.map((r) => (
                        <td key={r} className="p-2 text-center">
                          {c.roles.includes(r) ? <CheckCircle2 className="size-4 text-stable mx-auto" /> : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        {effectiveIds.has(c.id) ? <CheckCircle2 className="size-4 text-action mx-auto" /> : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
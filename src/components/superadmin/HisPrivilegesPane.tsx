import { useMemo, useState } from "react";
import { CheckCircle2, Eye, Layers } from "lucide-react";
import {
  CLINICAL_ROLE_META,
  CLINICAL_ROLE_ORDER,
  CLINICAL_CAPABILITIES,
  CLINICAL_MODULES,
  clinicalCapabilitiesByModule,
  effectiveClinicalCapabilities,
  modulesForRole,
  isReadOnly,
  type ClinicalRole,
} from "@/lib/clinical-role-matrix";

export function HisPrivilegesPane() {
  const [selected, setSelected] = useState<ClinicalRole>("physician");
  const byModule = useMemo(() => clinicalCapabilitiesByModule(), []);
  const effective = useMemo(() => effectiveClinicalCapabilities(selected), [selected]);
  const effectiveIds = new Set(effective.map((c) => c.id));
  const visibleModules = new Set(modulesForRole(selected));

  return (
    <div className="space-y-6">
      {/* Role cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CLINICAL_ROLE_ORDER.map((r) => {
          const m = CLINICAL_ROLE_META[r];
          const count = isReadOnly(r)
            ? CLINICAL_MODULES.length
            : CLINICAL_CAPABILITIES.filter((c) => c.roles.includes(r)).length;
          const active = selected === r;
          return (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={`text-left rounded-xl border bg-panel p-4 space-y-2 transition ${
                active ? "border-action ring-1 ring-action/40" : "border-hairline hover:bg-panel-elevated"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${m.tone}`}>{m.label}</span>
                <span className="mono text-[10px] text-muted-foreground">{m.group}</span>
              </div>
              <div className="text-xs text-muted-foreground leading-snug">{m.blurb}</div>
              <div className="mono text-[10px] uppercase tracking-widest text-action flex items-center gap-1">
                {isReadOnly(r) ? <><Eye className="size-3" /> {count} modules · GET-only</> : <><Layers className="size-3" /> {count} capabilities</>}
              </div>
            </button>
          );
        })}
      </section>

      {/* Selected role summary */}
      <section className="rounded-xl border border-hairline bg-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Effective access for</div>
          <div className="font-semibold">{CLINICAL_ROLE_META[selected].label}</div>
          <div className="text-xs text-muted-foreground mt-1">{CLINICAL_ROLE_META[selected].blurb}</div>
        </div>
        <div className="flex flex-wrap gap-1.5 max-w-[60%] justify-end">
          {Array.from(visibleModules).map((m) => (
            <span key={m} className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-action/15 text-action border border-action/20">{m}</span>
          ))}
        </div>
      </section>

      {/* Module → role matrix */}
      <section className="space-y-3">
        {Object.entries(byModule).map(([module, caps]) => (
          <div key={module} className="rounded-xl border border-hairline bg-panel overflow-hidden">
            <div className="px-4 py-2 border-b border-hairline flex items-center justify-between gap-2">
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{module}</span>
              <span className="mono text-[10px] uppercase tracking-widest text-action/80">{caps.length} actions</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="mono text-[9px] uppercase tracking-widest text-muted-foreground bg-panel-elevated/40">
                  <tr>
                    <th className="text-left p-3 w-[28%]">Action</th>
                    <th className="text-left p-3 w-[24%]">API namespace</th>
                    {CLINICAL_ROLE_ORDER.filter((r) => !isReadOnly(r)).map((r) => (
                      <th key={r} className="p-2 text-center" title={CLINICAL_ROLE_META[r].label}>{r.replace("_"," ")}</th>
                    ))}
                    <th className="p-2 text-center">Selected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {caps.map((c) => (
                    <tr key={c.id} className={effectiveIds.has(c.id) ? "bg-action/5" : ""}>
                      <td className="p-3">
                        <div className="font-medium">{c.label}</div>
                        <div className="text-xs text-muted-foreground">{c.description}</div>
                      </td>
                      <td className="p-3"><code className="mono text-[11px] text-muted-foreground">{c.apiNamespace}</code></td>
                      {CLINICAL_ROLE_ORDER.filter((r) => !isReadOnly(r)).map((r) => (
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

      <p className="text-xs text-muted-foreground">
        <strong>Read-only</strong> roles never appear as action holders; they have GET access to every module
        and are blocked from writes by the server guard (<code className="mono">requireClinicalModule</code>).
        <strong> Tenant Admin</strong> is implicitly allowed every action in their tenant.
      </p>
    </div>
  );
}

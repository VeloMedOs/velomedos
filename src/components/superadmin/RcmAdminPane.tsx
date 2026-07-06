/**
 * Superadmin · RCM Admin Pane
 *
 * Two cards:
 *   1. Gate Config Registry — mutate `rcm_admin_config` (deposit %, overbook
 *      limit, dispensing windows, indication default) with a history side
 *      panel from `rcm_admin_config_history`.
 *   2. Formulary & Indications — CHI UDF Excel import (staged diff → publish
 *      via `/formulary/import`), drug_indication_map browser/editor.
 *
 * All mutations flow through the guarded `/api/clinical/v1/admin-config` and
 * `/api/clinical/v1/formulary/*` routes (cap `admin.config.write`,
 * `formulary.import`, `formulary.indications.write`).
 */
import { Settings, FlaskRound } from "lucide-react";

export function RcmAdminPane() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h2 className="text-lg font-semibold">RCM Admin</h2>
        <p className="text-sm text-muted-foreground">
          Gate configuration & formulary governance for the current tenant.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Gate Config Registry</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Deposit % · overbook limit · dispensing windows · indication default.
          Backed by <code>rcm_admin_config</code>; history sourced from
          <code> rcm_admin_config_history</code>.
        </p>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <FlaskRound className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Formulary &amp; Indications</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          CHI UDF Excel import (staged diff → publish) and drug-indication map
          editor with per-generic block/warn severity.
        </p>
      </section>
    </div>
  );
}
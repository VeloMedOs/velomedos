import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, UserPlus, Stethoscope, FileText, Receipt, Activity, ClipboardList, FlaskConical, Wallet, HeartPulse, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Clinical Daylight shell — sidebar + top bar + body.
 * Wraps content in `.clinical-shell`, which remaps tokens to the light,
 * airy clinical palette without affecting the rest of the platform.
 */
export function DaylightShell({
  tab,
  onTab,
  roleLabel,
  initials,
  children,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  roleLabel: string;
  initials: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="clinical-shell min-h-screen">
      <div className="grid" style={{ gridTemplateColumns: "232px 1fr", minHeight: "100vh" }}>
        <aside className="border-r" style={{ background: "#fff", borderColor: "var(--hairline)", padding: "18px 14px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
          <Link to="/clinical" className="flex items-center gap-2.5 px-2 pb-4">
            <BrandMark className="size-7" />
            <span className="font-bold text-[17px]" style={{ color: "var(--clin-ink)" }}>VeloMed<span style={{ color: "var(--teal)" }}> HIS</span></span>
          </Link>

          <NavGroup label="Clinical">
            <NavItem id="registration" tab={tab} onTab={onTab} icon={UserPlus} label="Registration" />
            <NavItem id="encounters"   tab={tab} onTab={onTab} icon={Stethoscope} label="Encounter" />
            <NavItem id="orders"       tab={tab} onTab={onTab} icon={ClipboardList} label="Orders" disabled />
            <NavItem id="results"      tab={tab} onTab={onTab} icon={FlaskConical} label="Results" disabled />
          </NavGroup>

          <NavGroup label="Revenue">
            <NavItem id="coding" tab={tab} onTab={onTab} icon={FileText} label="Coding · DRG" />
            <NavItem id="claims" tab={tab} onTab={onTab} icon={Receipt}  label="Claims" />
            <NavItem id="billing" tab={tab} onTab={onTab} icon={Wallet}  label="Billing" disabled />
          </NavGroup>

          <NavGroup label="Outcomes">
            <NavItem id="vbhc" tab={tab} onTab={onTab} icon={HeartPulse} label="VBHC · PROMs" />
            <NavItem id="vitals" tab={tab} onTab={onTab} icon={Activity} label="Vitals trend" disabled />
          </NavGroup>
        </aside>

        <div className="flex flex-col min-w-0">
          <header
            className="flex items-center gap-4 px-6 sticky top-0 z-10"
            style={{ height: 60, background: "#fff", borderBottom: "1px solid var(--hairline)" }}
          >
            <label className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 max-w-[440px]" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)", color: "var(--clin-muted)" }}>
              <Search className="size-4" />
              <input placeholder="Search patient by MRN, National ID or name…" className="bg-transparent outline-none w-full text-sm" style={{ color: "var(--clin-ink)" }} />
            </label>
            <div className="flex-1" />
            <span className="mono text-[11px] px-2.5 py-1.5 rounded-md cursor-pointer" style={{ color: "var(--clin-muted)", border: "1px solid var(--clin-line-strong)" }}>ع · EN</span>
            <span className="mono text-[11px] px-2.5 py-1.5 rounded-md" style={{ color: "var(--teal)", background: "var(--clin-teal-tint)" }}>{roleLabel}</span>
            <button onClick={signOut} className="size-9 rounded-full text-white font-semibold text-[13px] grid place-items-center" style={{ background: "linear-gradient(135deg,#0E9C86,#2F6FED)" }} aria-label="Sign out · account">
              {initials}
            </button>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}

export type TabId = "registration" | "encounters" | "coding" | "claims" | "vbhc" | "orders" | "results" | "billing" | "vitals";

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="mono uppercase text-[9.5px] tracking-[0.14em] px-2.5 pt-3.5 pb-1.5" style={{ color: "var(--clin-faint)" }}>{label}</div>
      <nav className="flex flex-col">{children}</nav>
    </>
  );
}

function NavItem({ id, tab, onTab, icon: Icon, label, disabled }: { id: TabId; tab: TabId; onTab: (t: TabId) => void; icon: LucideIcon; label: string; disabled?: boolean }) {
  const on = tab === id;
  return (
    <button
      type="button"
      onClick={() => !disabled && onTab(id)}
      disabled={disabled}
      className="relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors text-left"
      style={{
        color: on ? "var(--teal)" : disabled ? "var(--clin-faint)" : "var(--clin-text)",
        background: on ? "var(--clin-teal-tint)" : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => { if (!on && !disabled) (e.currentTarget.style.background = "var(--clin-sunken)"); }}
      onMouseLeave={(e) => { if (!on && !disabled) (e.currentTarget.style.background = "transparent"); }}
    >
      {on && <span aria-hidden style={{ position: "absolute", left: -14, top: 8, bottom: 8, width: 3, borderRadius: "0 3px 3px 0", background: "var(--teal)" }} />}
      <Icon className="size-[17px]" style={{ color: on ? "var(--teal)" : disabled ? "var(--clin-faint)" : "var(--clin-muted)" }} />
      {label}
      {disabled && <span className="ml-auto mono text-[9px] uppercase tracking-widest" style={{ color: "var(--clin-faint)" }}>soon</span>}
    </button>
  );
}
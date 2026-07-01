/**
 * Daylight placeholders for the RCM/Finance surfaces that ship in later
 * R-chunks (R2 authorization, R3 claims/remittance, R4-R7 billing/deposits/
 * cash/ZATCA). Rendered exactly the same way as the shipped panes so the
 * shell composition — and role landing — never needs a "coming soon" branch.
 */
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck, Receipt, Wallet, BedDouble, PiggyBank, Banknote,
  ShieldCheck, Settings, HeartPulse, Activity,
} from "lucide-react";
import { DCard } from "./Primitives";

function Stub({ title, caption, icon, phase, bullets }: {
  title: string; caption: string; icon: LucideIcon; phase: string; bullets: string[];
}) {
  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1100, width: "100%" }}>
      <DCard title={title} caption={caption} icon={icon}
             status={<span className="clin-pill muted mono">{phase}</span>}>
        <div className="grid gap-2">
          <div className="text-[13px]" style={{ color: "var(--clin-text)" }}>
            The backend contract for this surface is defined and gated by the
            clinical role matrix. The Daylight worklist ships in <b>{phase}</b>;
            when it lands it will render here without any routing change.
          </div>
          <ul className="text-[12.5px] pl-4 space-y-1 list-disc" style={{ color: "var(--clin-muted)" }}>
            {bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      </DCard>
    </div>
  );
}

export const RcmHubPane = () => (
  <Stub title="RCM Officer console" caption="R1 · portfolio dashboard" icon={ShieldCheck} phase="R1"
        bullets={[
          "Cross-worklist load: eligibility · auth · claims · denials",
          "Snapshot-locked KPIs sourced from Phase-9 gateway messages",
          "Deep-links into the Daylight worklists in the sidebar",
        ]} />
);

export const AuthorizationPane = () => (
  <Stub title="Authorization worklist" caption="R2 · 16-step engine" icon={BadgeCheck} phase="R2"
        bullets={[
          "Inline on encounter: approved (teal) · pending TAT (amber) · not required (muted)",
          "Auth request bundle built by the shared Phase-9 NPHIES gateway",
          "SLA countdown ranked to the top of the physician's day",
        ]} />
);

export const ClaimsDenialsPane = () => (
  <Stub title="Claims & denials" caption="R3 · remittance router" icon={Receipt} phase="R3"
        bullets={[
          "Inbound $process-message remittance parsed into denials",
          "Denial reason codes → assigned to claims_officer worklist",
          "Resubmission draft with change tracker vs. original snapshot",
        ]} />
);

export const BillingOpPane = () => (
  <Stub title="Billing · OP/ER" caption="R4 · point-of-encounter bills" icon={Wallet} phase="R4"
        bullets={["Executed-only lines · patient share in tabular halalas · ZATCA-ready draft"]} />
);
export const BillingIpPane = () => (
  <Stub title="Billing · IP / Day-case" caption="R4 · DRG-bundled invoices" icon={BedDouble} phase="R4"
        bullets={["DRG snapshot lock · LOS-adjusted patient share · deposit reconciliation"]} />
);
export const DepositsPane = () => (
  <Stub title="Deposits & refunds" caption="R5 · trust ledger" icon={PiggyBank} phase="R5"
        bullets={["Advance deposits · refund approvals · dual-control audit"]} />
);
export const CashPane = () => (
  <Stub title="Cash & ZATCA" caption="R6 · e-invoicing" icon={Banknote} phase="R6"
        bullets={["Cashier close-out · ZATCA Phase-2 invoice clearance · daily reconciliation"]} />
);

export const AdminMastersPane = () => (
  <Stub title="Masters & contracts" caption="Tenant admin console" icon={Settings} phase="R1+"
        bullets={[
          "Governed edit through contract_change_request (see Contracts tab)",
          "Price-list versioning + effective-date compare",
          "Role matrix simulator — see /superadmin for full editor",
        ]} />
);

export const VbhcPlaceholderPane = () => (
  <Stub title="VBHC · PROMs" caption="Outcomes" icon={HeartPulse} phase="R7"
        bullets={["Deterministic scoring already live — Daylight worklist alignment in R7"]} />
);

export const VitalsTrendPane = () => (
  <Stub title="Vitals trend" caption="Clinical analytics" icon={Activity} phase="Soon"
        bullets={["NEWS2-aligned trendlines across the last 24h · 72h · 7d"]} />
);
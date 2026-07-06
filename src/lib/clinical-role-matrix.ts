/**
 * VeloMed OS — Clinical / RCM roles & privileges matrix (HIS).
 *
 * Parallel to `role-matrix.ts` (platform AppRole axis). Single source of truth
 * for the HIS/RCM `clinical_role` axis stored on `tenant_members.clinical_role`,
 * surfaced in the Superadmin "HIS / RCM Privileges" tab and consumed by the
 * per-module clinical/RCM API guards (`requireClinicalRole`, `requireClinicalModule`).
 *
 * READ access model:
 *   - any role that holds at least one action capability in a module may VIEW it;
 *   - `read_only` has zero action capabilities but may GET every module
 *     (enforced server-side by `requireClinicalModule`).
 */

export type ClinicalRole =
  | "tenant_admin"
  | "registrar"
  | "front_office"
  | "physician"
  | "nurse"
  | "lab_tech"
  | "radiologist"
  | "pharmacist"
  | "coder"
  | "case_manager"
  | "rcm"
  | "approval_officer"
  | "cashier"
  | "biller"
  | "claims_officer"
  | "finance"
  | "read_only";

export const CLINICAL_ROLE_ORDER: ClinicalRole[] = [
  "tenant_admin", "registrar", "front_office", "physician", "nurse",
  "lab_tech", "radiologist", "pharmacist", "coder", "case_manager",
  "rcm", "approval_officer", "cashier", "biller", "claims_officer",
  "finance", "read_only",
];

export const READ_ONLY_ROLE: ClinicalRole = "read_only";

export type ClinicalRoleMeta = {
  role: ClinicalRole;
  label: string;
  group: "clinical" | "coding" | "front_office" | "rcm" | "finance" | "admin";
  blurb: string;
  tone: string;
};

export const CLINICAL_ROLE_META: Record<ClinicalRole, ClinicalRoleMeta> = {
  tenant_admin:    { role: "tenant_admin",    label: "Tenant Admin",      group: "admin",        tone: "bg-action/20 text-action",          blurb: "Owns clinical masters, price lists, DRG rates, pricing & approval rules for the tenant." },
  registrar:       { role: "registrar",       label: "Registrar",         group: "front_office", tone: "bg-action/20 text-action",          blurb: "Registers beneficiaries and coverage; opens visits." },
  front_office:    { role: "front_office",    label: "Front Office",      group: "front_office", tone: "bg-action/20 text-action",          blurb: "Reception: eligibility check, exceptions (referral/emergency/newborn), self-pay vs insured." },
  physician:       { role: "physician",       label: "Physician",         group: "clinical",     tone: "bg-stable/20 text-stable",          blurb: "Opens encounters, documents, diagnoses, orders, prescribes; requests authorizations." },
  nurse:           { role: "nurse",           label: "Nurse",             group: "clinical",     tone: "bg-stable/20 text-stable",          blurb: "Vitals, supporting-info notes, order execution support, admission/discharge tasks." },
  lab_tech:        { role: "lab_tech",        label: "Lab Technician",    group: "clinical",     tone: "bg-stable/20 text-stable",          blurb: "Lab orders and results." },
  radiologist:     { role: "radiologist",     label: "Radiologist",       group: "clinical",     tone: "bg-stable/20 text-stable",          blurb: "Imaging orders, reports and results." },
  pharmacist:      { role: "pharmacist",      label: "Pharmacist",        group: "clinical",     tone: "bg-stable/20 text-stable",          blurb: "Dispensing, substitutions, medication authorization triggers." },
  coder:           { role: "coder",           label: "Clinical Coder",    group: "coding",       tone: "bg-panel-elevated text-foreground", blurb: "Finalizes ICD-10-AM / ACHI coding; runs the AR-DRG grouper for inpatient." },
  case_manager:    { role: "case_manager",    label: "Case Manager",      group: "coding",       tone: "bg-panel-elevated text-foreground", blurb: "Utilization / DRG review; admission & discharge coordination." },
  rcm:             { role: "rcm",             label: "RCM Officer",       group: "rcm",          tone: "bg-action/20 text-action",          blurb: "Works eligibility/authorization/claims worklists; payer communication." },
  approval_officer:{ role: "approval_officer",label: "Approval Officer",  group: "rcm",          tone: "bg-action/20 text-action",          blurb: "Pre-authorization decisioning and declaration workflow." },
  cashier:         { role: "cashier",         label: "Cashier",           group: "finance",      tone: "bg-action/20 text-action",          blurb: "OP/ER & IP collections, deposits, receipts, refunds (method-governed)." },
  biller:          { role: "biller",          label: "Biller",            group: "finance",      tone: "bg-action/20 text-action",          blurb: "Bill allocation, claim assembly & submission." },
  claims_officer:  { role: "claims_officer",  label: "Claims Officer",    group: "rcm",          tone: "bg-action/20 text-action",          blurb: "Batching, e-claims, remittance matching, denial management & resubmission." },
  finance:         { role: "finance",         label: "Finance",           group: "finance",      tone: "bg-emergency/20 text-emergency",    blurb: "Remittance posting, refund/write-off approval, ZATCA & D365 reconciliation." },
  read_only:       { role: "read_only",       label: "Read Only",         group: "clinical",     tone: "bg-muted text-muted-foreground",    blurb: "View-only across every permitted HIS module; cannot perform actions." },
};

export type ClinicalCapability = {
  id: string;
  module: string;
  apiNamespace: string;
  label: string;
  description: string;
  /** Roles granted this action. `read_only` is never listed (GET-only by rule). */
  roles: ClinicalRole[];
};

export const CLINICAL_CAPABILITIES: ClinicalCapability[] = [
  // Registration & Eligibility (R1)
  { id: "reg.beneficiary",   module: "Registration & Eligibility", apiNamespace: "/api/clinical/v1/beneficiaries",       label: "Register beneficiary & coverage", description: "Create/update patient demographics and insurance coverage.", roles: ["tenant_admin","registrar"] },
  { id: "reg.eligibility",   module: "Registration & Eligibility", apiNamespace: "/api/clinical/v1/eligibility",         label: "Check eligibility & exceptions",  description: "Run insurance check; capture referral/emergency/newborn exceptions; self-pay.", roles: ["tenant_admin","front_office","rcm"] },
  { id: "reg.activation",    module: "Registration & Eligibility", apiNamespace: "/api/clinical/v1/policy-activations",  label: "Policy activation",               description: "Work the policy-activation worklist; activate class + membership.", roles: ["tenant_admin","rcm"] },

  // Authorization (R2)
  { id: "auth.request",      module: "Authorization",              apiNamespace: "/api/clinical/v1/auth",                label: "Raise & work authorizations",     description: "Create, scrub, submit and communicate pre-authorizations.", roles: ["tenant_admin","rcm","approval_officer","physician","pharmacist"] },
  { id: "auth.decide",       module: "Authorization",              apiNamespace: "/api/clinical/v1/auth",                label: "Authorization decisioning",       description: "Approve/partial/reject; declaration workflow; post-decision governance.", roles: ["tenant_admin","approval_officer"] },
  { id: "auth.rules",        module: "Authorization",              apiNamespace: "/api/clinical/v1/masters/approval-rules", label: "Manage approval & trigger rules", description: "Configure authorization trigger & approval rule masters.", roles: ["tenant_admin","rcm"] },

  // Clinical (encounter / orders)
  { id: "clin.encounter",    module: "Clinical",                   apiNamespace: "/api/clinical/v1/encounters",          label: "Encounter & documentation",       description: "Open encounters, diagnoses, vitals, supporting-info notes, care team.", roles: ["tenant_admin","physician","nurse"] },
  { id: "clin.orders",       module: "Clinical",                   apiNamespace: "/api/clinical/v1/encounters/*/orders", label: "Place clinical orders",           description: "Lab/radiology/EP/service orders and prescriptions.", roles: ["tenant_admin","physician","nurse","lab_tech","radiologist","pharmacist"] },
  { id: "clin.admit",        module: "Clinical",                   apiNamespace: "/api/clinical/v1/encounters/*/admit",  label: "Admission & discharge MDS",       description: "Hospitalization, emergency disposition, discharge sequence.", roles: ["tenant_admin","physician","case_manager","nurse"] },

  // Coding & DRG (Phase 6)
  { id: "code.finalize",     module: "Coding & DRG",               apiNamespace: "/api/clinical/v1/encounters/*/code",   label: "Finalize coding",                 description: "Confirm ICD-10-AM principal/additional Dx and ACHI procedures.", roles: ["tenant_admin","coder"] },
  { id: "code.group",        module: "Coding & DRG",               apiNamespace: "/api/clinical/v1/encounters/*/group",  label: "Run AR-DRG grouper",              description: "Assemble MDS and assign the DRG (inpatient).", roles: ["tenant_admin","coder","case_manager"] },

  // Billing — OP/ER (R3)
  { id: "bill.op",           module: "Billing — OP/ER",            apiNamespace: "/api/clinical/v1/billing",             label: "OP/ER bill & collect",            description: "Allocate executed-only bills, collect copay, receipts.", roles: ["tenant_admin","cashier","biller","rcm"] },
  { id: "bill.discount",     module: "Billing — OP/ER",            apiNamespace: "/api/clinical/v1/billing/*/discount",  label: "Apply self-pay discount",         description: "Governed, capped, role-scoped self-pay discounts.", roles: ["tenant_admin","cashier"] },

  // Billing — IP/Day-Case (R4)
  { id: "bill.ip",           module: "Billing — IP/Day-Case",      apiNamespace: "/api/clinical/v1/ip",                  label: "Admission & IP accounting",       description: "Admission lounge/reception, package, daily charges, DRG-bundled bill.", roles: ["tenant_admin","rcm","cashier","case_manager"] },

  // Claims & Remittance (R5 / P7 / P9)
  { id: "claim.assemble",    module: "Claims & Remittance",        apiNamespace: "/api/clinical/v1/claims",              label: "Assemble & submit claims",        description: "Build FHIR claim, batch, submit to NPHIES.", roles: ["tenant_admin","biller","claims_officer"] },
  { id: "claim.remit",       module: "Claims & Remittance",        apiNamespace: "/api/clinical/v1/claims-mgmt",         label: "Remittance & denial",             description: "Match remittance, manage denials, resubmit.", roles: ["tenant_admin","claims_officer","rcm"] },
  { id: "claim.post",        module: "Claims & Remittance",        apiNamespace: "/api/clinical/v1/claims-mgmt/remittances/*/post", label: "Post payments (finance)", description: "Finance-gated remittance posting & write-off disposition.", roles: ["tenant_admin","finance"] },

  // Deposits & Refunds (R6)
  { id: "dep.collect",       module: "Deposits & Refunds",         apiNamespace: "/api/clinical/v1/deposits",            label: "Deposits & refunds",              description: "Collect deposits (incl. caution), refunds, credit notes, wallet.", roles: ["tenant_admin","cashier","biller"] },
  { id: "dep.approve",       module: "Deposits & Refunds",         apiNamespace: "/api/clinical/v1/deposits/refund-requests/*/approve", label: "Approve refunds", description: "Permission-gated refund approval hierarchy.", roles: ["tenant_admin","finance","rcm"] },
  { id: "dep.apply",             module: "Deposits & Refunds", apiNamespace: "/api/clinical/v1/deposits/*/apply",     label: "Apply deposit to bill",          description: "Apply a non-caution deposit balance onto a claim.", roles: ["tenant_admin","biller","cashier"] },
  { id: "dep.transfer",          module: "Deposits & Refunds", apiNamespace: "/api/clinical/v1/deposits/*/transfer",  label: "Transfer deposit",               description: "Transfer deposit balance between encounters/beneficiaries with reason.", roles: ["tenant_admin","biller","finance"] },
  { id: "dep.override_caution",  module: "Deposits & Refunds", apiNamespace: "/api/clinical/v1/deposits/*/apply",     label: "Override caution → apply",       description: "Approved exception to apply a caution deposit against a bill.", roles: ["tenant_admin","rcm","finance"] },
  { id: "refund.request",        module: "Deposits & Refunds", apiNamespace: "/api/clinical/v1/deposits/refund-requests", label: "Raise refund request",       description: "Create a refund request with method + reason.", roles: ["tenant_admin","cashier","biller"] },
  { id: "refund.approve",        module: "Deposits & Refunds", apiNamespace: "/api/clinical/v1/deposits/refund-requests/*/approve", label: "Approve refund", description: "Permission-gated refund approval + method exception.", roles: ["tenant_admin","rcm","finance"] },
  { id: "refund.execute",        module: "Deposits & Refunds", apiNamespace: "/api/clinical/v1/deposits/refund-requests/*/execute", label: "Execute refund", description: "Execute cash refund (cashier) or bank/card refund (finance).", roles: ["tenant_admin","cashier","finance"] },
  { id: "credit_note.issue",     module: "Deposits & Refunds", apiNamespace: "/api/clinical/v1/deposits/credit-notes", label: "Issue credit note",             description: "Issue a credit note to patient wallet (non-performed billed service).", roles: ["tenant_admin","biller","finance"] },
  { id: "erp.repost",            module: "Deposits & Refunds", apiNamespace: "/api/clinical/v1/deposits/erp-posting/bulk", label: "Retry ERP posting",         description: "Retry / mark-dead a pending or failed ERP posting.", roles: ["tenant_admin","finance"] },

  // Cash & ZATCA (R7)
  { id: "cash.collect",      module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/cash",                label: "Cash collection & session",       description: "Method-aware collection/refund; cashbox open/close.", roles: ["tenant_admin","cashier"] },
  { id: "cash.tax",          module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/tax",                 label: "ZATCA e-invoicing",               description: "Issue B2B/B2C invoices, credit/debit notes, VAT reversal.", roles: ["tenant_admin","finance","biller"] },
  { id: "cash.interfaces",   module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/interfaces",          label: "Interface monitoring",            description: "D365/ZATCA/POS/NPHIES interface logs and daily summaries.", roles: ["tenant_admin","finance"] },
  { id: "cash.post",         module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/cash/collections/*/post",  label: "Post cash collection",       description: "Post a draft collection (session-open + eligibility gates).", roles: ["tenant_admin","cashier"] },
  { id: "cash.void",         module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/cash/collections/*/void",  label: "Void collection",            description: "Void a posted collection with reason (finance).", roles: ["tenant_admin","finance","cashier"] },
  { id: "cash.session.open", module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/cash/sessions",             label: "Open cash session",          description: "Open a cashier shift/drawer with opening float.", roles: ["tenant_admin","cashier"] },
  { id: "cash.session.close",module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/cash/sessions/*/close",     label: "Close cash session",         description: "Close the shift with counted totals; variance requires override.", roles: ["tenant_admin","cashier","finance"] },
  { id: "cash.session.reconcile", module: "Cash & ZATCA",          apiNamespace: "/api/clinical/v1/cash/sessions/*/reconcile", label: "Reconcile variance",         description: "Sign off over/short with justification.", roles: ["tenant_admin","finance"] },
  { id: "tax.issue",         module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/tax-invoices",              label: "Issue tax invoice",          description: "Issue B2B (cleared) or B2C (reported) e-invoice.", roles: ["tenant_admin","finance","biller"] },
  { id: "tax.credit_note",   module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/tax-invoices/*/credit-note",label: "Issue tax credit note",     description: "Reverse invoice with tax credit/debit note.", roles: ["tenant_admin","finance"] },
  { id: "tax.submit",        module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/tax-invoices/*/submit",     label: "Submit to ZATCA",            description: "Push invoice to ZATCA sandbox/production.", roles: ["tenant_admin","finance"] },
  { id: "iface.retry",       module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/interfaces/log/*/retry",    label: "Retry interface message",    description: "Retry a failed or queued outbound message.", roles: ["tenant_admin","finance","rcm"] },
  { id: "iface.d365.post",   module: "Cash & ZATCA",               apiNamespace: "/api/clinical/v1/interfaces/d365/summary",   label: "Post D365 daily summary",    description: "Build & post the D365 GL/AR daily summary.", roles: ["tenant_admin","finance"] },

  // Masters & Contracts (P3 / R1 / addendum)
  { id: "mast.catalog",      module: "Masters & Contracts",        apiNamespace: "/api/clinical/v1/masters",             label: "Manage masters & price lists",    description: "Service/drug masters, multi-coding, price lists, bulk pricing, DRG contractual rates.", roles: ["tenant_admin"] },
  { id: "mast.drg.ref",      module: "Masters & Contracts",        apiNamespace: "/api/admin/v1/drgs",                   label: "Load DRG reference (platform)",   description: "National AR-DRG weights — superadmin/platform only.", roles: ["tenant_admin"] },
  { id: "mast.contracts",    module: "Masters & Contracts",        apiNamespace: "/api/clinical/v1/masters/contracts",   label: "Contract management",             description: "Payer agreements, deductibles/limits, governed effective-dated changes.", roles: ["tenant_admin","rcm"] },

  // VBHC (Phase 11)
  { id: "vbhc.assign",       module: "VBHC Outcomes",              apiNamespace: "/api/clinical/v1/prom-assignments",    label: "PROMs / PREMs",                   description: "Assign instruments, review outcomes, submit PRM MDS.", roles: ["tenant_admin","case_manager","physician"] },

  // Documentation
  { id: "docs.write",        module: "Documentation",              apiNamespace: "/api/clinical/v1/docs",                label: "Maintain manuals",                description: "Edit/version the HIS & RCM documentation (superadmin/tenant_admin).", roles: ["tenant_admin"] },

  // ── Turn-4 Part-2 · Billed Gate & spine surface ──────────────────────────
  { id: "gate.preview",             module: "Clinical",             apiNamespace: "/api/clinical/v1/gate/preview",            label: "Billed-gate preview",          description: "Explain-why for a charge's billed-gate outcome.", roles: ["tenant_admin","physician","nurse","lab_tech","radiologist","pharmacist","coder","case_manager","registrar","front_office","rcm","approval_officer","cashier","biller","claims_officer","finance"] },
  { id: "gate.exception.read",      module: "Clinical",             apiNamespace: "/api/clinical/v1/gate/exceptions",         label: "View gate exceptions",         description: "List billed-gate exceptions across the tenant.", roles: ["tenant_admin","rcm","biller","cashier","case_manager"] },
  { id: "gate.exception.create",    module: "Clinical",             apiNamespace: "/api/clinical/v1/gate/exceptions",         label: "Create gate exception",        description: "Grant a releasing exception (locked to rcm/tenant_admin).", roles: ["tenant_admin","rcm"] },
  { id: "gate.exception.update",    module: "Clinical",             apiNamespace: "/api/clinical/v1/gate/exceptions/*",       label: "Update gate exception",        description: "Amend note/status/expiry on an exception.", roles: ["tenant_admin","rcm"] },
  { id: "gate.exception.reconcile", module: "Clinical",             apiNamespace: "/api/clinical/v1/gate/exceptions/*/reconcile", label: "Reconcile emergency exception", description: "Post wallet delta after NPHIES adjudicates an emergency override.", roles: ["tenant_admin","rcm","finance"] },
  { id: "admin.config.write",       module: "Masters & Contracts",  apiNamespace: "/api/clinical/v1/admin-config",            label: "Edit RCM admin config",        description: "Mutate rcm_admin_config values (deposit %, overbook limit, dispensing windows).", roles: ["tenant_admin"] },
  { id: "rcm.comm.read",            module: "Claims & Remittance",  apiNamespace: "/api/clinical/v1/auth/requests/*/communications", label: "Read RCM comms",           description: "View authorization + denial communication threads.", roles: ["tenant_admin","rcm","biller","cashier","physician","nurse","case_manager"] },
  { id: "rcm.comm.write",           module: "Claims & Remittance",  apiNamespace: "/api/clinical/v1/auth/requests/*/communications", label: "Post RCM comm",            description: "Send an RCM communication (auth/denial thread).", roles: ["tenant_admin","rcm","biller","case_manager"] },
  { id: "him.comm.write",           module: "Coding & DRG",         apiNamespace: "/api/clinical/v1/encounters/*/code",       label: "Post HIM/coding note",         description: "Coder ↔ physician clarification note.", roles: ["tenant_admin","coder","physician"] },
  { id: "formulary.import",         module: "Masters & Contracts",  apiNamespace: "/api/clinical/v1/formulary/import",        label: "Import CHI formulary",         description: "Staged diff & publish for CHI UDF Excel imports.", roles: ["tenant_admin"] },
  { id: "formulary.indications.write", module: "Masters & Contracts", apiNamespace: "/api/clinical/v1/formulary/indications", label: "Edit drug indications",       description: "Maintain drug_indication_map rows (block/warn severity).", roles: ["tenant_admin","pharmacist"] },
  { id: "forms.def.publish",        module: "Clinical",             apiNamespace: "/api/clinical/v1/forms/defs",              label: "Publish clinical form",        description: "Create/version/publish a clinical form def and its bindings.", roles: ["tenant_admin"] },
  { id: "forms.instance.cosign",    module: "Clinical",             apiNamespace: "/api/clinical/v1/forms/instances/*",       label: "Co-sign form instance",        description: "Attending co-signature on a submitted form.", roles: ["tenant_admin","physician"] },
  { id: "referral.write",           module: "Registration & Eligibility", apiNamespace: "/api/clinical/v1/referrals",        label: "Create referral",              description: "Raise an outbound referral & targets.", roles: ["tenant_admin","physician","front_office"] },
  { id: "pbm.override",             module: "Clinical",             apiNamespace: "/api/clinical/v1/orders/prescription-items", label: "PBM indication override",    description: "Save a prescription despite a missing R-PBM2b indication (writes exception row).", roles: ["tenant_admin","rcm"] },
];

export const CLINICAL_MODULES: string[] = [
  ...new Set(CLINICAL_CAPABILITIES.map((c) => c.module)),
];

export function isReadOnly(role: ClinicalRole): boolean {
  return role === READ_ONLY_ROLE;
}

export function clinicalCapabilitiesByModule(): Record<string, ClinicalCapability[]> {
  return CLINICAL_CAPABILITIES.reduce<Record<string, ClinicalCapability[]>>((acc, c) => {
    (acc[c.module] ||= []).push(c);
    return acc;
  }, {});
}

/** Action capabilities granted to a role. `read_only` has none. */
export function effectiveClinicalCapabilities(role: ClinicalRole): ClinicalCapability[] {
  if (isReadOnly(role)) return [];
  return CLINICAL_CAPABILITIES.filter((c) => c.roles.includes(role));
}

/** Modules a role can reach (read_only sees every module, GET-only). */
export function modulesForRole(role: ClinicalRole): string[] {
  if (isReadOnly(role)) return [...CLINICAL_MODULES];
  return [...new Set(effectiveClinicalCapabilities(role).map((c) => c.module))];
}

/** Can `role` perform action capability `capId`? `tenant_admin` always can. */
export function canPerform(role: ClinicalRole | null | undefined, capId: string): boolean {
  if (!role) return false;
  if (role === "tenant_admin") return true;
  const cap = CLINICAL_CAPABILITIES.find((c) => c.id === capId);
  return !!cap && cap.roles.includes(role);
}

/** Can `role` view (GET) the given module? */
export function canViewModule(role: ClinicalRole | null | undefined, module: string): boolean {
  if (!role) return false;
  if (role === "tenant_admin" || isReadOnly(role)) return true;
  return modulesForRole(role).includes(module);
}

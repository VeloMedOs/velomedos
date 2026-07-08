/**
 * Data-driven Daylight sidebar — one declarative list mapping each matrix
 * MODULE → group / label / tab / icon. `Shell.tsx` renders each group only
 * if `canViewModule(role, module)` returns true for ≥1 item. Read-only sees
 * every group (matrix returns all modules) with a "View only" chip.
 *
 * Each NavItem sets a `tab` on the parent `clinical.tsx` route (single
 * shell + tab switch) — nothing here creates new sibling routes.
 */
import type { LucideIcon } from "lucide-react";
import {
  UserPlus, Stethoscope, FileText, Hash, ShieldCheck, BadgeCheck, Receipt,
  Wallet, BedDouble, PiggyBank, Banknote, Settings, HeartPulse, ClipboardList,
  FlaskConical, Activity, Users, ClipboardCheck, Megaphone, FormInput,
  Ambulance, DoorOpen, LogIn, LayoutGrid, LogOut, FileEdit,
  Pill, Apple, HandHeart, CalendarDays, CalendarCog,
} from "lucide-react";

export type NavTabId =
  | "registration" | "encounters" | "orders" | "results"
  | "coding"
  | "rcm" | "rcm-eligibility" | "rcm-activation" | "rcm-authorization" | "rcm-claims"
  | "finance-billing-op" | "finance-billing-ip" | "finance-deposits" | "finance-cash"
  | "admin-masters" | "admin-contract-masters"
  | "vbhc" | "vitals" | "billing" | "claims"
  // Batch-B spine Turn-1
  | "wl-doctor" | "wl-nursing" | "forms-worklist" | "rcm-comms"
  // Batch-B spine Turn-2b · 10 module worklists
  | "wl-ems" | "wl-front-office" | "wl-admission" | "wl-floor-manager"
  | "wl-transfer-discharge" | "wl-coder" | "wl-mrd" | "wl-pharmacist"
  | "wl-nutrition" | "wl-social-work"
  // Step 3 · Turn 3 — OPD Scheduling
  | "opd-day-board" | "opd-schedule-setup";

export type NavItemDef = {
  module: string;
  label: string;
  tab: NavTabId;
  icon: LucideIcon;
  disabled?: boolean;
};

export type NavSectionDef = {
  group: string;
  items: NavItemDef[];
};

export const NAV_SECTIONS: NavSectionDef[] = [
  {
    group: "Clinical",
    items: [
      { module: "Registration & Eligibility", label: "Registration", tab: "registration", icon: UserPlus },
      { module: "Clinical",                   label: "Encounter",    tab: "encounters",   icon: Stethoscope },
      { module: "Clinical",                   label: "OPD Day Board", tab: "opd-day-board",     icon: CalendarDays },
      { module: "Clinical",                   label: "Schedule Setup", tab: "opd-schedule-setup", icon: CalendarCog },
      { module: "Clinical",                   label: "Orders",       tab: "orders",       icon: ClipboardList },
      { module: "Clinical",                   label: "Results",      tab: "results",      icon: FlaskConical },
      { module: "Coding & DRG",               label: "Coding · DRG", tab: "coding",       icon: Hash },
    ],
  },
  {
    group: "Worklists",
    items: [
      // Batch-B spine Turn-1 · HCA-0174/0175/0186/0123
      { module: "Clinical", label: "Doctor Worklist",         tab: "wl-doctor",       icon: Users },
      { module: "Clinical", label: "Nursing Workbench",       tab: "wl-nursing",      icon: ClipboardCheck },
      { module: "Clinical", label: "Clinical Forms Worklist", tab: "forms-worklist",  icon: FormInput },
      { module: "Clinical", label: "RCM Communication",       tab: "rcm-comms",       icon: Megaphone },
      // Batch-B spine Turn-2b · 10 module worklists (spec 05 §2)
      { module: "Clinical", label: "Ambulance / EMS",         tab: "wl-ems",              icon: Ambulance },
      { module: "Clinical", label: "Front Office",            tab: "wl-front-office",     icon: DoorOpen },
      { module: "Clinical", label: "Admission",               tab: "wl-admission",        icon: LogIn },
      { module: "Clinical", label: "Floor Manager",           tab: "wl-floor-manager",    icon: LayoutGrid },
      { module: "Clinical", label: "Transfer / Discharge",    tab: "wl-transfer-discharge", icon: LogOut },
      { module: "Clinical", label: "Coder",                   tab: "wl-coder",            icon: Hash },
      { module: "Clinical", label: "Medical Records",         tab: "wl-mrd",              icon: FileEdit },
      { module: "Clinical", label: "Pharmacist",              tab: "wl-pharmacist",       icon: Pill },
      { module: "Clinical", label: "Nutrition",               tab: "wl-nutrition",        icon: Apple },
      { module: "Clinical", label: "Social Work",             tab: "wl-social-work",      icon: HandHeart },
    ],
  },
  {
    group: "RCM",
    items: [
      { module: "Registration & Eligibility", label: "Eligibility & activation", tab: "rcm-eligibility",   icon: ShieldCheck },
      { module: "Registration & Eligibility", label: "Policy activation",        tab: "rcm-activation",    icon: BadgeCheck },
      { module: "Authorization",              label: "Authorization",            tab: "rcm-authorization", icon: BadgeCheck },
      { module: "Claims & Remittance",        label: "Claims & denials",         tab: "rcm-claims",        icon: Receipt },
    ],
  },
  {
    group: "Finance",
    items: [
      { module: "Billing — OP/ER",            label: "Billing · OP/ER",          tab: "finance-billing-op", icon: Wallet },
      { module: "Billing — IP/Day-Case",      label: "Billing · IP",             tab: "finance-billing-ip", icon: BedDouble },
      { module: "Deposits & Refunds",         label: "Deposits & refunds",       tab: "finance-deposits",   icon: PiggyBank },
      { module: "Cash & ZATCA",               label: "Cash & ZATCA",             tab: "finance-cash",       icon: Banknote },
    ],
  },
  {
    group: "Outcomes",
    items: [
      { module: "VBHC Outcomes",              label: "VBHC · PROMs",             tab: "vbhc",               icon: HeartPulse },
      { module: "Clinical",                   label: "Vitals trend",             tab: "vitals",             icon: Activity, disabled: true },
    ],
  },
  {
    group: "Admin",
    items: [
      { module: "Masters & Contracts",        label: "Masters & contracts",      tab: "admin-masters",      icon: Settings },
      { module: "Masters & Contracts",        label: "Contract masters editor",  tab: "admin-contract-masters", icon: FileText },
    ],
  },
];

/** All tab ids that map to a matrix module (used for search-param validation). */
export const ALL_NAV_TABS: NavTabId[] = [
  ...new Set(NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.tab))),
  // Legacy alias kept for `?tab=claims` deep-links from earlier revisions.
  "claims",
  "billing",
];

// Silence unused-import (icons are used in items above; FileText retained
// for future NavItems).
// FileText is now referenced by the "Contract masters editor" item.
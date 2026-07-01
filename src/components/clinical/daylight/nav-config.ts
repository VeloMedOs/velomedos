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
  FlaskConical, Activity,
} from "lucide-react";

export type NavTabId =
  | "registration" | "encounters" | "orders" | "results"
  | "coding"
  | "rcm" | "rcm-eligibility" | "rcm-authorization" | "rcm-claims"
  | "finance-billing-op" | "finance-billing-ip" | "finance-deposits" | "finance-cash"
  | "admin-masters"
  | "vbhc" | "vitals" | "billing" | "claims";

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
      { module: "Clinical",                   label: "Orders",       tab: "orders",       icon: ClipboardList, disabled: true },
      { module: "Clinical",                   label: "Results",      tab: "results",      icon: FlaskConical, disabled: true },
      { module: "Coding & DRG",               label: "Coding · DRG", tab: "coding",       icon: Hash },
    ],
  },
  {
    group: "RCM",
    items: [
      { module: "Registration & Eligibility", label: "Eligibility & activation", tab: "rcm-eligibility",   icon: ShieldCheck },
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
void FileText;
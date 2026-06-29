import type { LucideIcon } from "lucide-react";
import {
  Radio, ShieldCheck, Stethoscope, ClipboardCheck, GraduationCap, HeartHandshake,
  MapPin, Timer, MousePointerClick, Inbox, Route, Gauge,
  FileBadge, AlertTriangle, Lock, Wrench, FileCheck2,
  Calendar, Video, Truck, LayoutGrid,
  Briefcase, ListChecks, Building2, Award,
  BookOpen, Activity, History,
  Repeat, BadgeCheck, MapPinned, ClipboardList, Users, BellRing,
} from "lucide-react";

export type Accent = "emergency" | "action" | "stable";

export type ServicePage = {
  slug: string;
  accent: Accent;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  overview: string;
  capabilities: { icon: LucideIcon; title: string; body: string }[];
  steps: { title: string; body?: string }[];
  audiences: string[];
  outcomes: { stat?: string; label: string }[];
  integrations: string[];
  related: string[];
  seo: { title: string; description: string };
};

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "emergency-dispatch",
    accent: "emergency",
    icon: Radio,
    eyebrow: "DISPATCH & LIVE TRACKING",
    title: "One console. Every unit. Every second.",
    subtitle:
      "A 24/7 call-center dispatch console with live fleet visibility, SLA timers and road-based ETAs — so your team always knows where every ambulance, crew and case stands.",
    ctaPrimary: { label: "Book a demo", href: "/contact" },
    ctaSecondary: { label: "View the dispatch API", href: "/superadmin/api-docs" },
    overview:
      "Run intake, assignment and live response from a single dark-mode console built for multi-monitor dispatch rooms. Calls become incidents in seconds, the nearest available unit is ranked by real road distance, and every status change is timestamped against its SLA.",
    capabilities: [
      { icon: MapPin, title: "Live fleet map", body: "5-second GPS from every unit, paramedic and doctor on shift, with status colors." },
      { icon: Timer, title: "Incident queue with SLA timers", body: "Code Red / Yellow / Routine, elapsed timers and pulses on breaches." },
      { icon: MousePointerClick, title: "One-click assignment", body: "Nearest available units ranked by road distance, broadcast to the field app." },
      { icon: Inbox, title: "Intake drawer", body: "Caller, location, severity and symptoms captured fast and pushed to providers instantly." },
      { icon: Route, title: "Live ETA", body: "Road-based, not straight-line — the facility and patient app watch the unit move." },
      { icon: Gauge, title: "Fleet KPIs", body: "Utilization, average ETA, units available vs assigned, across every branch." },
    ],
    steps: [
      { title: "Call logged" },
      { title: "System ranks nearest units" },
      { title: "One-click assign" },
      { title: "Crew accepts in the field" },
      { title: "Live status + location stream back" },
      { title: "Handoff & SLA close" },
    ],
    audiences: ["Ambulance operators", "Health clusters", "Ministry command centres", "Multi-branch emergency networks"],
    outcomes: [
      { label: "Response visibility in real time against your SLA target" },
      { label: "Defensible, timestamped SLA reporting" },
      { label: "No blind spots across branches" },
    ],
    integrations: ["Branch→region→district hierarchy", "Provider field app", "Patient app", "Public API (GET /v1/fleet, POST /v1/incidents)", "Maps / Directions"],
    related: ["fleet-compliance", "remote-clinics", "homecare"],
    seo: {
      title: "Emergency dispatch & live tracking | VeloMed OS",
      description: "A 24/7 dispatch console with live GPS, SLA timers and road-based ETAs for multi-branch emergency operations.",
    },
  },
  {
    slug: "fleet-compliance",
    accent: "action",
    icon: ShieldCheck,
    eyebrow: "COMPLIANCE & MAINTENANCE",
    title: "A unit that isn't roadworthy never gets dispatched.",
    subtitle:
      "Vehicle credentials, defect intake and work-order tracking in one place — with expiry alerts that gate dispatch before a non-compliant unit ever leaves the bay.",
    ctaPrimary: { label: "Book a demo", href: "/contact" },
    ctaSecondary: { label: "See pricing", href: "/pricing" },
    overview:
      "Track every vehicle licence, medical-staff certification and service interval against its expiry. Field crews log defects from their phone, and open safety work orders gate availability — so a unit that isn't roadworthy can't be assigned.",
    capabilities: [
      { icon: FileBadge, title: "Credential & licence tracking", body: "Vehicle and staff certs with 90/60/30-day expiry alerts." },
      { icon: AlertTriangle, title: "Defect intake from the field", body: "Crews report defects with photos; status updates automatically." },
      { icon: Lock, title: "Dispatch gating", body: "Open safety work orders pull the unit from the assignable pool." },
      { icon: Wrench, title: "Scheduled maintenance", body: "Service intervals with reminders and full history per unit." },
      { icon: FileCheck2, title: "Audit-ready records", body: "Every check, expiry and work order logged for regulators." },
    ],
    steps: [
      { title: "Credentials & intervals loaded" },
      { title: "Expiry alerts fire" },
      { title: "Defect or due service opens a work order" },
      { title: "Unit gated from dispatch" },
      { title: "Cleared — returns to the pool" },
    ],
    audiences: ["Fleet managers", "Operations directors", "Compliance officers", "Ambulance & mobile-clinic operators"],
    outcomes: [
      { label: "Zero non-compliant dispatches by design" },
      { label: "No missed renewals" },
      { label: "Audit-ready at any time" },
    ],
    integrations: ["Dispatch console (gating)", "Training & certification (shared validity)", "Public API", "NCA/NDMO-aligned audit export"],
    related: ["emergency-dispatch", "training-certification", "homecare"],
    seo: {
      title: "Fleet compliance & maintenance | VeloMed OS",
      description: "Vehicle credentials, defect intake and work orders that gate dispatch when a unit isn't roadworthy.",
    },
  },
  {
    slug: "remote-clinics",
    accent: "action",
    icon: Stethoscope,
    eyebrow: "CLINICS & TELEHEALTH",
    title: "Care wherever the patient is — physical, mobile or virtual.",
    subtitle:
      "Bookable physical, mobile and telehealth clinics across the regions you cover — with specialties, hours and live availability in one directory.",
    ctaPrimary: { label: "Book a demo", href: "/contact" },
    ctaSecondary: { label: "Explore homecare", href: "/services/homecare" },
    overview:
      "Publish your clinic network — fixed sites, mobile units and virtual care — with real-time slot availability. Patients, or operations staff on their behalf, book by specialty, location and time; telehealth visits run in-platform with secure video and notes captured to the record.",
    capabilities: [
      { icon: Stethoscope, title: "Clinic directory", body: "Physical, mobile and telehealth, by specialty, location and availability." },
      { icon: Calendar, title: "Slot booking", body: "Time-slot scheduling with reason capture and automated confirmations." },
      { icon: Video, title: "Telehealth visits", body: "Secure in-platform video; notes and vitals captured to the record." },
      { icon: Truck, title: "Mobile clinic scheduling", body: "Route and staff portable clinics to sites, camps and remote locations." },
      { icon: LayoutGrid, title: "Capacity view", body: "Operations sees utilization across the whole network." },
    ],
    steps: [
      { title: "Clinics & availability published" },
      { title: "Patient/ops picks specialty, location, slot" },
      { title: "Booking confirmed" },
      { title: "Visit delivered — in person or by video" },
      { title: "Documentation written to the record" },
    ],
    audiences: ["Mobile-clinic companies", "Occupational-health teams", "Clusters extending access to remote populations"],
    outcomes: [
      { label: "Extended access to underserved regions" },
      { label: "Higher clinic utilization" },
      { label: "Fewer no-shows" },
    ],
    integrations: ["Patient app", "Provider app", "Telehealth metering", "Public API (clinic directory)", "NPHIES / MOH integration packs"],
    related: ["homecare", "mobile-screening", "emergency-dispatch"],
    seo: {
      title: "Remote clinics & telehealth | VeloMed OS",
      description: "Bookable physical, mobile and telehealth clinics with specialties, hours and live availability.",
    },
  },
  {
    slug: "mobile-screening",
    accent: "action",
    icon: ClipboardCheck,
    eyebrow: "OCCUPATIONAL HEALTH",
    title: "Bring the medical to the workforce.",
    subtitle:
      "Corporate pre-employment and occupational-health screening delivered on-site by mobile units — bloods, vitals, drug & alcohol and fitness-for-work, tracked per worker and per contract.",
    ctaPrimary: { label: "Book a demo", href: "/contact" },
    ctaSecondary: { label: "See pricing", href: "/pricing" },
    overview:
      "Run on-site screening campaigns for construction sites, mining camps, clubs and remote operations. Mobile units deliver standardised panels; results, clearances and fitness-for-work status are tracked per worker and rolled up per corporate contract.",
    capabilities: [
      { icon: Briefcase, title: "Corporate packages", body: "Configurable panels per contract — bloods, vitals, D&A, occ-health." },
      { icon: Truck, title: "On-site delivery", body: "Mobile units scheduled and routed to the worksite." },
      { icon: ListChecks, title: "Per-worker records", body: "Results, clearances and fitness-for-work tracked per individual." },
      { icon: Building2, title: "Contract roll-ups", body: "Completion and clearance dashboards per corporate client." },
      { icon: Award, title: "Certificate output", body: "Verifiable fitness-for-work certificates issued on clearance." },
    ],
    steps: [
      { title: "Contract & panel defined" },
      { title: "Mobile unit scheduled to site" },
      { title: "Workers screened on-site" },
      { title: "Results recorded per worker" },
      { title: "Clearances & certificates issued" },
      { title: "Contract dashboard updates" },
    ],
    audiences: ["Occupational-health providers", "Corporate HSE teams", "Contractors at construction, mining, clubs and remote ops"],
    outcomes: [
      { label: "Faster onboarding clearances" },
      { label: "Auditable fitness-for-work" },
      { label: "Less worker downtime" },
    ],
    integrations: ["Mobile clinic scheduling (shared)", "Training & certification (certificates)", "Public API", "Billing per contract"],
    related: ["remote-clinics", "training-certification", "fleet-compliance"],
    seo: {
      title: "Mobile pre-employment screening | VeloMed OS",
      description: "On-site corporate screening — bloods, vitals, drug & alcohol and fitness-for-work, tracked per worker and contract.",
    },
  },
  {
    slug: "training-certification",
    accent: "emergency",
    icon: GraduationCap,
    eyebrow: "TRAINING & CERTIFICATION",
    title: "Qualify your crews — and prove it.",
    subtitle:
      "ALS, EMT-Basic, Tactical Paramedic and refresher courses with verifiable certificates issued on completion — and certification validity that feeds straight into dispatch eligibility.",
    ctaPrimary: { label: "Book a demo", href: "/contact" },
    ctaSecondary: { label: "Browse the catalog", href: "/contact" },
    overview:
      "Run the course catalog, enrollments and assessments for your clinical workforce. Completion issues a verifiable certificate with a verification code, and certification validity flows into compliance — so only currently-certified staff are assignable.",
    capabilities: [
      { icon: BookOpen, title: "Course catalog", body: "ALS, EMT-Basic, Tactical Paramedic and refreshers — levels, duration, modules." },
      { icon: Activity, title: "Enrollment & progress", body: "Track learners through modules to completion." },
      { icon: Award, title: "Verifiable certificates", body: "Issued on completion with a code and a public verification page." },
      { icon: Lock, title: "Certification → dispatch", body: "Expiring certs surface in compliance; lapsed staff are gated." },
      { icon: History, title: "Training records", body: "Per-staff history for audit and cluster reporting." },
    ],
    steps: [
      { title: "Courses published" },
      { title: "Staff enrolled" },
      { title: "Modules completed" },
      { title: "Assessment passed" },
      { title: "Certificate issued" },
      { title: "Validity feeds compliance & dispatch" },
    ],
    audiences: ["Training officers", "Clinical leads", "Operators keeping crews continuously certified"],
    outcomes: [
      { label: "Continuous certification across the workforce" },
      { label: "Verifiable credentials" },
      { label: "Fewer eligibility gaps" },
    ],
    integrations: ["Fleet compliance (cert validity)", "Dispatch (eligibility gating)", "Public API (GET /v1/courses)", "Certificate verification page"],
    related: ["fleet-compliance", "mobile-screening", "emergency-dispatch"],
    seo: {
      title: "Training & certification | VeloMed OS",
      description: "ALS, EMT-Basic and Tactical Paramedic courses with verifiable certificates that feed dispatch eligibility.",
    },
  },
  {
    slug: "homecare",
    accent: "stable",
    icon: HeartHandshake,
    eyebrow: "HOMECARE",
    title: "Care that travels to the patient — verified every visit.",
    subtitle:
      "Plan, route and prove recurring in-home nursing and caregiver visits across every branch — on the same nervous system that runs your fleet.",
    ctaPrimary: { label: "Book a demo", href: "/contact" },
    ctaSecondary: { label: "See pricing", href: "/pricing" },
    overview:
      "Build care plans, generate the visit schedule, and route caregivers to the patient's home. Every visit is verified by geofenced, time-stamped check-in and check-out (EVV) — proof of delivery by location and time, not a paper signature — with vitals, medications and care-plan tasks captured at the bedside.",
    capabilities: [
      { icon: Repeat, title: "Recurring care plans", body: "By type and frequency, generating the schedule automatically." },
      { icon: BadgeCheck, title: "Skills-matched assignment", body: "Only credentialed caregivers can be assigned to a plan." },
      { icon: MapPinned, title: "EVV check-in/out", body: "Geofenced, tamper-proof timestamps that prove the visit happened." },
      { icon: ClipboardList, title: "Bedside capture", body: "Vitals, MAR and care-plan tasks recorded live in the visit." },
      { icon: Users, title: "Family visibility", body: "Schedule, assigned caregiver, live ETA and visit history in-app." },
      { icon: BellRing, title: "Missed-visit alerts", body: "A scheduled visit with no check-in raises a dispatch alert." },
    ],
    steps: [
      { title: "Care plan created" },
      { title: "Visits scheduled" },
      { title: "Caregiver routed to the home" },
      { title: "Geofenced check-in" },
      { title: "Tasks, vitals & meds at the bedside" },
      { title: "Check-out — verified, billable visit" },
    ],
    audiences: ["Home and remote care providers", "Chronic-disease and post-op programmes", "Elderly and palliative care", "Clusters extending care into the home"],
    outcomes: [
      { label: "Every visit verified by location and time" },
      { label: "Auditable, payer-ready proof of delivery" },
      { label: "Care extended beyond the clinic walls" },
    ],
    integrations: ["Provider field app (EVV)", "Dispatch board (live tracking, missed-visit alerts)", "Patient/family app (ETA)", "Public API (/v1/homecare/*)", "EVV audit export"],
    related: ["remote-clinics", "emergency-dispatch", "fleet-compliance"],
    seo: {
      title: "Homecare Service | VeloMed OS",
      description: "Recurring in-home nursing and caregiver visits with geofenced EVV, vitals, medications and care-plan tasks.",
    },
  },
];

export const getServicePage = (slug: string) => SERVICE_PAGES.find((s) => s.slug === slug);

export const accentClasses = (a: Accent) => {
  switch (a) {
    case "emergency":
      return { text: "text-emergency", border: "border-emergency/40", bg: "bg-emergency", bgSoft: "bg-emergency/10", ring: "ring-emergency/30", btn: "bg-emergency text-emergency-foreground hover:bg-emergency/90" };
    case "stable":
      return { text: "text-stable", border: "border-stable/40", bg: "bg-stable", bgSoft: "bg-stable/10", ring: "ring-stable/30", btn: "bg-stable text-background hover:bg-stable/90" };
    default:
      return { text: "text-action", border: "border-action/40", bg: "bg-action", bgSoft: "bg-action/10", ring: "ring-action/30", btn: "bg-action text-background hover:bg-action/90" };
  }
};
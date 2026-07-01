# RCM R1 — Daylight nav + eligibility worklist (corrected, paste-ready)

Validated against `velomedos@e4500fa`. The backend claims are **all true** — R1 tables exist, the `clinical_role` enum carries all seven RCM roles (+ `cashier`/`registrar`/`read_only`), the `eligibility*` / `policy-activations*` / `masters/contract-change-requests*` endpoints exist, `ClinicalAPI.listEligibility` exists, `me.ts` returns `clinical_role`, and `ops_notifications` exists. So **no migrations, no new endpoints** holds. Three things must change before building.

## [FIX 1 — CRITICAL: routing] Panes-as-tabs, NOT nested route files

`clinical.tsx` is `createFileRoute("/_authenticated/clinical")` — a **single tab-switched workspace**: tab state via `useSearch` + `useState<TabId>`, rendering `{tab === "registration" && <RegistrationPane/>}` inside `<DaylightShell tab onTab>`. It has **no** `<Outlet/>`**.** So the plan's ten `clinical.rcm.*.tsx` / `clinical.finance.*.tsx` route files would create **sibling routes that don't share the shell or tab state** — the nav would break. Do this instead:

- **Add TabIds** to the `TabId` union in `Shell.tsx`: `rcm`, `rcm-eligibility`, `rcm-authorization`, `rcm-claims`, `finance-billing-op`, `finance-billing-ip`, `finance-deposits`, `finance-cash`, `admin-masters`.
- **Render the new panes inside** `clinical.tsx`**'s existing switch** (`{tab === "rcm-eligibility" && <EligibilityWorklistPane/>}`, etc.). Stubs are Daylight empty-states in the same switch.
- **NavItems set the tab** via `onTab(id)` — they do **not** navigate to a route. Deep-linking still works through `?tab=` (the route already reads `search.tab`). Extend the route's `validateSearch` to accept the new tab ids.
- **No new files under** `src/routes/`**.** Delete that entire section of the plan.

## [FIX 2 — CRITICAL: status tokens] Group by the real `EligibilityStatus`, not invented ones

`visit_eligibility.status` is `text` (default `'new'`), driven by the SSOT `src/lib/rcm/eligibility-sm.ts → EligibilityStatus`. The plan groups by tokens that **don't exist** (`exception_review`, `self_pay_pending`, `awaiting_payer`, `eligible`, `activated`, `ineligible`). Confirmed persisted tokens include `new, draft, submitted, insured, error, cancelled`. Fix:

- **Import** `EligibilityStatus` **from** `eligibility-sm.ts` and group by those exact tokens. Read the union from that file — don't hard-code a guessed list.
- Buckets mapped to real tokens: **Needs me now** = `{new, draft, error}` · **In-flight** = `{submitted}` · **Cleared** = `{insured}` · **Dead** = `{cancelled}` (add a `self_pay`/exception token only if the SM actually persists it).
- `toneOf(status)` maps the **real** tokens: `insured` → teal, `submitted` → sky, `error` → coral, `new`/`draft` → amber/muted, `cancelled` → muted.
- The other two panes have documented vocabularies — use them verbatim: `policy_activation_request` = `pending | in_progress | activated | rejected`; `contract_change_request` = `draft | approved | applied | rejected`.

## [FIX 3 — duplicates] Reuse what already exists; don't fork

- `src/lib/clinical-role-landing.ts` **already exists** — it exports `tabForClinicalRole(role)` and `clinicalDestinationFor(role)` returning `/clinical?tab=…`. **Do not create** `src/lib/clinical/ role-landing.ts`**.** Extend the existing `MAP` with the new RCM tabs (e.g. `rcm → "rcm"`, `claims_officer → "rcm-claims"`, `approval_officer → "rcm-authorization"`, `cashier`/`biller → "finance-billing-op"`, `finance → "finance-deposits"`, `tenant_admin → "admin-masters"`). Role landing = set the initial tab from this (it already returns a `?tab=` URL); no route redirect needed.
- **Role hook** (`use-clinical-role.ts`): call the existing `GET /api/clinical/v1/me` (returns `clinical_role`) — don't invent a new source.
- `formatHalalas` already lives in `src/lib/mds/drg-pricing.ts` (also used in `clinical-masters.tsx`). **Consolidate into one shared money util** and import it everywhere — don't add a parallel `format-money.ts`.
- `toneOf`: no existing helper — OK to add, but put it in a shared `src/lib/clinical/clinical-status.ts` (not an RCM-only `rcm-tones.ts`) so R2–R7 reuse it. It must map the real `EligibilityStatus` tokens.

## Confirmed-good — keep exactly

- Data-driven nav from `NAV_SECTIONS` + `canViewModule(role, module)`; drop all hard-coded `disabled` flags; `read_only` sees all with a "View only" chip.
- Amendment reconciliations are correct: **no new matrix module** (extend `Registration & Eligibility` with `elig.*` and `Masters & Contracts` with `contract.*`); **shared Phase-9 gateway** (`src/lib/nphies/gateway.ts`) is the sole transport — no `eligibility-gateway.ts` fork; **no enum migration**; `ops_notifications` exists; use the method-aware `requireClinicalModule` guard.
- `EligibilityWorklistPane`: reuse `PatientBanner`; row rail = 19-step lifecycle chip trail + coverage/financial-type-lock badge + exception evidence; actions in `<CapGate cap role>` hidden/disabled per `canPerform` — verified caps: `claim.post` finance-only, `auth.decide` approval-only, `dep.approve` finance/rcm, `bill.discount` cashier.
- `ContractsPane` read-only this chunk (payer_agreement + contract_change_request timeline + before/after JSONB diff), gated by `mast.contracts`.
- Read-only-first; R2–R7 are Daylight stub **panes** (not routes); Daylight tokens only, halalas in mono, RTL-safe.

## Files (corrected)

```
new   src/components/clinical/daylight/nav-config.ts
new   src/components/clinical/daylight/EligibilityWorklistPane.tsx
new   src/components/clinical/daylight/ContractsPane.tsx
new   src/components/clinical/daylight/RcmHubPane.tsx
new   src/components/clinical/daylight/CapGate.tsx
new   src/lib/clinical/clinical-status.ts          # toneOf over real EligibilityStatus
new   src/hooks/use-clinical-role.ts               # calls GET /api/clinical/v1/me
edit  src/components/clinical/daylight/Shell.tsx    # data-driven nav, role prop, view-only chip, +TabIds
edit  src/routes/_authenticated/clinical.tsx        # render new panes in the tab switch; extend validateSearch
edit  src/lib/clinical-role-landing.ts              # extend MAP with RCM tabs (REUSE, don't recreate)
edit  src/lib/mds/drg-pricing.ts (or a shared money util) # single formatHalalas, imported everywhere

```

**No** `src/routes/_authenticated/clinical.rcm*.tsx` **/** `clinical.finance*.tsx` **files. No** `src/lib/clinical/role-landing.ts`**. No** `rcm-tones.ts`**. No** `format-money.ts`**.**

## DoD

- Sidebar renders from `NAV_SECTIONS` + `canViewModule`; zero `disabled` flags.
- New surfaces are **tabs inside** `clinical.tsx` (shared `DaylightShell`), reachable via `?tab=`; each of the 7 RCM roles lands on its tab via the extended `clinical-role-landing.ts`; `read_only` view-only.
- Eligibility worklist groups by the **real** `EligibilityStatus` union; tones + lifecycle chips + financial-type lock + halalas-in-mono render.
- Actions gated by `canPerform`. One shared `formatHalalas` and one shared `toneOf`.
- `tsgo` green; no migrations; no new endpoints; Phase-9 gateway sole transport.  

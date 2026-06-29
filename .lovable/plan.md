# Phase 8 — Portal Wiring for the Mini-HIS — REVISED

Frontend-only: consume the existing `/api/clinical/v1/*` endpoints from the three operator portals with shadcn/ui as-is. Patient app is a separate doc. Standing rule still applies (no orphan tables/ endpoints — though this phase adds almost none).

> Lovable's three-portal structure is right. Changes tagged **[AMENDED]** / **[NEW]**. Verified: no `me` endpoint exists; `admin-fetch.ts` exists; `admin.tsx`/`provider.tsx`/`superadmin.tsx` exist.

## One justified new endpoint [NEW]

There is no current-user endpoint, so UI role-gating has nothing to read. Add a tiny `src/routes/api/clinical/v1/me.ts` — GET → `{ userId, tenantId, role, clinicalRole }` from `requireTenant`. This is the only new API in the phase.

## Security note — UI gating is cosmetic [NEW]

`useClinicalRole()` hides tabs/actions for UX only. The **server routes (Phases 1–7) are the authorization boundary** via `requireClinicalRole`; hiding a button is never the control. Do not move any authorization decision into the client.

## Scope by portal

**Provider portal** — `src/routes/_authenticated/provider.tsx` + `src/components/provider/*`. Clinical workspace gated by `clinical_role` (via `me`). Journey tabs:

1. **Registration** (`registrar`) — Beneficiary search/create; attach Coverage (payer/TPA/network/plan/class).
2. **Encounters** (`physician`, `nurse`) — episode → encounter (OP/ER/IP); detail sub-panes: Diagnosis (ICD-10-AM, principal/secondary + POA), Vitals, Supporting-info notes (HPI/exam/plan), Care team, Orders (Lab/Rad/EP/Service/Rx — shows priced lines, in/out-of-network + preauth flags).
3. **Admission/Discharge** (`physician`, `case_manager`) — admit form; discharge form (disposition, separation mode, ventilation hours, cause of death when deceased; LOS shown).
4. **Coding & Grouper** (`coder`) — finalize Dx/procedures; IP "Run AR-DRG grouper" → assigned DRG + relative weight (disabled until discharged).
5. **Claims** (`biller`, `case_manager`) — "Assemble claim" on a finished(OP)/grouped(IP) encounter → itemized vs DRG-bundled view, pricing trace (incl. applied DRG adjustments + share split), FHIR bundle preview, **Mark Ready**, **Submit** (stub). Left rail `ClinicalSideNav`; role visibility hides unusable tabs (cosmetic, per note above).

**Admin tenant portal** — extend `src/routes/_authenticated/admin.tsx` + `src/components/admin/clinical/*`. Consumes Phase-3 master endpoints. Manages the tenant's **contractual** layer only:

- Insurance chain: Payers, TPAs, Networks, Insurance Plans, Network Membership.
- Service Master (multi-code rows: SBS + ACHI + LOINC), Drug Master (GTIN/MRID/SFDA).
- Price Lists & Items (incl. the `cost` list), **Pricing Rules — tenant overrides editable, global defaults shown read-only** **[AMENDED]**.
- **DRG contractual only: DRG Base Rates (per payer/network/version) + DRG Price Adjustments** (outliers/ICU/per-diem/same-day). **The DRG catalog itself is NOT here** — it's national reference, managed in superadmin. **[AMENDED — was "DRG catalog … Phase 6/7"; reference vs contractual split from Phase 3]**
- Read-only **Claims & Reconciliation**: charged total vs grouped DRG net vs patient/payer shares (the IP margin view; `cost_only` charges vs DRG payment).

**Superadmin portal** — extend `src/routes/_authenticated/superadmin.tsx`.

- **DRG reference catalog** (AR-DRG v9 codes/weights/trims) load + manage via `/api/admin/v1/drgs` (superadmin-gated, Phase 3). **[NEW — the reference layer lives here, not in admin tenant]**
- **Global** `pricing_rule` **defaults** (`tenant_id IS NULL`) management. **[NEW]**
- Cross-tenant **Clinical Operations**: read-only encounters/claims with tenant filter, status, totals.
- Confirm `/superadmin/api-docs` exposes Claims/Coding/Grouper tags.

## Shared frontend bits

- `src/lib/clinical-api.ts` — typed fetch around `/api/clinical/v1/*` mirroring `admin-fetch.ts`, envelope `{ error, code, request_id }` handling.
- `src/lib/clinical-roles.ts` — `useClinicalRole()` reading `me.clinicalRole`; gates UI only.
- `src/components/provider/*`: `BeneficiaryPicker`, `CoverageForm`, `EncounterTimeline`, `DiagnosisPicker`, `VitalsForm`, `SupportingInfoForm`, `OrderForms`, `AdmissionForm`, `DischargeForm`, `GrouperPanel`, `ClaimAssembler`, `ClaimDetail`, `FhirBundleViewer`.

## Out of scope

No new tables/migrations; the only new endpoint is `me`. No NPHIES real submission (Phase 9); no patient app; no marketing/branding changes.

## Acceptance

- Provider drives end-to-end against live APIs: register → encounter → Dx + vitals + notes → lab order → admit → discharge → code → grouper → assemble claim → mark ready → submit (stub).
- Admin manages contractual masters incl. DRG base rates + adjustments (but **not** the DRG catalog).
- Superadmin loads/manages the DRG reference catalog + global pricing defaults, and views cross-tenant claims read-only. **[AMENDED]**
- Role-gating verified cosmetic: a hidden action still 403s server-side if forced. **[NEW]**

## Delivery & Documentation milestone (standing DoD — most content lands here)

- `docs/his-user-manual.md` — this is the phase the user manual becomes real. Full role-based screen walkthroughs with the actual UI flow: registrar (register + coverage), physician/nurse (encounter, document, order), coder (code + grouper), biller (assemble + submit), tenant_admin (masters, price lists, DRG rates, pricing rules), superadmin (DRG catalog load, global defaults, cross-tenant view). Each screen: what it's for, who can use it, step-by-step.
- `docs/his-technical-manual.md` — frontend architecture: `clinical-api`/`clinical-roles`, the `me` endpoint, component inventory, and an explicit "UI role-gating is UX, not security — server enforces" subsection so the boundary is never misread.
- `docs/changelog.md` — Phase 8 entry.

## Files touched

```
src/routes/api/clinical/v1/me.ts                              (new — only new endpoint)
src/lib/clinical-api.ts | clinical-roles.ts                   (new)
src/routes/_authenticated/provider.tsx                        (extend: clinical workspace)
src/routes/_authenticated/admin.tsx                           (extend: Clinical section — contractual only)
src/routes/_authenticated/superadmin.tsx                      (extend: DRG reference + global defaults + cross-tenant)
src/components/provider/* | src/components/admin/clinical/*    (new)
docs/his-user-manual.md (major) | his-technical-manual.md | changelog.md   (update)

```

Out of scope (later): real NPHIES submission (Phase 9); strict validation (Phase 10); PROMs (Phase 11).

Approve and Lovable ships the `me` endpoint + components.  

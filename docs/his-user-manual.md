# VeloMed Mini-HIS — User Manual

## Access the HIS

- **Public deep link:** `/his` — authenticated staff bounce to the launcher, unauthed users go to `/auth?next=/launch`. Marketing chrome surfaces this as the discreet "Staff login" link.
- **Single sign-in:** all staff sign in via `/auth`. The `?next=` parameter is validated server-side (same-origin absolute path only) and honoured only when the resolved role is authorised for the target.
- **Role-aware launcher (`/launch`):** loads platform roles + the active tenant's `clinical_role`, then routes single-destination users straight through (physician → `/clinical`, RCM officer → `/clinical` with RCM modules, superadmin → `/superadmin`). Multi-destination users see a card launcher.
- **Multi-tenant users** see a tenant picker on first sign-in; the choice persists in `localStorage`.
- **Module visibility:** `/clinical` filters its left rail by `modulesForRole(clinicalRole)`. `read_only` sees every module (view-only).
- **Manuals:** Superadmin → Documentation surfaces the HIS User Manual, HIS Technical Manual, RCM User Manual, and Changelog. The same content is served by `GET /api/clinical/v1/docs/{slug}` and `GET /api/clinical/v1/docs/{slug}/{module}` for any tenant member.

## Coder workflow (Phase 6)

### 1. Finalize coding

After an inpatient encounter is **discharged**:
1. Confirm the principal diagnosis (ICD-10-AM) and that all additional diagnoses include a Present-On-Admission (POA) flag.
2. Open the encounter → **Coding** → **Finalize**.
3. The system records the coder, sets status `coded`, and advances the encounter to `coded`.
4. Editing later flips the status to `amended` while preserving the audit trail.

### 2. Run the DRG grouper

1. With the encounter in `coded`, open **Coding → Run grouper**.
2. The system assembles the MDS (Dx + POA, ACHI procedures from charges, LOS, age at admission, ventilation hours, separation mode, birth weight) and sends it to the configured external AR-DRG grouper.
3. The returned DRG (code + version + MDC/ADRG + complexity) is stored as the active assignment; the encounter advances to `grouped`.

### 3. Re-group an amended episode

- Running the grouper again without changes is a no-op (returns the existing assignment).
- Pass `force: true` to record a new assignment. The previous one is marked `superseded` automatically.

### Why discharge is required

AR-DRG codes a completed episode of care: length of stay, mechanical-ventilation hours, and separation mode must be final. Attempting to code before discharge returns `not_discharged`.

### What `superseded` means

Each grouper run is preserved. Only one row per encounter is `assigned` (current); historical runs become `superseded` but remain available via `GET /encounters/:id/drg`.
## Phase 8 — Clinical Workspace screens

### Provider — `/clinical`
Tabbed workspace with role-aware visibility. UI gating is cosmetic; the server enforces via `requireClinicalRole`.

- **Registration** (`registrar`) — Search/create beneficiary, attach Coverage (payer/network/plan/member_id).
- **Encounters** (`physician`, `nurse`, `case_manager`) — Browse encounters, record Vitals, add ICD-10-AM Diagnoses, Admit (IP) and Discharge.
- **Coding · DRG** (`coder`, `case_manager`) — List inpatient encounters; "Run grouper" on discharged/coded encounters.
- **Claims** (`biller`, `case_manager`, `cashier`) — Assemble claim from a finished encounter; view itemized vs DRG bundle totals; preview FHIR Bundle; Mark Ready; Submit (Phase 7 stub — real NPHIES is Phase 9).

### Admin tenant — `/clinical-masters`
Four contractual groups: Insurance Chain, Service Catalog, Pricing, DRG (Base Rates + Price Adjustments). The DRG **catalog** (codes/weights) is reference data — managed in the superadmin portal, not here.

### Superadmin — `/clinical-superadmin`
Cross-tenant claims, read-only. Filter by tenant and status; view billing model, patient/payer share and grand total.

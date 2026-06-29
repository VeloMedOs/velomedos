# Phase 3 — Master Data (Insurance Chain · Multi-Coded Services · Drugs · Price Lists · DRG) — REVISED

Reference layer all downstream phases pivot on: the NPHIES insurance chain (TPA/Policy/Class/ Plan/Network), a multi-coded Service Master (SBS + ACHI + LOINC), Drug Master (GTIN/MRID/SFDA), itemized Price Lists for outpatient billing, and the typed AR-DRG v9.0 tables for inpatient bundled pricing. Standing rule: **API-first, fully wired — no orphan tables, no stubbed handlers.**

> Lovable's draft was thorough and the hard parts were right (multi-coded `service_code` with partial-unique primary billing, drug GTIN/MRID, typed DRG tables keyed by version, coverage FK backfill, `assertMasterOwnership`). Changes are tagged **[AMENDED]** / **[NEW]**; untagged content is kept as proposed.

## Reference vs contractual split (the conceptual spine) [AMENDED]

Two authorization domains, never mixed:

- **National reference** (`drg`, plus the Phase-0 `code_system`/`code_value`) — CHI/SFDA-licensed, identical across all tenants, **platform-loaded** and gated by the existing control plane (`has_role(auth.uid(),'superadmin')` / `is_portal_staff`), NOT by tenant clinical roles, NOT by RLS. A CHI AR-DRG version bump is then a single platform load, not a per-tenant migration.
- **Tenant contractual** (everything else, incl. `drg_base_rate`, `drg_price_adjustment`) — each tenant's negotiated deal, tenant-scoped + RLS, managed by `tenant_admin`.

## 1. Supabase migration — 15 tables [AMENDED count: 15, not 13]

All tenant-scoped via `is_tenant_member` + GRANT → ENABLE RLS → POLICY → `touch_updated_at()`, **except** `drg` which is tenant-agnostic reference (read = authenticated, write = none at the RLS layer; loaded only by the platform — see §3).

### Insurance chain (7 tables) [AMENDED — header previously said 6; it is 7]

- `payer` — `tenant_id`, `nphies_payer_id text NOT NULL`, `name`, `payer_type CHECK IN ('public','private')`, `active`. `UNIQUE (tenant_id, nphies_payer_id)`.
- `tpa` — `tenant_id`, `nphies_tpa_id text NOT NULL`, `name`, `active`. `UNIQUE (tenant_id, nphies_tpa_id)`. **[AMENDED — dropped** `payer_id`**. TPA↔payer is many-to-many in KSA (a TPA administers for many insurers); the applicable payer+TPA pairing is captured on** `coverage`**, not pinned here. Add a** `tpa_payer` **join table only if you must constrain valid pairings.]**
- `policy` — `tenant_id`, `payer_id fk→payer`, `policy_number text NOT NULL`, `name`, `effective_date`, `expiry_date`, `active`. `UNIQUE (tenant_id, policy_number)`.
- `insurance_class` — `tenant_id`, `policy_id fk→policy ON DELETE CASCADE`, `code NOT NULL`, `name`. `UNIQUE (policy_id, code)`.
- `insurance_plan` — `tenant_id`, `class_id fk→insurance_class ON DELETE CASCADE`, `code NOT NULL`, `name`, `copay_percent numeric`, `deductible_minor int`, `annual_limit_minor int`. `UNIQUE (class_id, code)`.
- `network` — `tenant_id`, `payer_id fk→payer`, `name`, `tier text`, `active`.
- `network_membership` — `tenant_id`, `network_id fk→network ON DELETE CASCADE`, `provider_facility_id uuid NOT NULL fk→clinics` **[AMENDED — was** `provider_ref` **validated against "tenant_members or corporate_accounts" (mixed person/org grain). Network participation is facility/org-level. Bind to the facility entity that carries the NPHIES provider ID. If** `clinics` **doesn't already have an** `nphies_provider_id` **column, add it; if** `clinics` **is the wrong grain in your model, create a small** `facility` **master and point this + encounter at it.]**, `in_network bool DEFAULT true`. `UNIQUE (network_id, provider_facility_id)`.

**Backfill Phase-1** `coverage` **[AMENDED — +**`tpa_id`**]**: FK columns `payer_id`, `policy_id`, `insurance_plan_id`, `network_id` already exist; **add** `tpa_id uuid NULL` **too**, then add the actual FKs (`ALTER TABLE coverage ADD CONSTRAINT … REFERENCES … ON DELETE SET NULL`) for all five. No data migration.

**Also bind the Phase-2 placeholder** **[NEW]**: `ALTER TABLE encounter ADD CONSTRAINT … location_id REFERENCES clinics(id) ON DELETE SET NULL` (and, if you keep `service_provider` as a provider ref, FK it to the same facility entity). Resolves the dangling `location_id`.

### Service Master (2 tables)

- `service_master` — `tenant_id`, `internal_code NOT NULL`, `name NOT NULL`, `description`, `service_type NOT NULL CHECK IN (laboratory|imaging|procedures|services|medical-devices| oral-health-ip|oral-health-op|transportation-srca)`, `modality text`, `is_package bool`, `body_site text`, `active`. `UNIQUE (tenant_id, internal_code)`. Index `(tenant_id, service_type, active)`.
- `service_code` — `tenant_id`, `service_id fk→service_master ON DELETE CASCADE`, `code_system_id fk→code_system`, `code NOT NULL`, `display`, `is_primary_billing bool DEFAULT false`. `UNIQUE (service_id, code_system_id, code)`. Partial `UNIQUE (service_id) WHERE is_primary_billing`. **[Phase-10 note]** `is_primary_billing` **must reference a billing-kind** `code_system` **(SBS) — marking an ACHI/LOINC code as primary billing is a silent costing error. Enforce in Phase 10.**

### Drug Master (1 table)

- `drug_master` — `tenant_id`, `internal_code NOT NULL`, `generic_name NOT NULL`, `trade_name`, `form`, `strength`, `route`, `gtin text`, `mrid text`, `sfda_sci_code text`, `atc_code text`, `active`. `UNIQUE (tenant_id, internal_code)`. Indexes `(tenant_id, gtin)`, `(tenant_id, mrid)`.

### Price Lists — outpatient itemized (2 tables)

- `price_list` — `tenant_id`, `name NOT NULL`, `list_type CHECK IN ('cash','payer_network')`, `payer_id fk→payer NULL`, `network_id fk→network NULL`, `currency DEFAULT 'SAR'`, `effective_date`, `expiry_date`, `active`. CHECK: `list_type='cash' OR payer_id IS NOT NULL`.
- `price_list_item` — `tenant_id`, `price_list_id fk→price_list ON DELETE CASCADE`, `service_id fk→service_master NULL`, `drug_id fk→drug_master NULL`, `unit_price_minor int NOT NULL CHECK (>=0)`, `default_factor numeric DEFAULT 1`, `patient_share_percent numeric`, `tax_percent numeric`, `is_package bool`. CHECK: `(service_id IS NOT NULL) <> (drug_id IS NOT NULL)`. Indexes `(price_list_id)`, `(tenant_id, service_id)`, `(tenant_id, drug_id)`.

### AR-DRG pricing (3 tables)

- `drg` — **tenant-agnostic reference**. `code_system_id fk→code_system` (AR-DRG v9.0), `drg_code NOT NULL`, `drg_name`, `mdc`, `adrg`, `partition CHECK IN ('medical','intervention')`, `version NOT NULL`, `relative_weight numeric NOT NULL`, `low_trim_los int`, `high_trim_los int`, `avg_los numeric`, `active`. `UNIQUE (drg_code, version)`. RLS: `SELECT TO authenticated USING (true)`; **no INSERT/UPDATE/DELETE policy at all** — writes occur only via the platform loader (§3), never through a tenant route.
- `drg_base_rate` — `tenant_id`, `payer_id fk→payer`, `network_id fk→network NULL`, `drg_version NOT NULL`, `base_rate_minor int NOT NULL`, `currency DEFAULT 'SAR'`, `effective_from`, `effective_to`. Index `(tenant_id, payer_id, drg_version, effective_from DESC)`.
- `drg_price_adjustment` — `tenant_id`, `payer_id fk→payer NULL`, `drg_version`, `adj_type CHECK IN ('high_outlier','low_outlier','short_stay','icu_addon','sameday','transfer')`, `trim_basis CHECK IN ('los','cost')`, `per_diem_minor int NULL`, `marginal_rate numeric NULL`, `threshold numeric NULL`, `formula jsonb`, `priority int DEFAULT 0`, `active`.

### Seed [AMENDED]

- **Do NOT re-seed** `code_system`**.** Phase 0 owns the ten systems incl. `ar-drg` (9.0), `sbs` (3), `achi` (10th), `loinc`, `icd-10-am`. Reference them by key. If one is missing, fix Phase 0 — re-inserting here risks a duplicate `ar-drg` row at a different version and downstream drift.
- Leave `drg` empty; the AR-DRG v9 weights are a CHI-licensed file loaded via the platform loader. Document the loader contract in the loader docstring. Phase 10 enforces presence.

## 2. Zod schemas — `src/lib/mds/schema/masters.ts`

`Payer*`, `Tpa*` **(no** `payer_id`**)**, `Policy*`, `InsuranceClass*`, `InsurancePlan*`, `Network*`, `NetworkMembershipCreate` **(**`provider_facility_id`**)**, `ServiceMaster*`, `ServiceCodeCreate` (`is_primary_billing`), `DrugMaster*`, `PriceList*`, `PriceListItem*` (refine: exactly one of `service_id|drug_id`), `Drg*`, `DrgBaseRate*`, `DrgPriceAdjustment*`. Permissive in Phase 3; strict in Phase 10.

## 3. Routes

**Tenant masters** — `src/routes/api/clinical/v1/masters/`: `preflight()`, `requireTenant` reads, `requireClinicalRole('tenant_admin')` writes, `clinicalAudit`, envelope, tenant-ownership guard on `$id` writes.

- Insurance chain — `payers(.$id)`, `tpas(.$id)`, `policies(.$id)`, `insurance-classes(.$id)`, `insurance-plans(.$id)`, `networks(.$id)`, `networks.$id.memberships` + `network-memberships.$id`.
- Catalogs — `services(.$id)`, `services.$id.codes` + `service-codes.$id`, `drugs(.$id)`.
- Price lists — `price-lists(.$id)`, `price-lists.$id.items` + `price-list-items.$id`.
- DRG **contractual** — `drg-base-rates(.$id)`, `drg-adjustments(.$id)` (tenant_admin).

**DRG reference loader** **[AMENDED — moved out of the tenant namespace]** — `src/routes/api/admin/v1/drgs.ts` (+ `drgs.$id.ts`): GET list (filters `version`, `mdc`, `active`) for any authenticated user; **write gated by the control plane (**`requireAdmin` **/ superadmin /** `is_portal_staff`**)** — the handler uses the service client, so RLS does NOT protect it; the explicit role check does. This mirrors how `code_value` reference data is loaded. Tenants never POST `drg`.

## 4. Phase-1 coverage wiring

`coverage.ts` POST/PATCH validate that supplied `payer_id`, `tpa_id`, `policy_id`, `insurance_plan_id`, `network_id` belong to the caller's tenant — extend `_helpers.ts` with `assertMasterOwnership(table, id, tenantId)`. No FHIR mapper changes.

## 5. OpenAPI

Extend `src/lib/openapi-clinical-spec.ts` with tags `Payers, TPAs, Policies, InsuranceClasses, InsurancePlans, Networks, Services, Drugs, PriceLists, DRGBaseRates, DRGAdjustments`; add the DRG **reference** paths to the **admin** spec (`openapi-admin-spec.ts`), not the clinical one, since it lives under `/api/admin/v1`. Schemas for every create/update + DTO; 200/201/400/401/403/404/409/422.

## 6. Verification

- `bun run build` green; `tsgo` clean; existing Playwright suites pass.
- Swagger smoke:
  1. payer → tpa → policy → class → plan → network → membership end-to-end; membership references a `clinics` facility (foreign-tenant facility → 404).
  2. Phase-1 coverage referencing new `payer_id`+`tpa_id`+`policy_id` succeeds; foreign-tenant payer → 404. **[AMENDED — +tpa_id]**
  3. Procedure service with two `service_code` rows: `sbs` (`is_primary_billing=true`) + `achi`; marking a second primary → 409.
  4. Drug with `gtin` + `mrid` + `sfda_sci_code`.
  5. Cash price list + items; item with both `service_id` and `drug_id` → CHECK rejects.
  6. **DRG reference: POST to** `/api/admin/v1/drgs` **as a non-superadmin → 403; as superadmin → 201; authenticated GET returns rows. Confirms the write-auth is the role check, not RLS.** **[AMENDED]**
  7. `drg_base_rate` + one `high_outlier` `drg_price_adjustment` for a payer (tenant_admin).
  8. Tenant B cannot read tenant A's payer/service/price-list (404).
- `psql`: RLS enabled on **all 14 tenant-scoped tables** (`drg` excepted — SELECT-only policy, no write policy); grants present; partial-unique on `service_code(is_primary_billing)` fires; `price_list_item` CHECK fires; `encounter.location_id` + `coverage.tpa_id` FKs present. **[AMENDED count]**
- **API coverage:** every tenant table reachable through its `masters/` routes; `drg` reference via `/api/admin/v1/drgs`. No orphan tables.

## Files touched

```
supabase migration (15 tables + RLS + grants + indexes + checks;
                    coverage FK backfill incl. tpa_id; encounter.location_id FK;
                    NO code_system re-seed; drg has SELECT-only RLS)
src/lib/mds/schema/masters.ts                                 (new)
src/routes/api/clinical/v1/_helpers.ts                        (extend: assertMasterOwnership)
src/routes/api/clinical/v1/masters/payers.ts | payers.$id.ts          (new)
src/routes/api/clinical/v1/masters/tpas.ts | tpas.$id.ts              (new; no payer_id)
src/routes/api/clinical/v1/masters/policies.ts | policies.$id.ts      (new)
src/routes/api/clinical/v1/masters/insurance-classes.ts | .$id.ts     (new)
src/routes/api/clinical/v1/masters/insurance-plans.ts | .$id.ts       (new)
src/routes/api/clinical/v1/masters/networks.ts | networks.$id.ts      (new)
src/routes/api/clinical/v1/masters/networks.$id.memberships.ts        (new)
src/routes/api/clinical/v1/masters/network-memberships.$id.ts         (new)
src/routes/api/clinical/v1/masters/services.ts | services.$id.ts      (new)
src/routes/api/clinical/v1/masters/services.$id.codes.ts | service-codes.$id.ts (new)
src/routes/api/clinical/v1/masters/drugs.ts | drugs.$id.ts            (new)
src/routes/api/clinical/v1/masters/price-lists.ts | price-lists.$id.ts (new)
src/routes/api/clinical/v1/masters/price-lists.$id.items.ts | price-list-items.$id.ts (new)
src/routes/api/clinical/v1/masters/drg-base-rates.ts | .$id.ts        (new; tenant_admin)
src/routes/api/clinical/v1/masters/drg-adjustments.ts | .$id.ts       (new; tenant_admin)
src/routes/api/admin/v1/drgs.ts | drgs.$id.ts                         (new; superadmin-gated reference loader)
src/lib/openapi-clinical-spec.ts                              (extend: tags + schemas + paths)
src/lib/openapi-admin-spec.ts                                 (extend: DRG reference paths)
src/routes/api/clinical/v1/coverage.$id.ts                    (extend: master-ownership incl. tpa_id)
src/routes/api/clinical/v1/beneficiaries.$id.coverage.ts      (extend: master-ownership incl. tpa_id)

```

Out of scope (deferred): order/result resources (Phase 4); admission/discharge + populating grouper inputs (Phase 5); DRG grouping + pricing math (Phase 6/7); strict MDS + LOV-bound code validation (Phase 10).

Essential Delivery Milestone:  
Document all phases in the project Files under HIS User Manual , and Technical Manual 
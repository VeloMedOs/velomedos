# Phase 4 — Orders, Investigations, Pricing (IP/OP Branch) + Rule Engine — REVISED

Clinical orders layer + the pricing/rule engine that bifurcates by encounter `reimbursement_model` (itemized SBS for OP/ER vs DRG-bundled for IP). Strictly additive. Standing rule: **API-first, fully wired — no orphan tables, no stubbed handlers.**

> Lovable's draft was faithful. Changes tagged **[AMENDED]** / **[NEW]**; untagged content kept as proposed. Collision check passed — existing `work_orders`/`screening_orders` are the mobility domain; the clinical order tables are greenfield.

## 1. Database migration

**Order headers + items** (tenant-scoped, RLS via `is_tenant_member`, FK `encounter_id`):

- `lab_order` / `lab_order_item` — LOINC, specimen, result_value/unit/status, result_at
- `radiology_order` / `radiology_order_item` — modality, body_site, report_text/status, performed_at
- `electrophysiology_order` / `ep_order_item` — study_type (EEG/EMG/NCS/ECG), interpretation, performed_at
- `service_order` / `service_order_item` — refs `service_master` (ACHI via `service_code`)
- `prescription` / `prescription_item` — refs `drug_master`; dose, frequency, duration, quantity_code, pharmacist substitute fields, `dispense_status text NULL`**,** `dispensed_at`**,** `dispensed_by` **[AMENDED — dispensing is per item, not on the header]**

**[NEW] Pre-authorization columns on each order header** (nullable now, NPHIES-wired in Phase 9): `preauth_required bool DEFAULT false`, `preauth_ref text NULL`, `preauth_status text NULL CHECK IN ('not_required','pending','approved','rejected')`. Insured imaging/procedures/high-cost items commonly need NPHIES authorization before the claim; the rule engine (`eligibility` scope) sets `preauth_required`.

**Charge bridge** — `charge_item`, one per ordered line (NPHIES Item analogue):

- **Traceability [AMENDED — make explicit]**: `tenant_id`, `encounter_id NOT NULL`, `order_item_table text NOT NULL`, `order_item_id uuid NOT NULL` (polymorphic link to the source line), so Phase 7 claim assembly can map and cancellation can propagate.
- Snapshot columns: `sbs_code`, `achi_code`, `loinc_code`, `gtin`, `mrid`, `internal_code`, `description`, `quantity`, `unit_price_minor`, `factor`, `discount_minor`, `tax_minor`, `patient_share_minor`, `payer_share_minor`, `net_minor`, `price_list_id`, `pricing_mode enum (cash|insured|drg_bundled)`, `cost_only bool`, `in_network bool` **[NEW — records the network determination]**, `rule_trace jsonb`, `status enum`, `body_site`, `ordered_by`, `ordered_at`. Money = integer halalas; `currency` default 'SAR'.

**Rule engine table** — `pricing_rule`: `tenant_id uuid NULL` **[AMENDED — NULLABLE: tenant_id NULL = system-default rule the engine falls back to; a tenant row overrides by priority]**, `name`, `scope enum (eligibility|share|package|substitution|drg_outlier)`, `priority int`, `condition jsonb`, `action jsonb`, `active bool`.

- RLS: a tenant reads its own rows **plus** the global (`tenant_id IS NULL`) defaults; only `service_role`/superadmin writes global defaults; `tenant_admin` writes its own.

**[NEW] IP cost basis** — for `drg_bundled` `cost_only` lines the resolver still needs a unit figure. Add `'cost'` to `price_list.list_type` (a tenant cost/standard list). The resolver prices IP cost-only lines against the active `cost` list, falling back to the cash list (flagged in `rule_trace`). Without this, `net_minor` for IP lines has no source.

**Enums**: `charge_pricing_mode`, `charge_status`, `order_status`, `pricing_rule_scope`, `preauth_status`.

**Triggers**:

- `tg_orders_advance_journey` on each `*_order` insert → bumps `encounter.journey_state` to `investigations_ordered` if currently `clinically_documented` or earlier. (Permissive; Phase 10 enforces that documentation/medical-necessity precedes ordering.)
- `touch_updated_at` on every new table.

**Seed [AMENDED — not "runtime"]**: insert the system-default `pricing_rule` rows (`tenant_id NULL`) in this migration: `share` copay from `plan.copay_percent`; `eligibility` non-covered → 100% patient + flag preauth where configured; `cash` → 100% patient; `out_of_network` → elevated patient share. Tenants override via their own rows.

**GRANTs**: SELECT/INSERT/UPDATE/DELETE to `authenticated`, ALL to `service_role`; no `anon`.

## 2. Pricing resolver — `src/lib/mds/pricing.ts`

`resolvePrice({ tenantId, encounterId, serviceId|drugId, quantity })`:

1. Load encounter + active `coverage`. Mode:
  - `reimbursement_model='drg_bundled'` → `{ pricing_mode:'drg_bundled', cost_only:true, net_minor = cost-list price (see IP cost basis), patient/payer share = 0 (deferred to Phase 7) }`.
  - No active coverage → `cash`.
  - Active coverage → `insured`. Resolve chain `coverage → insurance_plan → insurance_class → policy → payer` **and TPA via** `coverage.tpa_id` **[AMENDED — Phase 3 added tpa_id]**.
2. **Network determination [AMENDED — two-sided]**: take the patient's `coverage.network_id`, then check `network_membership(network_id, provider_facility_id = encounter.location_id, in_network=true)`. In-network → standard share; **out-of-network → set** `in_network=false` **and apply the** `out_of_network` **rule (elevated patient share / possible non-coverage)**. Don't just "resolve a network" — the provider must be in the *patient's* network.
3. Itemized `price_list` pick: `cash` → tenant cash list; `insured` → match payer+network, fallback payer-only, fallback cash (flagged in `rule_trace`).
4. `price_list_item`; `net = qty*unit*factor − discount + tax`.
5. Rule engine splits patient/payer share (global defaults + tenant overrides); set `preauth_required` if an `eligibility` rule fires. Append every step to `rule_trace`.
6. Snapshot all codes (sbs/achi/loinc/gtin/mrid, internal_code, description) from `service_code`/`drug_master` onto the charge row, plus `in_network` and `preauth_required`.

## 3. Rule engine — `src/lib/mds/rules.ts`

Deterministic, priority-ordered evaluator over `pricing_rule` filtered by `(tenant_id = ctx OR tenant_id IS NULL)` + scope. `drg_outlier` rules are loaded but consumed only in Phase 7.

## 4. Zod schemas — `src/lib/mds/schema/orders.ts`

Create/update per order header + item (+ preauth fields), `ChargeItemRead`, `PricingRuleCreate/ Update` **[NEW]**. Item creates omit price fields (resolver fills). Role hints in handlers.

## 5. API routes — `src/routes/api/clinical/v1/`

Per modality: GET (list orders+items for encounter) + POST (create header+items; resolver per item; `charge_item` written in the same transaction; journey trigger fires). `requireTenant` + `requireClinicalRole`, envelope, `clinicalAudit` on writes, `assertMasterOwnership` for `service_id|drug_id|price_list_id`. Cross-tenant → `not_found`.

- `encounters.$id.orders.lab.ts` — POST `lab_tech|physician|tenant_admin`
- `encounters.$id.orders.radiology.ts` — `radiologist|physician|tenant_admin`
- `encounters.$id.orders.electrophysiology.ts` — `physician|tenant_admin`
- `encounters.$id.orders.service.ts` — `physician|nurse|tenant_admin`
- `encounters.$id.prescriptions.ts` — POST `physician|tenant_admin`
- `encounters.$id.charges.ts` — GET aggregated `charge_item` + totals (gross/discount/tax/patient/ payer/net), filter by status; read-only any tenant role.
- Per-item PATCH/DELETE: `orders/lab-items.$id.ts`, `orders/radiology-items.$id.ts`, `orders/ep-items.$id.ts`, `orders/service-items.$id.ts`, `prescription-items.$id.ts` (PATCH results/**dispense per item**/status; DELETE = cancel → sets status, marks linked `charge_item` cancelled).
- `masters/pricing-rules.ts` **+** `pricing-rules.$id.ts` **[NEW — closes the API-coverage gap;** `tenant_admin` **manages its own rules; global defaults are read-only to tenants]**

## 6. OpenAPI

Extend `src/lib/openapi-clinical-spec.ts`: tags **Orders/Lab, Orders/Radiology, Orders/Electrophysiology, Orders/Service, Prescriptions, Charges, PricingRules**; paths for every new route (incl. pricing-rules); schemas for headers, items, `ChargeItem`, `PricingRule`, preauth.

## 7. Verification

- Typecheck clean; Supabase linter passes.
- Acceptance:
  1. OP insured + in-network lab → `pricing_mode='insured'`, `in_network=true`, split per copay, `rule_trace` populated.
  2. OP insured + **out-of-network** facility → `in_network=false`, elevated patient share per the out_of_network rule. **[NEW]**
  3. OP cash → `pricing_mode='cash'`, 100% patient.
  4. IP lab → `cost_only=true`, `pricing_mode='drg_bundled'`, `net_minor` sourced from the cost list, patient/payer share = 0. **[AMENDED — assert net comes from cost basis]**
  5. Insured imaging flagged `preauth_required=true` by an eligibility rule. **[NEW]**
  6. Update `price_list_item.unit_price_minor` → prior `charge_item` snapshot unchanged.
  7. Cancel an order item → linked `charge_item` flips to cancelled (traceability holds). **[NEW]**
- **API coverage:** every order/item table via its modality + item routes; `charge_item` via order POST + `charges` GET + item cancel; `pricing_rule` via `masters/pricing-rules`. No orphan tables.

## 8. Delivery & Documentation milestone [NEW — standing, applies from Phase 0 forward]

Every phase's **Definition of Done** now includes updating two living documents (greenfield — create `docs/` this phase; backfill Phases 0–3 retroactively):

- `docs/his-technical-manual.md` — for engineers/integrators. Per phase, append: the data model (tables, keys, RLS, enums, triggers — an ERD section per domain), the API reference (link to the OpenAPI spec at `/api/clinical/v1/openapi` + `/api/admin/v1/openapi`, plus the non-API context the spec can't carry), the pricing/rule-engine + DRG logic, the state machines (clinical status + MDS journey), the code-system/versioning model, and the security model (tenant guard, RLS, reference-vs-contractual split). The OpenAPI specs are the API-reference backbone; this manual is the architecture + business-logic layer around them.
- `docs/his-user-manual.md` — for end users, role-based task guides for what each phase ships: registrar (register patient + coverage), physician (open encounter, document, diagnose, order, prescribe), nurse (vitals, orders), coder (code + group — Phase 6), pharmacist (dispense), tenant_admin (masters, price lists, DRG rates, pricing rules), patient (the patient-app surfaces).

Mechanics: the phase isn't "done" until both manuals are updated for the features it shipped. Recommend Lovable generate a `docs/changelog.md` entry per phase referencing the migration + routes, and that the technical manual's API section be regenerated from the OpenAPI spec each phase so it never drifts. (Fold this DoD into the master build doc's cross-cutting reminders so it's enforced every phase, not just Phase 4.)

## Files touched

```
supabase migration (10 order tables + charge_item + pricing_rule; preauth cols; cost list_type;
                    enums; journey/touch triggers; system-default pricing_rule seed)
src/lib/mds/pricing.ts                                        (new; two-sided network, IP cost basis)
src/lib/mds/rules.ts                                          (new; global+tenant rules)
src/lib/mds/schema/orders.ts                                  (new; +PricingRule, +preauth)
src/routes/api/clinical/v1/encounters.$id.orders.lab.ts                       (new)
src/routes/api/clinical/v1/encounters.$id.orders.radiology.ts                 (new)
src/routes/api/clinical/v1/encounters.$id.orders.electrophysiology.ts         (new)
src/routes/api/clinical/v1/encounters.$id.orders.service.ts                   (new)
src/routes/api/clinical/v1/encounters.$id.prescriptions.ts                    (new)
src/routes/api/clinical/v1/encounters.$id.charges.ts                          (new)
src/routes/api/clinical/v1/orders/lab-items.$id.ts | radiology-items.$id.ts |
   ep-items.$id.ts | service-items.$id.ts | prescription-items.$id.ts         (new)
src/routes/api/clinical/v1/masters/pricing-rules.ts | pricing-rules.$id.ts    (new)
src/lib/openapi-clinical-spec.ts                              (extend: tags + schemas + paths)
docs/his-technical-manual.md | docs/his-user-manual.md | docs/changelog.md    (new; backfill 0–3)

```

Out of scope (later): DRG grouping + bundle pricing (Phase 6–7), claim assembly (Phase 7), admission/discharge MDS (Phase 5), strict NPHIES validation (Phase 10).

Approve and Lovable ships the migration first for review, then the code batch.
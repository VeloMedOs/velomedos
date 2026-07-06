# Step 1 — Turn 2 (CORRECTED v1.1, schema-verified @758f4bc): M14 Seeds + M15 Fixes + Code Layer

Sequence: **M14 (seeds) → M15 (function fixes) → TS/API/UI**. All SQL below is verified against the live schema — do not re-derive column names; the pre-flight queries are already done and encoded here.

## Verified schema facts (do not deviate)

- `refund_request` has **no** `claim_id`**, no** `encounter_id` — only `deposit_id`. `deposit` carries `encounter_id` AND `admission_request_id`. Refund statuses: pending → approved → executed (plus held/rejected).
- `cash_status` = ('draft','posted','voided') — voided cash refunds are auto-excluded by the existing `status='posted'` filter; no extra refund clause needed for cash, but the TS mirror must keep that filter.
- `charge_status` = ('ordered','collected','in_progress','resulted','dispensed','cancelled'). The literals `performed/released/completed/executed` do not exist.
- `encounter.class` is **text** with CHECK ('AMB','EMER','IMP','HH','VR'). Day case is NOT a class: it is `admission_request.request_type = 'day_case'` (`ip_request_type` enum: surgery, procedure, cath, medical, day_case).
- `admission_request` has `requested_deposit_minor`, `paid_amount_minor`, `coverage_id`, `encounter_id` — but **no** `estimated_charges_minor` (M15 adds it).
- `authorization_request.encounter_id` exists — the D3 join is valid.
- `preauth_required` exists on **three** levels: order-item tables (resolved per order), `service_master`, and `drug_master` (catalog defaults). Order-item flag is authoritative; masters are conservative fallback.
- `rcm_admin_config_get(_tenant uuid, _key text, _default jsonb DEFAULT NULL) RETURNS jsonb` — extract scalars with `#>> '{}'`.
- `pricing_rule_scope` **already contains** 'referral' and 'pbm' (landed in M05). M14 must not touch the type.

---

## M14 — Seeds (data only — NO type/DDL changes)

1. `rcm_admin_config` per-tenant defaults (loop `corporate_accounts`, `ON CONFLICT DO NOTHING`): `ip_deposit_min_percent=35`, `self_pay_release="full"`, `override_roles=["rcm"]`, `er_supply_days_max=7`, `wallet_block_scope="all_orders"`, `op_dispense_days_max=14`, `installment_policy={}`, `indication_severity_default="block"`.
2. R-PBM1–R-PBM6 as `pricing_rule` rows `scope='pbm'` (tenant_id NULL, active=true).
3. Referral Rules A–E as `pricing_rule` rows `scope='referral'` per Addendum 1-A payloads.

Delete any "add enum values / convert to text check" pre-flight — the scope values exist; adding DDL here would violate the one-concern-per-migration rule.

---

## M15 — Function fixes (`CREATE OR REPLACE`, preserve `SET search_path = public` + security context)

### M15.0 — Schema prerequisite (same migration, ordinary ADD COLUMN — safe)

```sql
ALTER TABLE public.admission_request
  ADD COLUMN IF NOT EXISTS estimated_charges_minor bigint NULL;

```

### D1 · Scoped refund re-lock in `charge_is_billed()`

Remove the dead `_refunded … NULL;` block and its mis-scoped query. Replace with (deposit is the only linkage path):

```sql
IF EXISTS (
  SELECT 1
    FROM public.refund_request r
    JOIN public.deposit d ON d.id = r.deposit_id
   WHERE r.tenant_id = _charge.tenant_id
     AND r.status IN ('approved','executed')
     AND (
       d.encounter_id = _charge.encounter_id
       OR d.admission_request_id IN (
            SELECT ar.id FROM public.admission_request ar
             WHERE ar.encounter_id = _charge.encounter_id)
     )
) THEN
  RETURN false;  -- releasing exceptions already short-circuited above
END IF;

```

### D2 · Encounter-class branch + drg_bundled release

Insert before the pricing-mode branches:

```sql
SELECT class INTO _class FROM public.encounter WHERE id = _charge.encounter_id;

SELECT id, request_type INTO _adm_id, _adm_type
  FROM public.admission_request
 WHERE encounter_id = _charge.encounter_id
   AND status NOT IN ('cancelled','rejected')          -- use actual admission status literals
 ORDER BY created_at DESC LIMIT 1;

IF _class = 'IMP' OR (_adm_id IS NOT NULL AND _adm_type = 'day_case') THEN
  IF _adm_id IS NULL THEN RETURN false; END IF;
  IF NOT public.admission_gate_open(_adm_id) THEN RETURN false; END IF;

  -- Per-order auth only for auth-required items.
  -- Authoritative: the order item's own preauth_required (resolved at ordering);
  -- masters are conservative catalog fallback (either flag => auth required).
  IF public._order_item_preauth_required(_tbl, _id)          -- helper below
     OR COALESCE((SELECT preauth_required FROM public.service_master WHERE id = _charge.service_id), false)
     OR COALESCE((SELECT preauth_required FROM public.drug_master    WHERE id = _charge.drug_id), false)
  THEN
    RETURN EXISTS (
      SELECT 1 FROM public.authorization_item ai
       WHERE ai.charge_item_id = _charge.id AND ai.decision IN ('approved','partial')
    );
  END IF;
  RETURN true;  -- includes pricing_mode='drg_bundled'; admission gate governs
END IF;
-- AMB / EMER / HH / VR continue to the per-order insured / cash branches.

```

Add small helper `public._order_item_preauth_required(_tbl text, _id uuid) RETURNS boolean` doing a CASE over the five order-item tables reading each row's `preauth_required` (prescription_item included). This also fixes the `drg_bundled` fall-through that always returned false.

### D3 · `admission_gate_open()` — full locked rule

Releasing-exception short-circuit unchanged; then:

```sql
-- Insured: Approval AND deposit adequacy (both required).
IF _adm.coverage_id IS NOT NULL THEN
  IF NOT EXISTS (
    SELECT 1 FROM public.authorization_request ar
      JOIN public.authorization_item ai ON ai.authorization_request_id = ar.id
     WHERE ar.encounter_id = _adm.encounter_id
       AND ai.decision IN ('approved','partial')
  ) THEN RETURN false; END IF;
END IF;

-- Deposit adequacy — config-driven; the ONLY permitted '35' is the getter's default arg.
_pct := ((public.rcm_admin_config_get(_adm.tenant_id, 'ip_deposit_min_percent', to_jsonb(35))) #>> '{}')::int;
_required := GREATEST(
  COALESCE(_adm.requested_deposit_minor, 0),
  (COALESCE(_adm.estimated_charges_minor, 0) * _pct / 100)
);
RETURN COALESCE(_adm.paid_amount_minor, 0) >= _required;

```

When `estimated_charges_minor` is NULL the GREATEST degrades to `requested_deposit_minor` — acceptable until IP estimate capture ships; the column now exists for it.

### D4 · Self-pay cumulative adequacy (corrected status literals)

```sql
IF _wallet_balance < 0 THEN RETURN false; END IF;

SELECT COALESCE(SUM(net_minor), 0) INTO _committed
  FROM public.charge_item
 WHERE encounter_id = _charge.encounter_id
   AND pricing_mode = 'cash'
   AND status <> 'cancelled'
   AND (id = _charge.id
        OR status IN ('collected','in_progress','resulted','dispensed'));  -- past-gate set

RETURN _committed <= _paid_minor + _wallet_balance;

```

`_paid_minor` sum keeps `cash_collection.status = 'posted'` (voided refunds self-exclude).

### v_order_item_gate

Recreate excluding cancelled rows from the union; keep `security_invoker = true`. Never returns `'billed'` for cancelled items.

---

## Code layer (bindings as previously corrected — deltas only)

- `billed-gate.ts` TS mirror reflects M15 exactly: refund-via-deposit path, IMP/day-case branch (`request_type='day_case'`), three-source preauth OR, cumulative self-pay with the corrected past-gate status set, `posted`-only cash sum. Parity fixtures: (1) IMP + drg_bundled release, (2) day_case admission gating, (3) 1-payment-3-orders cumulative, (4) refund-via-deposit re-lock, (5) voided cash collection excluded.
- `emergency-reconcile.ts`, `pbm-engine.ts`, `rules.ts` `evaluateTriggers()`, API routes, spine components, nav enablement, `RcmAdminPane.tsx` — unchanged from the v1.0 corrected prompt.
- Role-matrix capabilities — full set (Lovable's additions kept, dropped items restored): `gate.exception.grant` (rcm/tenant_admin), `gate.exception.reconcile` (rcm/finance), `admin.config.write` (tenant_admin), `formulary.import` (tenant_admin), `formulary.indications.write` (tenant_admin/pharmacist), `forms.def.publish` (tenant_admin), `forms.instance.cosign` (physician), `referral.write`, `pbm.override` (rcm).
- `admin-config` route uses **PATCH** (repo convention), not PUT.
- Canonical column: `sub_category` on `service_master`.

## Definition of Done (supersedes prior list where overlapping)

- [ ] Refund (approved or executed) on a deposit tied to the encounter/admission re-locks the gate — SQL + TS parity.
- [ ] IMP encounter AND AMB-class day_case admission both route via `admission_gate_open()`; plain AMB/EMER/HH/VR unaffected.
- [ ] drg_bundled charge on a gated-open admission returns billed.
- [ ] `admission_gate_open()` requires auth approval (insured) + config-driven % — grep: no `35` outside the `to_jsonb(35)` default argument and the M14 seed.
- [ ] `admission_request.estimated_charges_minor` exists; formula degrades gracefully when NULL.
- [ ] Self-pay cumulative test: paying order A does not release B/C; past-gate set uses real `charge_status` values only.
- [ ] `_order_item_preauth_required()` helper covers all five order-item tables.
- [ ] M14 contains zero DDL/type statements.
- [ ] `formulary.indications.write` + `forms.instance.cosign` present in the role matrix.
- [ ] `v_order_item_gate` excludes cancelled; `security_invoker` retained.
- [ ] All five parity fixtures green.

  
---


|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Previous Corrections that were implemented into this prompt to be aware off [Nothing to disturb, only for your memory and understanding]: Six corrections:**C1 — D1 refund SQL references columns that don't exist.** `refund_request` has **no** `claim_id` **and no** `encounter_id` — its only linkage is `deposit_id`. The path to the encounter is `refund_request → deposit → (encounter_id | admission_request_id)`, and `deposit` carries both. Corrected clause: match refunds whose deposit resolves to this charge's encounter directly or via its admission request. Statuses `'approved','executed'` are valid (`refund-sm.ts`: pending→approved→executed, plus held/rejected — exclude those). Bonus finding: self-pay cash refunds need **no extra clause** — voided collections get `cash_status='voided'` and the D4 sum already filters `status='posted'`, so they self-exclude. The TS mirror must replicate that filter.**C2 — D2's preauth lookup is legal but incomplete.** Surprise: `service_master.preauth_required` and `drug_master.preauth_required` **do exist** (added June 29), so Lovable's SQL wouldn't error. But the authoritative per-order value is the order item's **own** `preauth_required` flag — it's resolved at ordering time from need-approval rules, which is payer-specific, while the master flag is only the catalog default. Correction: OR the sources — order-item flag primary, master flag as conservative catalog fallback (if either says auth-required, require the approval).**C2b — day-case branch condition.** `encounter.class` is text with CHECK `('AMB','EMER','IMP','HH','VR')`, and day case is **not** a class — it's `admission_request.request_type = 'day_case'` (`ip_request_type` enum). The admission-level branch must trigger on `class='IMP'` **or** an active admission request of type `day_case`; HH/VR fall through to per-order like AMB.**C3 —** `admission_request.estimated_charges_minor` **doesn't exist.** D3's `GREATEST(requested, estimated * pct/100)` formula has nothing to read. Fix: M15 adds `estimated_charges_minor bigint NULL` to `admission_request` (plain ADD COLUMN — safe in the same migration as the function), and the formula uses it when present, falling back to `requested_deposit_minor` alone when null. Config extraction: `(rcm_admin_config_get(tenant,'ip_deposit_min_percent') #>> '{}')::int` — the getter returns jsonb and already accepts a `_default jsonb` third argument, so the only permitted "35" is that default argument, never a formula literal.**C4 — D4's charge-status literals are invalid.** `'performed','released','completed','executed'` don't exist in `charge_status` (`ordered/collected/in_progress/resulted/dispensed/cancelled`). The committed set is: this charge, plus any cash charge already **past the gate** — `status IN ('collected','in_progress','resulted','dispensed')`.**C5 — M14 must not touch** `pricing_rule_scope`**.** The plan says "add enum values or convert to text check as needed" — no. Both `'referral'` and `'pbm'` already landed in M05 (verified in the post-build review), and any type change inside the seeds migration would break the R1 rule. Delete that instruction; seeds only.**C6 — restore two dropped capabilities.** Lovable's role-matrix list renamed `forms.def.write`→`forms.def.publish` (fine) and added `referral.write`/`pbm.override` (good additions), but dropped `formulary.indications.write` (tenant_admin/pharmacist) and `forms.instance.cosign` (physician). Both are load-bearing — cosign is part of the forms engine contract. |

# RCM R3 verdict + R4 (IP / Day-Case Accounting) — validated, paste-ready

Validated against `velomedos@48e87b7`.

---

## PART A — R3 `ClaimsWorklistPane`: CORRECTLY WIRED, no amendment

Every claim column the pane reads is real (`total_net_minor`, `total_patient_share_minor`, `total_payer_share_minor`, `provider_claim_no`, `invoice_no`, `claim_type`, `claim_subtype`, `billing_model`, `reimbursement_model`, `adjudication_outcome`); `claim.assemble` is a real cap; `toneOfClaim`/`toneStyle` (`clinical-status.ts`), `bucketOfClaim`/`ClaimBucket` (`claim-sm.ts`) and `formatHalalas` (`format-money.ts`) all resolve. Bulk fans out through `claims/bulk` with per-row results. Nothing to fix.

**Minor (not blocking):** `formatHalalas` now lives in **both** `src/lib/clinical/format-money.ts` and `src/lib/mds/drg-pricing.ts`. Pick one as canonical and re-export the other to avoid drift when you next touch either. The pane consistently imports from `format-money.ts`, so leave it as the canonical one.

---

## PART B — R4 IP / Day-Case Accounting — corrected

R4 legitimately ships one migration + new routes. **Confirmed seams (keep as written):** `priceDrg(encounterId)` exists in `src/lib/mds/drg-pricing.ts`; `claim.reimbursement_model` already accepts `'drg_bundled'` (and `'package'`); `encounter_advance_journey(_enc_id uuid, _to text)` exists and already drives `admitted`/`discharged`; `charge_item` exists with a `cost_only` column; `admission_request_id` does **not** exist yet (correctly added). Four corrections:

### [FIX 1 — routing, recurring] Tabs in `clinical.tsx`, not `clinical.$module.tsx`

`src/routes/clinical.$module.tsx` **does not exist** — the workspace is the single tab-switched `src/routes/_authenticated/clinical.tsx`. Wire the IP panes as **tabs** there (add TabIds `ip-admissions`, `ip-lounge`, `ip-reception`, `ip-discharge`, `ip-masters`, `ip-deposits`; extend `validateSearch`; render in the switch; nav via `onTab`). Put the panes in `src/components/clinical/daylight/` (the established dir), not a new `src/components/clinical/ip/`. Role-landing sets the initial IP tab per role.

### [FIX 2 — `charge_item.cost_only` already exists] only add the FK

Don't re-add `cost_only` (already present). The only `charge_item` change is a **nullable** `admission_request_id` **FK**. The daily-charges engine writes `cost_only = true` rows tagged with it.

### [FIX 3 — enum discipline] new `CREATE TYPE` only; no `ADD VALUE` to existing enums

All R4 status enums (`admission_status`, `auth_scope`, discharge-stage, etc.) are **new** `CREATE TYPE` — safe same-txn. The encounter sync uses the **existing** `journey_state` values `admitted`/`discharged` (via `encounter_advance_journey`), so **do not** `ALTER TYPE journey_state ADD VALUE` anywhere in this migration. If any new value on an existing enum is ever needed, it goes in a separate earlier migration (R1 lesson). `authorization_request` gets additive nullable `admission_request_id` + `auth_scope` (new enum) columns — additive, safe.

### [FIX 4 — new blocker codes] define in `src/lib/rcm/validation.ts`

`BED_NOT_COVERED`, `CONSENT_MISSING`, `PAC_MISSING`, `ANESTHESIA_UNFIT`, `ORDERS_PENDING`, `LOS_EXPIRED`, `DEPOSIT_INSUFFICIENT` are **new** — define them in `src/lib/rcm/validation.ts` in the existing blocker shape (`{ code, severity, message, fix_hint, deep_link }`), **reusing** the now-existing `ELIG_INVALID` / `AUTH_MISSING`. The IP-specific ones (`ORDERS_PENDING`, `BED_NOT_COVERED`, `CONSENT_MISSING`) also extend `claim-scrubber.ts` so IP claims scrub correctly.

### Confirmed-good — integration wiring (keep)

- **R1:** `admission_request.eligibility_ref` FK → `visit_eligibility`; reception re-runs the eligibility snapshot; exception capture reuses `eligibility_exception`.
- **R2:** authorize/transfer/extend-LOS funnel into `authorization_request` with `auth_scope` + `admission_request_id`; the higher-category bed-transfer auto-creates a scoped R2 request via the server-side auth creator; IP drawer deep-links to the auth rows. Reads auth outcome from `authorization_request.status` + `authorization_item.decision` (not a request-level `decision`).
- **R3:** financial-discharge calls the R3 `assemble` with `reimbursement_model='drg_bundled'` (real value) after `priceDrg(encounterId)`; daily `charge_item` stays `cost_only` (off the payer claim); `ClaimsWorklistPane` already surfaces via `claim_lifecycle_event`.
- **HIS:** journey via the existing `encounter_advance_journey(_enc_id, _to)`; new triggers keep `encounter.journey_state` in sync using existing values.
- **Masters** (`ip_package`, `room_board_entitlement`) via **direct CRUD** (R2 governance-scope lesson) — not `contract_change_request`.
- **Bulk** endpoints return `{ results: [{ id, ok, error? }] }` (R2/R3 contract); panes reuse the R3 table/drawer primitives + shared `toneOf`/`formatHalalas`/`CapGate`; worklists bucketed with pill counts.
- **Deposits** table shared with R6 (R6 adds settlement columns later); `deposit` insert/update recalcs `admission_request.paid_amount_minor` via trigger.
- **Daily-charges cron** (`api/public/ip/daily-charges/run.ts`) mirrors the existing `src/routes/api/public/…` route structure; add an HMAC guard; `postDailyCharges(admissionId, date)` is idempotent per `(admission, date)`, one txn per admission-day.
- **Roles/caps:** extend the matrix with `ip.*` caps default-granted to `rcm`, `front_office`, `cashier`, `physician`, `case_manager`, `nurse` — all real `clinical_role` values (no invented roles).

### DoD

One migration: new IP tables + new `CREATE TYPE` enums (no `journey_state` ADD VALUE) + additive columns (`charge_item.admission_request_id`, `authorization_request.admission_request_id`/`auth_scope`) + triggers

- GRANT/RLS by `tenant_members`. IP panes are **tabs in** `clinical.tsx` under `daylight/`. New blockers in `validation.ts` (+ scrubber). Financial-discharge → `priceDrg` → R3 `assemble` (`drg_bundled`). Masters direct CRUD; bulk per-row; deposits recalc trigger; cron HMAC + idempotent. `tsgo` green; Daylight only; halalas in mono; RTL-safe.
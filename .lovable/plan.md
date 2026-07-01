# RCM R1 amendment + R2 Authorization — FINAL (validated, paste-ready)

Validated against `velomedos@e4500fa`. Repo facts confirmed inline so nothing is assumed. Two micro-fixes folded in beyond the prior round (RcmStubs location; the claim-gate flag). Everything else in the plan is correct.

---

## PART A — R1 amendment: `ContractMastersPane` change-request payload

**Fix (client —** `src/components/clinical/daylight/ContractMastersPane.tsx`**).** In `ChangeProposal.submit()` send only the editable columns as `after` (not the whole row):

```ts
const after = Object.fromEntries(editableColumns.map((c) => [c, draft[c]]));
await ClinicalAPI.createContractChangeRequest({
  target_table: tableName, target_id: before.id, before, after,
  reason: reason.trim(), effective_date: effective || null,
});

```

**Server hardening (**`masters/contract-change-requests.$id.apply.ts`**).** Before `db.from(target_table).update(...)`, strip protected keys: `delete after.id; delete after.tenant_id; delete after.created_at; delete after.created_by;` — let `updated_at` default to `now()`.

**Schema — CONFIRMED, no change needed.** `ContractChangeRequestUpsert` (`src/lib/mds/schema/rcm.ts`, lines 61-64) already accepts `before`, `after`, `effective_date`, `reason`. Don't widen it.

No migration, no route additions for Part A.

---

## PART B — R2 Authorization Engine

R2 legitimately ships one migration + new routes. Confirmed present: `service_master`/`drug_master` (real table names), the gateway `sendBundle({idempotencyKey, messageType, tenantId})` + `stubResponse(bundle, messageType)` pattern (with `submitClaim`/`submitEligibility` as the templates), all five order-item tables (`service_order_item`, `prescription_item`, `radiology_order_item`, `lab_order_item`, `ep_order_item`), `_order-factory.ts` + four order endpoints + `prescriptions.ts`, `claims.$id.completeness.ts`, `his-docs.ts`, and the `Authorization` module caps (`auth.request`/`auth.decide`/`auth.rules`) with `pharmacist` in the `clinical_role` enum.

### 1. Migration — one call

- `CREATE TYPE authorization_status AS ENUM` — 17 states (`new · created · need_corrections · scrubbed · ready · submitted · pending · case_under_review · need_more_info · approved · partially_approved · rejected · referred_transfer · expired · cancelled · execution_released · converted_self_pay`). New type, same-txn use is fine. **No** `clinical_role`**** `ADD VALUE` (`pharmacist` already exists).
- `authorization_trigger_rule` — `tenant_id, trigger_type, scope, condition jsonb, active, priority, note`.
- `approval_rule` — precedence refs (`tpa_id, payer_id, policy_id, class_id, network_id`), `requester_role text[], patient_type, specialty, clinical_condition, approval_limit_minor, auto_send_script, medication_days_of_supply, medication_stock, active, inactive_reason`.
- `authorization_request` — §D fields incl. `internal_seq_no, auth_type, encounter_id, eligibility_ref (→ visit_eligibility), payer/policy/class/network, parent_auth_id (self-fk), status authorization_status, approval_limit_minor, approved_amount_minor, valid_to date, request_bundle_id, response_bundle_id, assigned_to, locked_by, locked_at, elapsed_started_at, source_reason, approval_rule_reason, cancel_after`.
- `authorization_item` — `auth_id, service_code/drug_code, qty, approved_qty, approval_no_per_item, approved_amount_minor, item_status`, nullable back-refs to the five order-item tables (all exist).
- `authorization_attachment` — `auth_id, label, url, mime, uploaded_by, uploaded_at`.
- `authorization_communication` — `direction (out|in), message, followup_no, created_by, nphies_communication_id nullable`.
- **Additive master columns:** `service_master ADD is_high_control boolean default false, sub_category text`; `drug_master ADD is_high_control boolean default false, sub_category text, max_days_of_supply int`.
- **Triggers:** BEFORE INSERT → `internal_seq_no = AUTH-YYYY-XXXXXX`, `elapsed_started_at = now()`, `cancel_after = now() + interval '30 days'`. AFTER UPDATE OF status → advance encounter journey. `authorization_item` AFTER UPDATE → resync parent `approved_amount_minor`.
- All new tables: `GRANT` + RLS scoped by `tenant_members` (author + tenant staff read; `rcm`/ `approval_officer` write) per R1.

### 2. `src/lib/rcm/auth-sm.ts` (new)

Pure TS: `AuthStatus` union (matches the enum), `nextStates(status)`, `canTransition(from, to, ctx)`, label/tint helpers. Used by API guards + UI.

### 3. `src/lib/rcm/auth-engine.ts` (new)

- `evaluateTriggers(ctx)` → reads `authorization_trigger_rule` + the **real** master flags: `preauth_required` (existing) plus the new `is_high_control`, `sub_category`, `max_days_of_supply`. No references to non-existent columns.
- `resolveApprovalRule(ctx)` → precedence **TPA → Payor → Policy → Class** + **Network override**; honours `inactive_reason`.
- `runPreSubmissionScrubber(auth)` → `{ ok, blockers[], warnings[] }`.
- `resolveConversion(auth)` → billable vs self-pay split (exported for R3/R4).

### 4. APIs — `src/routes/api/clinical/v1/auth/*` (new)

Guarded by `requireClinicalModule('Authorization', <cap>)` (`auth.request` work / `auth.decide` decide / `auth.rules` masters).

- `auth-requests.ts` GET (full filter set; sort oldest-unsubmitted-first; `include_closed=1`) / POST (create; auto-pull orders/dx/procedures + MDS + real `eligibility_ref` via `evaluateTriggers`).
- `auth-requests.$id.ts` GET/PATCH · `.assign.ts` (assign-to-me; `xmin` **+** `locked_by`**/**`locked_at`**, 10-min TTL swept in-request, 409 on live collision** — new pattern, not cited as pre-existing) · `.scrub.ts` · `.submit.ts` (builds preauth Bundle → `gateway.submitPreauth(...)` → `submitted → pending`) · `.items.ts` (bulk PATCH) · `.attachments.ts` · `.communications.ts` (auto-increments `followup_no`) · `.cancel.ts` · `.refresh-validity.ts` · `.decision.ts` (inbound ClaimResponse simulation).
- `auth-requests.bulk.ts` POST `{ action, ids[], payload? }` → **per-row result array** (server-side).
- **Masters (direct CRUD, NOT change-request governed):** `masters/auth-trigger-rules.ts` (+`$id`), `masters/approval-rules.ts` (+`$id`), gated `rcm`/`tenant_admin` via `auth.rules`. They are **not** in `contract-change-requests` `ALLOWED_TABLES` and must not route through it.
- **Gateway (**`src/lib/mds/nphies/gateway.ts`**):** add `submitPreauth(bundle, idempotencyKey, tenantId)` = `sendBundle(bundle, { idempotencyKey, messageType: "preauth-request", tenantId })` (same shape as `submitClaim`/`submitEligibility`). Extend `stubResponse` for `"preauth-request"` → deterministic `ClaimResponse` with `preauthRef`, `preAuthPeriod.end` (→ `valid_to`), per-item `benefit`. `isDemoTenant` already drives the sandbox path; surface a `SANDBOX` chip in the UI.

### 5. HIS linkage (order-side triggers)

Extend `_order-factory.ts` + `orders.{lab,radiology,service,electrophysiology}.ts` + `prescriptions.ts`: after writing the order run `evaluateTriggers`; if required, create `authorization_request` (`status='new'`) with initiating items attached, and **append additively** `{ authorization_request_id, requires_auth, reasons: string[] }` to the existing order response (don't rename/remove existing fields). Populate `eligibility_ref` from the latest `visit_eligibility` for the encounter.

### 6. Claim gate — `claims.$id.completeness.ts` (fixed flag)

Add blocker `AUTH_MISSING`: a claim item whose service/drug has `preauth_required = true` (the real master column — **not** a nonexistent `need_approval` column) OR matches a `need_approval_rule` must have a covering `authorization_request` in `approved`/`partially_approved` with `valid_to >= now()` and policy not expired at charge time. Emit in `completeness.ts`; `claims.$id.ready.ts` reflects it automatically. R2 half of the Phase-10 gate.

### 7. UI — `src/components/clinical/daylight/AuthorizationPane.tsx` (new)

Mirrors `EligibilityWorklistPane`: bucket tiles (**Needs me now** `new`/`need_corrections`/`need_more_info` · **In flight** `submitted`/`pending`/`case_under_review` · **Decided** `approved`/`partially_approved`/ `rejected`/`referred_transfer` · **Closed** `expired`/`cancelled`); full filter set; columns seq · Encounter/MRN · Auth type · Payer/Policy · Rule reason · CTAS · Amount (shared `formatHalalas` mono) · TAT band · Status pill (shared `toneOf`) · Assigned · Locked-by. Row actions Assign/Scrub/Submit/Communicate/ Refresh-validity/Cancel/Convert-self-pay. Sticky bulk bar → `auth-requests.bulk.ts`, per-row toast summary. Row-expand drawer: **Items** (inline qty/approved_qty/approval_no) · **Attachments** · **Communications** (thread + `followup_no` + reply; inbound tagged). Right rail **Rule preview** (triggers fired + resolved approval rule). Eligibility surfacing uses real `EligibilityStatus` + shared `toneOf` + `financial_type ∈ {insurance,self_pay,pending}`. `CapGate`: work=`auth.request`, decide=`auth.decide`, masters=`auth.rules`; `read_only` sees no bulk bar.

### 8. `src/components/clinical/daylight/AuthRulesPane.tsx` (new — NOT via `ContractMastersPane`)

Tabbed operational-config editor: **Auth triggers** (`authorization_trigger_rule` CRUD, bulk enable/disable) · **Approval rules** (`approval_rule` precedence editor: chip pickers TPA/Payor/Policy/Class/Network, requester roles, patient type, specialty, limits, `auto_send_script`, DOS, stock, inactive-per-payer). Direct CRUD via `updateMaster('auth-trigger-rules', …)` / `updateMaster('approval-rules', …)` — **not** `contract_change_request`.

### 9. Client — `src/lib/clinical-api.ts`

Add `listAuthRequests, getAuthRequest, createAuthRequest, patchAuthRequest, assignAuthRequest, scrubAuthRequest, submitAuthRequest, cancelAuthRequest, refreshAuthValidity, patchAuthItem, postAuthAttachment, deleteAuthAttachment, listAuthCommunications, postAuthCommunication, bulkAuthAction(action, ids, payload?), simulateAuthDecision(id, payload)`. Masters via existing `listMaster`/`createMaster`/`updateMaster` with kinds `auth-trigger-rules` / `approval-rules`.

### 10. Wiring (fixed stub reference)

- `nav-config.ts` — no structural change; the existing `rcm-authorization` tab renders the real pane.
- `clinical.tsx` — `RcmStubs.tsx` **does not exist**; wire `AuthorizationPane` into wherever the `rcm-authorization` tab currently renders its stub (the inline stub/placeholder from the R1 build). Mount `AuthRulesPane` under `admin-masters` (sub-section or adjacent tab).
- `clinical-role-landing.ts` — set `pharmacist → rcm-authorization`.
- `src/lib/his-docs.ts` — add "RCM · Authorization (R2)" (tech-manual: trigger taxonomy, 16-step SM, post-decision governance, gateway wiring; user-manual: work the worklist, physician response, officer declaration).

### 11. Acceptance

MRI sub-category rule → auto-auth (`requires_auth:true` in order response) → worklist → scrub → submit → sandbox approves w/ `valid_to` → order releases. · GLP-1 high-control → partial approval → approved qty billable, remainder self-pay via `resolveConversion`. · CTAS 1–2 → manual path. · Policy expiry < `valid_to` → `completeness.ts` emits `AUTH_MISSING`. · Follow-up/extend/transfer preserve `parent_auth_id`; server bulk-cancel returns per-row results. · Every table: multi-select + select-all-in-view + sticky bar; `read_only` no bar.

### DoD

**R1:** pane sends only editable `after`; apply strips `id/tenant_id/created_at/created_by`; schema already accepts the fields. **R2:** one migration (new tables + `is_high_control`/`sub_category`/ `max_days_of_supply` on `service_master`/`drug_master`; no `clinical_role` `ADD VALUE`). New `auth/*` routes guarded by `requireClinicalModule('Authorization', …)`. Order endpoints create auths via `evaluateTriggers` and append `requires_auth` additively. `AUTH_MISSING` in `completeness.ts` keyed off `preauth_required`. Rule masters via direct CRUD. Worklist mirrors R1 (buckets, shared `toneOf`/`formatHalalas`/`CapGate`, server bulk w/ per-row results). `submitPreauth` in `src/lib/mds/nphies/gateway.ts` via `sendBundle` `messageType:"preauth-request"` + `stubResponse`. `tsgo` green; Daylight only; halalas in mono; RTL-safe.

```

```
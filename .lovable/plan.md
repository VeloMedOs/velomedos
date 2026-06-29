## Phase 9 — NPHIES gateway integration (real submission)

Wires the existing FHIR Claim bundle (Phase 7) to a real NPHIES endpoint, persists eligibility + adjudication, reconciles payer/patient shares (per-line for OP/itemized, DRG-bundle for IP), and makes submission **idempotent**. When `NPHIES_BASE_URL` is not configured the gateway returns a deterministic sandbox response so flows remain demoable end-to-end; the wiring is identical when real credentials are added.

### Deliverables

1. **DB (one migration)**
  - `claim`: add `idempotency_key text unique per tenant`, `nphies_request jsonb`, `eligibility_response jsonb`, `eligibility_checked_at timestamptz`, `adjudicated_at timestamptz`, `adjudication_outcome text` ('complete' | 'partial' | 'error'), `nphies_claim_id text`. Partial unique index `(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.
  - `claim_item`: add `adjudicated_payer_share_minor integer`, `adjudicated_patient_share_minor integer`, `adjudicated_net_minor integer`, `adjudication_reason text`.
  - New `claim_submission_attempt` table: id, tenant_id, claim_id, attempt_no, idempotency_key, started_at, finished_at, http_status, outcome text ('ok'|'error'|'in_flight'), error text, request_body jsonb, response_body jsonb. Single-flight enforced by partial unique index `(claim_id) WHERE outcome='in_flight'`. Standard GRANTs + RLS by tenant.
2. **Gateway client — `src/lib/mds/nphies/gateway.ts**`
  - Reads `process.env.NPHIES_BASE_URL`, `NPHIES_CLIENT_ID`, `NPHIES_CLIENT_SECRET`, `NPHIES_SCOPES` **inside the handler** (Workers env).
  - OAuth2 client-credentials token cache (in-memory per isolate, 60s safety window).
  - `submitClaim(bundle, { idempotencyKey })` → POSTs FHIR Bundle to `{base}/$process-message`; returns parsed Bundle response. Adds `X-Idempotency-Key` header. 30s timeout, 1 retry on 5xx/network.
  - `checkEligibility({ coverage, beneficiary, items })` → builds CoverageEligibilityRequest Bundle and POSTs.
  - When env unset: returns deterministic stub Bundle (ClaimResponse.outcome='complete', mirrors charged amounts) tagged `sandbox: true`. Identical downstream code path.
3. **FHIR helpers — `src/lib/mds/fhir/claim-response.ts**`
  - `parseClaimResponse(bundle)` → `{ nphiesClaimId, outcome, totals: { payerMinor, patientMinor, netMinor }, items: [{ sequence, payerMinor, patientMinor, netMinor, reason? }], errors: [{ code, severity, diagnostics, location }] }`.
  - `parseEligibility(bundle)` → `{ active, inforce, copayPct?, deductibleMinor?, exclusions[], errors[] }`.
4. **Reconciliation — `src/lib/mds/claim-reconcile.ts**`
  - IP / DRG-bundled: adjudicated total maps to the single bundle line; per-line items remain at their grouped snapshot but DRG totals on `claim` get the adjudicated amounts.
  - OP / itemized: match by `sequence_no`; write `adjudicated_*_minor` per `claim_item`; sum into `claim.total_*_minor` adjudicated columns. Flag mismatches into `adjudication_outcome='partial'` with reasons.
5. **API routes (under `src/routes/api/clinical/v1/`)**
  - `POST claims.$id.submit.ts` — rewritten:
  1. `requireClinicalRole(['biller','case_manager'])`; claim must be in `ready` (or `draft` only if explicit override flag — kept from current stub).
  2. Phase 10 hook left as a `TODO` comment; current Phase 7 guards remain.
  3. Idempotency key = client-supplied `Idempotency-Key` header **or** stable `sha256(claim.id + claim.updated_at)`.
  4. Insert `claim_submission_attempt` row with `outcome='in_flight'` (unique partial index gives single-flight; on conflict return 409 `submit_in_flight`).
  5. Build FHIR bundle (reuses Phase 7 builder), call `gateway.submitClaim`.
  6. On success: update claim (`status='submitted'|'accepted'|'rejected'` from outcome; `nphies_claim_id`, `nphies_response`, `adjudicated_at`, `adjudication_outcome`, totals), reconcile per-line shares, finish attempt row.
  7. On error: attempt row `outcome='error'`, claim stays `ready`, return standard `{error,code,request_id}` envelope (4xx → `nphies_validation`, 5xx/network → `nphies_unavailable`).
    OST claims.$id.eligibility.ts`(new) — runs CoverageEligibilityRequest; stores in`claim.eligibility_response `+ timestamp. ET claims.$id.attempts.ts` (new) — list `claim_submission_attempt` rows for the claim (request/response redacted for non-superadmin).
6. **OpenAPI** — extend `src/lib/openapi-clinical-spec.ts`:
  - Updated `/claims/{id}/submit` (request `Idempotency-Key` header, responses `200 adjudicated`, `202 submitted`, `409 submit_in_flight`, `422 nphies_validation`, `502 nphies_unavailable`).
  - New `/claims/{id}/eligibility` and `/claims/{id}/attempts`.
7. **Superadmin/UI (minimal — Phase 8 wiring already there)**
  - `src/routes/_authenticated/clinical.tsx` Claims tab: add **Check eligibility** + **Submit** buttons calling the new endpoints; show adjudication summary (payer/patient/net) and last 3 attempts with outcome.
  - `src/routes/_authenticated/clinical-superadmin.tsx`: add per-claim adjudication outcome column + attempts drawer.
8. **Secrets** — none added in this phase. Documented as user-provided when going live: `NPHIES_BASE_URL`, `NPHIES_CLIENT_ID`, `NPHIES_CLIENT_SECRET`, `NPHIES_SCOPES`. Sandbox stub keeps everything functional until then.
9. **Docs** — `docs/changelog.md` Phase 9 entry; `docs/his-technical-manual.md` adds NPHIES gateway architecture (env → token cache → submit/eligibility → reconcile → idempotency model); `docs/his-user-manual.md` adds biller flow (Check eligibility → Submit → Read adjudication → Resubmit on rejection via a new claim that links via `replaces_claim_id`).

### Acceptance (matches prompt)

- A `ready` claim submits via `POST /claims/:id/submit`; response stored; `claim.status` advances to `submitted`/`accepted`/`rejected`.
- OP itemized: per-line `adjudicated_*_minor` populated; sums match `claim.total_*` adjudicated.
- IP DRG-bundled: adjudicated DRG amount reconciled into `claim` totals.
- Concurrent submits on the same claim → second returns `409 submit_in_flight`.
- `NPHIES_BASE_URL` unset → deterministic sandbox response, same persistence path, attempt marked `sandbox=true`.
- Validation errors from NPHIES surfaced via standard envelope with `request_id` and FHIR OperationOutcome diagnostics in payload.

### The reframe in one line: this isn't a claim submitter, it's the **shared NPHIES transport** that R1 (eligibility), R2 (authorization), Phase 7 (claim), and R5 (remittance/payment) all ride on. Four edits follow.

**1. Make the gateway message-agnostic, not claim-only.** Rename `submitClaim` to a generic `sendBundle(bundle, { type, idempotencyKey })` over `$process-message`, with typed helpers on top: `checkEligibility` (R1 calls it), `submitPreauth` (R2), `submitClaim` (here), `pollTask`, `cancelClaim`. NPHIES has one envelope for many message types — build to that, or R2 and R5 each reinvent the client.

**2. Treat submission as asynchronous.** Lovable's flow assumes submit returns an adjudicated ClaimResponse synchronously. Real NPHIES usually acks `queued` and returns the ClaimResponse later — which is what the auth wireframe's "Pending Payer Response" implies. So: submit returns `202 queued` and sets an `ack_status`; add a `claims.$id.poll.ts` (Task-based) plus a `nphies_message` inbound/outbound log; reconciliation fires *when the ClaimResponse arrives*, not at submit. Without this, the happy path works in sandbox and breaks against production.

**3. Drop eligibility from the claim — it's R1's.** Remove `claims.$id.eligibility.ts` and the `claim.eligibility_response`/`eligibility_checked_at` columns. Eligibility is a *visit-level* operation that already lives in R1 (`visit_eligibility`, run at front office before a claim exists). Phase 9 provides the `checkEligibility` transport R1 consumes; it must not create a second eligibility home on the claim — that's the exact drift we've been removing every phase.

**4. Route the inbound message set and set the R5 boundary.** Parse and route what comes back: `ClaimResponse → reconcile here` (this is the *first* adjudication only); `CommunicationRequest "further info required" → worklist`; `PaymentReconciliation → R5`; `Task → status`. Denial management, resubmission workflow, payment posting, and settlement-feedback-to-D365 are **R5** — Phase 9 just lands the adjudication tables R5 builds on.

Everything else in Lovable's plan is right and stays: the idempotency key, the single-flight `in_flight` partial-unique on `claim_submission_attempt`, the sandbox stub, per-line vs DRG reconciliation, the OpenAPI surface, and env-based secrets.

One sequencing point worth acting on: because R1's eligibility check needs this gateway, build the `src/lib/nphies/*` client when R1 lands (against the sandbox stub) rather than holding it for "Phase 9 after clinical 0–8" — claim submit, preauth, and payment then reuse the same client. That's also the moment your earlier instinct pays off: if you have the actual NPHIES `$process-message` endpoint specs or Swagger by then, the gateway gets built against real contracts instead of inferred ones.  
RCM Phase R1 — Master & Contract Management + Eligibility / Activation Engine

Source: `3_1_Master_and_Contract_Management.docx` + Contract Management & Ineligibility mind-maps. Builds the contractual foundation and the front-office eligibility lifecycle that governs every downstream RCM flow. Layers onto our existing clinical Phase 3 (masters) — extends it, doesn't replace it. RCM built **inside** the HIS; CHI/NPHIES eligibility is an inbound integration.

> Gap status vs what we've built: **contract hierarchy = partial** (we have payer/tpa/policy/class/ plan/network; missing settlement terms, payer-level discounts, contract worklist, audit-controlled updates). **Eligibility/ineligibility/activation = missing entirely.** Standing rules apply: API-first, tenant-scoped + RLS, reference-vs-contractual split, money in halalas, doc DoD.

## A. Contract-management enrichment (extends Phase 3)

`payer_agreement` [NEW] — the contract/settlement layer above policy.

- `tenant_id`, `payer_id fk`, `tpa_id fk NULL`, `agreement_no`, `contract_start`, `contract_end`, `settlement_terms_days int`, `prompt_payment_discount_percent numeric NULL`, `volume_discount_rules jsonb NULL` (tiered by value/volume), `vat_treatment text`, `active`.
- These are payer-side financial incentives maintained at agreement level (from §3.1).

`policy` **/** `insurance_class` **enrichment** [AMENDED] — from the Contract Management mind-map:

- `policy`: `+ policy_date_expiry`, `+ internal_serial_number`, `+ cchi_number` (on payer).
- `insurance_class`: `+ deductible jsonb` (value: percentage|amount; before/after discount; per service-type: consultation/services/medications; specialty rule: dental/others; sub-category rule: panorama-xray/dental-extraction; service-item rule), `+ maximum_limit_minor`, `+ approval_limit_minor`, `+ room_type`, `+ network` ref.
- `network`: `+ deductible`, `+ maximum_limit`, `+ approval_limit`, `+ room_type`.
- **Create-and-Copy Profile** action: clone a class/network benefit profile (deductible/limits/ room type) to a new class — parallels the price-list duplicate from the Phase-3 addendum.

**Coverage / approval rule masters** [NEW] — from the mind-map (feed authorization in R2):

- `not_covered_rule` (scope: specialty | clinical_condition | icd10 | exceed_approval_limit | insurance-company-wise | class_exclusions), `not_covered_list`.
- `need_approval_rule` + `need_approval_list` (same scoping).
- `maternity_protocol`, `discount_master` (already partly in price-list addendum).

`contract_management_worklist` [NEW] — operational maintenance of payer/TPA/policy/class/ network/tariff/discount with **controlled updates + audit trail + effective-dated changes** (`change_request` rows: target_table, target_id, before jsonb, after jsonb, effective_date, status draft|approved|applied, approved_by). This is the governed-update requirement from §3.1.

## B. Eligibility lifecycle (NEW — the 19-step §3.1.2–3.1.6 workflow)

`visit_eligibility` — one per encounter/visit (uniqueness enforced).

- `tenant_id`, `encounter_id fk` (or pre-encounter visit ref), `beneficiary_id fk`, `status text (eligible|not_eligible|error|exception|self_pay)`, `eligibility_ref_no`, `membership_id`, `payer_id`, `policy_id`, `class_id`, `network_id`, `eligibility_type text (standard|referral|emergency|newborn)`, `result_payload jsonb` (NPHIES/CHI response), `reason text` (on not_eligible — stored to allow governed override), `checked_at`, `financial_type text (insurance|self_pay)`.
- **Unique eligibility per visit** (partial unique on active status).

`eligibility_exception` — exception evidence (§ step 6/9).

- `tenant_id`, `visit_eligibility_id fk`, `exception_type (referral|emergency|newborn)`, evidence: `referral_letter_url`, `referral_ref_no`, `referred_provider`, `referral_date`; `ctas_level int` (emergency, valid 1–2 only); `birth_certificate_url`, `mother_membership_no`, `mother_coverage_id fk NULL` (newborn → link to mother financial details), `validity_period`.

`policy_activation_request` — RCM activation worklist (§ steps 10,14–18).

- `tenant_id`, `visit_eligibility_id fk`, `requested_by`, `status (pending|in_progress|activated| rejected)`, `payer_id`, `policy_no` (as CCHI), `class_code`, `is_ineligible_flag bool`, `membership_no`, `validity_from`, `validity_to`, `assigned_to`, `activated_by`, `activated_at`, `notify_reception_at`. On activation → notify the originating receptionist.

## C. State machine — eligibility (`src/lib/rcm/eligibility-sm.ts`)

`new → checking → (eligible | not_eligible | error)`; `not_eligible → exception_review → (exception_approved → activation_pending → activated → insured) | self_pay`; `eligible → (policy_active? → insured) | (activation_pending → activated → insured)`. Mirrors the 19 steps; governed override on `not_eligible` requires stored reason.

## D. APIs (`src/routes/api/clinical/v1/eligibility/` + `masters/contracts/`)

- `eligibility.check.ts` POST — run CHI/NPHIES discovery (stub → real in the interfaces phase); writes `visit_eligibility`. `eligibility.$id.ts` GET/PATCH (override w/ reason).
- `eligibility.$id.exception.ts` POST — capture evidence (referral/emergency/newborn; validates CTAS∈{1,2}, newborn requires eligible mother).
- `eligibility.$id.self-pay.ts` POST — register self-pay.
- `policy-activations.ts` GET (worklist, filters) / POST; `policy-activations.$id.ts` PATCH (activate + membership + validity), `…/notify.ts`.
- Contract masters: `masters/payer-agreements`, `not-covered-rules`, `need-approval-rules`, `contract-change-requests` (the audit-controlled update worklist) — full CRUD, `tenant_admin`/ `rcm` roles.
- **New roles** (ALTER `clinical_role`): `rcm`, `approval_officer`, `front_office` (reception).

## E. Worklists (UI — extend in the portal phase, API now)

`policy_activation_worklist`, `eligibility_worklist`, `ineligibility_worklist` — list endpoints with assignment/status/pending-action views (entry points, assignment, status handling).

## F. Acceptance

- Eligible patient with active class → `visit_eligibility=eligible`, financial type locked to payer/policy/class/network, encounter proceeds insured.
- Not-eligible + valid referral (letter) / emergency (CTAS 1–2) / newborn (eligible mother) → exception captured → policy_activation_request created → RCM activates → reception notified → registered insured under activated class.
- Not-eligible, no exception → self_pay.
- Eligibility uniqueness per visit enforced; override stores reason.
- Contract change to a tariff goes through `change_request` (draft→approved→applied) with audit.
- **API coverage / API-first / RLS** all hold; no orphan tables.

## G. Docs (standing DoD)

- Technical manual: contract hierarchy + settlement/discount model, eligibility data model + the 19-step state machine, exception/newborn linkage, the audit-controlled contract-update mechanism.
- User manual: front-office "Check eligibility", "Capture referral/emergency/newborn exception", "Register self-pay vs insured"; RCM "Activate policy/class + membership"; contract-admin "Make a governed tariff change".

## Out of scope here (later RCM phases)

Authorization engine (R2 / `3_2`), OP-ER accounting (R3 / `3_3`), IP accounting (R4 / `3_4`), remittance & denial (R5 / `3_5`), deposits/refund (R6 / `3_6`), cash (R7 / `3_7`), ZATCA/D365 interfaces. Real CHI/NPHIES eligibility call is wired in the interfaces phase (here it's a stub).

```

```

  
Out of scope (already mapped to later phases)

- Strict MDS/DRG completeness gating before `ready` → Phase 10.
- PROMs/PREMs → Phase 11.
- Real NPHIES credentials provisioning (requires CHI onboarding) — phase ships sandbox-ready; secrets requested when the user has them.
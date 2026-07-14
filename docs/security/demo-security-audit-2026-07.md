# Demo Security Audit — 2026-07

_Investigation turn against the surface hardened by Round 1 (physician-only public roster, `tenant_type='sandbox'` gating, banner + exit-demo). Read-only. No code changes this turn._

Repo baseline: post-Batch 2 (`.lovable/plan.md` register at rows #18–#50). Migration corpus: `supabase/migrations/2026*.sql`.

## Executive summary

- **Recommendation: HOLD current state until Governance Round 2** — no Critical/High findings. Public reveal already defaults to `false`; physician-only filter and `tenant_type='sandbox'` gating hold on inspection. Forcing off now buys nothing operational.
- Public roster is off by default (`platform_settings.demo_public_reveal = 'false'::jsonb`, migration `20260630092953…sql:49`) and, even when flipped on, projected through an anonymous-safe filter that keeps only `clinical_role = 'physician'` rows (`src/lib/demo-credentials.functions.ts:62-63`).
- All PHI tables inspected (`beneficiary`, `encounter`, `charge_item`, `claim`, `patient_wallet`, `wallet_txn`) enforce RLS via `is_tenant_member(auth.uid(), tenant_id)` **without a `superadmin` bypass clause** — a signed-in demo superadmin cannot read partner-tenant PHI through the REST API.
- Demo reset/seed is doubly gated: superadmin bearer required, then `resolveDemoTenant()` refuses to run unless the resolved row has `slug='demo-hospital'` AND `tenant_type='sandbox'` (`src/lib/demo-seed.functions.ts:75-107`). No caller-controlled tenant id.
- Two Medium/Informational observations only: (a) dead `localStorage` autofill reader at `src/routes/demo-login.tsx:45-54` — no writer in-tree, but the read path is live and would auto-fill if a future turn re-introduces the writer; (b) `platform_settings.demo_public_reveal` toggle appears not to invalidate live sessions — a session minted while reveal was on survives reveal being turned off.

---

## Section 1 — Demo credential exposure (Q1–Q6)

**Q1. Default state of `demo_public_reveal`.** `false`. Seeded via migration `supabase/migrations/20260630092953_…sql:48-50`:
```sql
INSERT INTO public.platform_settings (key, value)
  VALUES ('demo_public_reveal', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;
```

**Q2. Who can flip it.** Superadmin only. `setDemoPublicReveal` in `src/lib/demo-credentials.functions.ts` runs behind `requireSuperadmin()` (which verifies the bearer via `supabaseAdmin.auth.getUser` then checks `has_role(user, 'superadmin')`). No public route mutates this key.

**Q3. Response shape when reveal is off.** `GET /api/public/v1/demo/credentials` → `{ ok: true, reveal: false, accounts: [] }`. When on, the roster is filtered by `isPublicVisible` (`src/lib/demo-credentials.functions.ts:62-63`) which keeps only rows with `clinical_role === 'physician'`; passwords are elided from the public shape (they are attached only when the caller is authenticated as superadmin). Confirmed by round-trip fallback path in `src/routes/demo-login.tsx:89-98`.

**Q4. Rate limit / IP allowlist.** None observed on `/api/public/v1/demo/credentials`. This is expected for a public route serving a static-ish roster, but note that when reveal is on the endpoint is a physician-role probe. Suggested: rate limit at the edge if reveal is turned on for scheduled demos.

**Q5. Enumeration risk.** Low. Public payload exposes deterministic seed emails (e.g. `doctor@demo.velomedos.com`) that a scraper already learns from `docs/`, `README`, and the sandbox marketing page. No PHI or real-tenant emails leak through the filter.

**Q6. Client-side persistence of demo credentials.** `src/routes/demo-login.tsx:27,45-54,106,130` reads `localStorage["velomed:demo_autofill"]` and, if present, auto-fills email/password. **No writer exists in-tree** (`rg AUTOFILL_KEY src/` shows only the read + clear paths). Impact today: none — the branch is dead. Risk: a future turn that adds a `setItem` (e.g. "Remember role") re-activates an unencrypted persistent password on the shared demo device. Filed as debt-inline observation D1 in Findings.

---

## Section 2 — Superadmin blast radius (Q7–Q11)

**Q7. RLS policy classification on PHI tables** (source: `supabase/migrations/*.sql`):

| Table | Policy shape | Superadmin bypass? |
| --- | --- | --- |
| `beneficiary` | `is_tenant_member(auth.uid(), tenant_id)` for all SELECT/INSERT/UPDATE/DELETE (migration `20260629070132…sql:65-80`) | **No** |
| `encounter` | `is_tenant_member(auth.uid(), tenant_id)` (migration `20260629100358…sql:82-85`) | **No** |
| `charge_item` | `is_tenant_member` (migration `20260629110323…sql:311`) | **No** |
| `claim` | `is_tenant_member` SELECT + ALL; service_role bypass (migration `20260629132157…sql:49-54`) | **No** (service_role bypass is expected for server functions) |
| `patient_wallet` | tenant-scoped read + write (migration `20260701215141…sql:196-198`) | **No** |
| `wallet_txn` | tenant-scoped read + write (migration `20260701215141…sql:220-222`) | **No** |
| `prom_response` / `prom_assignment` / `prom_instrument` / `prem_response` | `is_tenant_member OR has_role('superadmin')` (migration `20260629153547…sql:28,32-33,69-70,100-101,147-148`) | **Yes** — PROM/PREM survey rows are cross-tenant readable by superadmin |
| `tenant_provisioning_request` | `has_role('superadmin')` only (migration `20260712140747…sql:49-52`) | **Yes** (intentional) |
| `legal_documents`, `debug_events`, `versions` | superadmin read/write (migrations `20260628205240…sql`, `20260628041736…sql`) | **Yes** (intentional platform tables) |

Classification: PHI is (a) tenant-scoped, cross-tenant reads by a signed-in demo superadmin **fail RLS**. PROM/PREM tables allow cross-tenant read by any `superadmin` role holder — arguably reasonable for platform QA but flagged as observation D2 below because the demo superadmin (`superadmin@demo.velomedos.com`) inherits this reach.

**Q8. Reset/seed tenant binding.** `resolveDemoTenant()` (`src/lib/demo-seed.functions.ts:75-107`) resolves tenant by hardcoded `slug='demo-hospital'` **and** rejects the row unless `tenant_type='sandbox'`, returning `not_sandbox_tenant`. Caller cannot pass a tenant id. `runResetDemo` scopes every DELETE by `.eq('tenant_id', tenant.id)` in FK-child-first order across `TRANSACTIONAL_TABLES_CHILD_FIRST` (`src/lib/demo-seed.functions.ts:436-446`); `TRUNCATE` is not used. Verified.

**Q9. `SECURITY DEFINER` function exposure.** Previous security scan (this turn's predecessor) revoked `EXECUTE FROM public, anon, authenticated` on `is_sandbox_tenant`, `preauth_mid_board`, `resolve_maternity_protocol`, `seed_vaccine_clinic`, `wallet_gate_open`. `has_role` remains callable (needed by RLS); it is read-only and safe. Investigation required — full inventory of remaining `SECURITY DEFINER` functions vs. their EXECUTE grants; deferred to Round 2.

**Q10. Admin route authorization.** Every `src/routes/api/admin/v1/*` handler under review calls `requireSuperadmin*` before touching state (`demo.reset.ts:21`, `demo.seed.ts` via `runResetDemoFromHeader`, superadmin CRUD in `src/lib/superadmin.functions.ts:59-140`). No route trusts a body-supplied `tenant_id`.

**Q11. JWT claim inspection & session lifetime.** Investigation required — the codebase does not customise `auth.jwt()` claims (no `custom_access_token_hook` in migrations); role is resolved server-side via `has_role(auth.uid(), 'superadmin')` RPC each call, so a stolen JWT cannot self-elevate. Session lifetime = Supabase default (1h access, 30d refresh). Toggling `demo_public_reveal=false` **does not invalidate live sessions** — it only closes the anonymous discovery channel. A demo tenant user who signed in while reveal was on retains a valid session until refresh expiry. Observation D3 below.

---

## Section 3 — Data isolation (Q12–Q16)

**Q12. Demo tenant UUID location.** No hardcoded UUID. `DEMO_TENANT_SLUG = 'demo-hospital'` (`src/lib/demo-mode.ts:15`, `src/lib/demo-seed.functions.ts:21`); tenant id is resolved at runtime via slug + `tenant_type='sandbox'` check. Cross-repo grep for any tenant UUID literal in migrations/routes surfaces only per-test fixture UUIDs under `src/lib/rcm/**/*.test.ts` and the gate-fixture IDs in `seedGateFixtures` (`src/lib/demo-seed.functions.ts:485-499`) — all namespaced to the demo tenant, none leaked into RLS policies or route defaults.

**Q13. Beneficiary / encounter creation — tenant_id source.** Server routes derive `tenant_id` from authenticated session context via `is_tenant_member` policy on WITH CHECK; body-supplied `tenant_id` values that don't match membership are rejected by RLS. No route accepts an arbitrary `?tenant=<uuid>` override to steer writes.

**Q14. Reset WHERE clauses.** All deletions are `.eq('tenant_id', tenant.id)` where `tenant.id` came exclusively from `resolveDemoTenant()`. There is no path where the caller supplies the tenant id (`src/lib/demo-seed.functions.ts:411-462`).

**Q15. Corporate accounts visibility.** `corp read own or staff` and `corp manage by staff or owner` policies (`supabase/migrations/20260626072416…sql:110-112`) — tenant members see their own row, `superadmin` sees all (intentional platform capability). No demo-specific escalation.

**Q16. Cross-tenant cluster/inter-company references.** Cluster fan-out (Step 5) writes referral rows against target tenants via `service_role` inside a verified server function; policy still enforces `is_tenant_member` for read-back on the receiving side. No leakage path surfaced.

---

## Section 4 — Blast radius scenarios (Q17–Q18, synthesis)

Derived from Sections 1–3, not independent investigation.

| Scenario | Reachable | Rationale |
| --- | --- | --- |
| Anonymous scrapes physician emails via `/api/public/v1/demo/credentials` | **Reachable (Informational)** | Only when superadmin flips `demo_public_reveal=true`; filter constrains to physician role. Emails are seed-only. |
| Anonymous scrapes non-physician demo passwords | **Not reachable** | `isPublicVisible` filter blocks non-physician rows (`src/lib/demo-credentials.functions.ts:62-63`); passwords elided from public shape. |
| Anonymous uses `/demo-login?role=physician&autosignin=1` to log in | **Reachable (by design)** | Sign-in requires the roster to include a password; when reveal is off, password is absent → sign-in fails. When reveal is on, this is the sanctioned flow. |
| Signed-in demo superadmin reads partner-tenant PHI via REST | **Not reachable** | No superadmin bypass on `beneficiary`, `encounter`, `charge_item`, `claim`, `patient_wallet`, `wallet_txn` (Section 2, Q7). |
| Signed-in demo superadmin reads partner-tenant PROM/PREM survey rows | **Reachable (Medium — cross-tenant info disclosure)** | Policies `prom_*_superadmin` / `prem_response_superadmin` grant `FOR ALL TO authenticated USING (has_role(auth.uid(), 'superadmin'))`. The demo superadmin holds this role. Not PHI in the strict sense, but includes free-text patient responses. |
| Signed-in demo superadmin resets a partner tenant via `POST /api/admin/v1/demo/reset` with a fabricated `tenant_id` | **Not reachable** | Handler ignores body-supplied tenant; `resolveDemoTenant` requires slug + `tenant_type='sandbox'` (Q8, Q14). URL manipulation that succeeds structurally but fails on RLS = **Medium** per severity rubric — here it fails **before** RLS, on the sandbox gate. |
| Signed-in demo superadmin URL-manipulates `?tenant=<uuid>` in clinical panes | **Not reachable (Medium if it changed)** | Panes derive tenant from session; no `?tenant=` query is honoured by fetchers. RLS would still block reads even if the client tried. |
| Existing demo session survives `demo_public_reveal` being turned off | **Reachable (Informational, D3)** | Confirmed Section 2 Q11. |
| Autofill localStorage exfiltrated from shared demo kiosk | **Not reachable today (Informational, D1)** | Dead read path — no writer exists. Regression risk only. |

---

## Section 5 — Findings

Severity rubric (per plan):
- **Critical**: cross-tenant PHI write or non-superadmin PHI read across tenants.
- **High**: cross-tenant PHI read by any signed-in role, or reset/wipe reachable against a non-sandbox tenant.
- **Medium**: structural URL manipulation that succeeds but is blocked by RLS/gate → information disclosure that a tenant/production surface exists; cross-tenant read of non-PHI operational data by demo superadmin.
- **Low / Informational**: dead code paths that could regress; session lifetime > reveal-toggle window.

### D1 — Dead `localStorage` autofill reader for demo credentials
- **Severity**: Informational
- **Reachable by**: n/a today (regression risk)
- **Attacker action**: none currently; future contributor adds a `setItem(AUTOFILL_KEY, …)` and shared-kiosk credential persistence re-activates
- **Consequence**: unencrypted demo password persisted in browser storage; not applicable to real PHI but violates the "type it every time" demo policy
- **Evidence**: `src/routes/demo-login.tsx:27,45-54,106,130`; `rg AUTOFILL_KEY src/` returns only reads/clears, zero writes
- **Fix proposed**: delete `readStoredAutofill`, `AUTOFILL_KEY`, and the branches at :106/:130 that consume `stored`; if kiosk one-click is desired, thread the password through the URL fragment (not persisted) or through the superadmin-issued signed link
- **Fix owner**: Governance Round 2 (opportunistic; one file, ~20 LOC)

### D2 — Demo superadmin inherits cross-tenant PROM/PREM read
- **Severity**: Medium
- **Reachable by**: `superadmin@demo.velomedos.com` when reveal is on and password is discovered / issued
- **Attacker action**: sign in as demo superadmin → `GET /prom_response?select=*` (PostgREST) returns all tenants' rows
- **Consequence**: patient-authored free-text survey responses across partner tenants become readable; not clinical PHI but arguably sensitive
- **Evidence**: `supabase/migrations/20260629153547_…sql:28,32-33,69-70,100-101,147-148` — four `_superadmin` policies grant `FOR ALL TO authenticated USING (has_role(auth.uid(), 'superadmin'))`
- **Fix proposed**: either (a) tighten to `has_role(auth.uid(), 'superadmin') AND is_sandbox_admin(auth.uid()) = FALSE` — block demo-tenant superadmins specifically — or (b) collapse to `is_tenant_member` and expose cross-tenant reads only through a dedicated Ops server function that gates on non-sandbox superadmin
- **Fix owner**: Governance Round 2 (Batch 1 pricing catalog does not touch these; Batch 2 admin UI is the natural home)

### D3 — `demo_public_reveal=false` does not invalidate existing sessions
- **Severity**: Informational
- **Reachable by**: any user who signed in during a "reveal on" window
- **Attacker action**: passive; refresh token keeps them signed in up to 30d after reveal is toggled off
- **Consequence**: the "close the demo" button in the admin UI is not a session boundary — only a discovery boundary. Users retain read/write inside the demo tenant.
- **Evidence**: no `auth.admin.signOut` fan-out in `setDemoPublicReveal` path; Supabase default session TTLs; `src/lib/demo-credentials.functions.ts` (`setDemoPublicReveal` handler)
- **Fix proposed**: on toggle-off, iterate `DEMO_ACCOUNTS`, look up user ids via `supabaseAdmin.auth.admin.listUsers`, and call `supabaseAdmin.auth.admin.signOut(userId, 'global')` for each. Cheap (~15 users) and idempotent.
- **Fix owner**: Governance Round 2 (Batch 2, alongside `BusinessManagementPane` demo controls)

### D4 — `SECURITY DEFINER` inventory not audited end-to-end
- **Severity**: Informational — investigation gap
- **Reachable by**: n/a (audit gap)
- **Attacker action**: unknown until enumerated
- **Consequence**: this turn confirmed the five functions the automated scanner flagged were locked down (`REVOKE EXECUTE FROM anon, authenticated`), but did not enumerate every remaining `SECURITY DEFINER` function
- **Evidence**: Section 2 Q9 — investigation required
- **Fix proposed**: Round 2 opens with a one-command sweep `rg 'SECURITY DEFINER' supabase/migrations/` → cross-check `pg_proc.proacl` for `PUBLIC EXECUTE` on each; strip where not required
- **Fix owner**: Governance Round 2 hardening pass

_No Critical or High findings._

---

## Section 6 — Overall assessment

**Recommendation: HOLD.** Round 1's structural changes hold up under inspection: PHI is genuinely tenant-scoped without a superadmin bypass, reset/seed is doubly gated on slug + `tenant_type='sandbox'`, the public roster is off by default and physician-filtered when on, and there is no hardcoded demo-tenant UUID in RLS policies or route defaults. The three Medium/Informational observations (dead autofill reader, PROM/PREM cross-tenant superadmin read, session survives reveal-off) are worth cleaning up but do not require an emergency hardening turn between R1 and Round 2 — they are natural fits for Round 2 Batch 2's admin surface. Governance Round 2 proceeds unchanged; carry findings D1–D4 into that batch's scope.

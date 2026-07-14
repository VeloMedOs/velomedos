# Demo Security Audit — Investigation Turn

Investigation-only turn against the surface hardened by Round 1 (physician-only public roster, `tenant_type='sandbox'` gating, banner + exit-demo). Deliverable is a written threat report and one debt-register row. No code, migrations, or test files.

## Deliverables

1. `docs/security/demo-security-audit-2026-07.md` — full audit report following the prompt structure (executive summary + 6 sections + findings + overall assessment).
2. `.lovable/plan.md` — append **row #49** to the existing Debt Register:
  > #49 — Demo security audit findings (see `docs/security/demo-security-audit-2026-07.md`). Owner: Platform Governance turn (if Medium/Low) or Immediate Hardening turn (if Critical/High).
  >  Register single-hit preserved per Convention #25 (no wholesale rewrite).

Nothing else touched.

## Investigation scope

### Section 1 — Demo credential exposure (Q1–Q6)

Read:

- `src/routes/demo-login.tsx`
- `src/routes/api/public/v1/demo.credentials.ts` (+ any `demo-credentials*.functions.ts`)
- Admin route flipping `demo_public_reveal` (search `platform_settings` / `demo_public_reveal`)
- `src/lib/demo-credentials-public-filter.ts` and its test
- `src/lib/api-clinical.ts` demo user handling
- Migration(s) that create `platform_settings` and set default for `demo_public_reveal`

Answer: default state, capability to flip, response shape when reveal is off vs on (post-physician-filter), rate limit / IP allowlist, enumeration risk.

### Section 2 — Superadmin blast radius (Q7–Q11)

Read:

- All migrations mentioning `superadmin`, `super_admin`, `is_admin`, `has_role`, `is_sandbox_tenant`
- RLS policies for: `beneficiary`, `encounter`, `charge_item`, `claim`, `claim_item`, `patient_wallet`, `wallet_txn`, `authorization_request`, `referral`, `admission_request`, `corporate_accounts`
- `src/lib/clinical-role-matrix.ts`, `src/lib/api-clinical.ts` `requireClinicalModule`
- `src/routes/api/admin/v1/*` (esp. `demo.reset.ts`, `demo.seed.ts`, business/tenant routes)
- `SECURITY DEFINER` functions (`wallet_apply_txn`, `refresh_queue_occupancy`, `resolve_maternity_protocol`, `seed_vaccine_clinic`, `preauth_mid_board`, any `demo_*` / `admin_*`)
- `src/components/clinical/daylight/**` superadmin/governance panes
- Session/JWT config (auth settings)

Classify each RLS row as (a) tenant-scoped / (b) superadmin sees all / (c) unclear. Flag any cross-tenant write reach as Critical. Confirm reset/seed tenant binding (hardcoded UUID / caller tenant / attacker param).

### Section 3 — Data isolation (Q12–Q16)

Read:

- Demo tenant UUID location (seeder / config / hardcoded)
- `src/lib/demo-seed*.ts` and referenced migrations
- `src/routes/api/admin/v1/demo.reset.ts` — WHERE clauses on wipe
- Beneficiary / encounter creation paths — tenant_id source (auth context vs body)

### Section 4 — Blast radius scenarios (Q17–Q18)

For each scenario, mark Reachable / Not Reachable / Unclear with citation. Includes anonymous attack chains through `/demo-login` and signed-in demo superadmin URL manipulation (`?tenant=<uuid>`), tenant selector visibility.

### Section 5 — Findings

Each finding in the 7-field format (title / Severity / Reachable by / Attacker action / Consequence / Evidence / Fix proposed / Fix owner). Severity per prompt rubric.

### Section 6 — Overall assessment

One-paragraph recommendation: **force `demo_public_reveal=false` now** vs **hold current state until governance turn**. Decision rule: any Critical or High → force off; only Medium/Low → hold.

## Working method

- Read every file/migration listed above before drafting findings.
- Cite `path:line` or migration filename + policy name for every claim.
- Where evidence is ambiguous or a file is unreadable, write "Investigation required — &nbsp;" and flag as gap for governance turn.
- Report shifts expected from Round 1 hardening (physician-only public filter, sandbox tenant_type, banner + exit-demo) — findings should skew Medium/Informational unless something structural surfaces.
- No tool invocation of `security--run_security_scan` — this is a code+RLS reading audit, not the automated scanner.

## Definition of Done

> Plan approved with four tightenings:
>
> **1. Session investigation depth.** Section 2 point 5 needs to extract JWT payload structure, not just session lifetime. Read `auth.jwt()` custom claims code + inspect JWT payload shape from a signed-in demo session (via `supabase.auth.getSession()` return). Verify explicitly whether toggling `demo_public_reveal=false` invalidates existing sessions or only prevents new sign-ins — if the latter, note it as a real persistence gap.
>
> **2. Demo UUID cross-repo grep (mandatory in Section 3).** After locating the demo tenant UUID in `src/lib/demo-seed*.ts`, grep the UUID literal across all migrations, all routes, and all fixture files. Any occurrence outside the seeder needs classification: RLS policy = intentional isolation; route default = accidental exposure; superadmin whitelist = verify RLS still gates.
>
> **3. Section 4 as synthesis, not investigation.** Complete Sections 1-3 first, then Section 4 derives scenario conclusions with explicit cross-references. Q17's answers are downstream of Section 2's RLS findings, not independently gathered. Prevents accidental re-investigation.
>
> **4. Severity edge case pre-defined.** URL manipulation that succeeds structurally but fails on RLS = **Medium (information disclosure — attacker learns production tenants exist)**, not High (which requires actual data access). Add to severity rubric explanation at top of Section 5.
>
> Executive summary format constraint: 3-5 bullets, findings-first. First bullet states the recommendation (force off now vs hold until governance) so a reader can act without reading further.
>
> Proceed with the audit.

### Post-execution watchlist

When the audit lands:

1. **Every Q1-Q18 has an answer with citation or explicit "Investigation required — <reason>"** — no silent skips
2. **Findings citations resolve** — spot-check by opening a cited `file:line` and verifying the claim matches
3. **Executive summary leads with the recommendation** — not with methodology or process framing
4. **Debt row #49 added via row-delta only** — Convention #25 test; grep `## Debt Register` = 1, position at EOF
5. **Zero code files touched** — this is an investigation turn; `git diff --stat` should show only `.md` + `.lovable/plan.md`
6. **Recommendation is binary** — "force off now" or "hold until governance," not "consider these options"

- `docs/security/demo-security-audit-2026-07.md` created with the 6-section structure
- Q1–Q18 each answered with citation or "Investigation required — …"
- Findings section populated in 7-field format
- Overall assessment renders a clear force-off vs hold recommendation
- `.lovable/plan.md` gains only row #49 (append; no register rewrite)
- Zero code / migration / test-file changes

## Out of scope (explicit)

- No fixes applied this turn — proposed fixes are described in findings only.
- No automated security scan; no dependency scan.
- No touching Round 2 pricing catalog work.
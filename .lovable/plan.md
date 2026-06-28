## 1. Auth chooser (RufayQ-style)

Refactor `src/routes/auth.tsx` into a 3-step flow:

1. **Account-type chooser** (default view): three cards — **Patient**, **Provider / Paramedic/Driver**, **Organisation Admin**. Selection is stored in `sessionStorage` (`velomed:intended_role`) and reflected as `?as=patient|provider|org` in the URL so deep-links work.
2. **Sign-in panel** for the chosen audience:
  - Patient → Google + email/password (sign-up allowed via Google only; no public email sign-up form, matching current policy).
  - Provider / Org admin → email/password only with a note "Credentials issued by your superadmin", plus a "Continue with Google" button that requires a pre-provisioned account (rejects with `ROLE_NOT_PROVISIONED` if no role row exists for the audience).
3. Footer link "New organisation? Apply for access" → `/business-intake`.

Superadmin email continues to bounce to `/superadmin/login`.

## 2. Google OAuth: redirect, errors, diagnostics

`src/routes/auth.tsx` — `google()` handler:

- `redirect_uri = ${window.location.origin}/auth` (public, same-origin — matches current code, keep).
- Persist `intended_role` and a fresh `oauth_attempt_id` (uuid) to `sessionStorage` before redirect so the post-callback page can log/correlate.
- After return, when `supabase.auth.getUser()` resolves, call the new `recordOAuthOutcome` server fn (success or failure) and route via the existing `destinationForUser` (extend to honor `intended_role` mismatches → show an inline "Your Google account isn't linked to a {role} profile" panel with **Use a different account** and **Apply for access** actions, instead of silent redirect).

Surface specific failure codes from `result.error` / URL hash:


| Code                                             | Message                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `access_denied`                                  | "You cancelled the Google consent screen."                                |
| `missing_email` (Google returned no email scope) | "We need your Google email to sign you in."                               |
| `invalid_client` / `redirect_uri_mismatch`       | "Google sign-in is misconfigured. Contact support — code `OAUTH_CLIENT`." |
| `role_not_provisioned`                           | "This Google account isn't linked to a {role} profile."                   |
| network / unknown                                | Generic + show `oauth_attempt_id` for support.                            |


Errors are rendered inline (not just toast) with copy-able diagnostic ID.

## 3. Server-side OAuth diagnostics

New table `public.oauth_events` (id, user_id nullable, email, provider, outcome, code, intended_role, resolved_role, user_agent, ip, attempt_id, created_at). RLS: insert via service role only; select restricted to `has_role(uid,'superadmin')`. Grants for `service_role` + select for `authenticated` (superadmin policy gates rows).

New server fns in `src/lib/oauth-diagnostics.functions.ts`:

- `recordOAuthOutcome({ attemptId, outcome, code?, intendedRole?, resolvedRole? })` — uses `requireSupabaseAuth` when available, otherwise public variant for pre-auth failures; writes via `supabaseAdmin` (loaded inside handler).
- `listRecentOAuthEvents` — superadmin only, last 100.

Add a new pane to `/superadmin` ("Auth diagnostics") showing recent events grouped by outcome.

## 4. Account linking / unlinking (Patient)

Supabase manages identity linking natively. Implement on the patient profile page:

- Server fn `listIdentities` → returns `supabase.auth.getUserIdentities()` mapped to `{ provider, email, created_at, last_sign_in_at }`.
- Server fn `linkGoogleIdentity` → `supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo:` ${origin}/patient?linked=google `} })` (client-side call, not server — adjust to a thin client helper).
- Server fn `unlinkIdentity({ provider })` → guards against unlinking the **last** identity (returns `LAST_IDENTITY` error) and against unlinking the identity matching the primary email when no password is set.
- Sign-in path: when Google returns an email that already matches an existing user, Supabase auto-merges by email (default behaviour in this project). Add an explicit pre-check in `recordOAuthOutcome`: if `auth.users` row pre-existed for this email but identity differs, log `outcome=linked_existing`.

## 5. Patient profile module (RufayQ parity)

### Schema (migration)

Extend `public.profiles` with: `display_name`, `phone`, `dob date`, `gender`, `nationality`, `national_id_last4`, `passport_number`, `blood_type`, `member_code` (e.g. `VMD-2026-XXXXXX`, generated on insert), `verified_at`. Add tables:

- `patient_conditions(id, user_id, label, severity, notes, created_at)`
- `patient_allergies(id, user_id, label, reaction, severity, created_at)`
- `patient_emergency_contacts(id, user_id, name, relation, phone, is_primary)`
- `patient_connections(id, owner_id, peer_id, status, created_at)` (placeholder for "My network")
- `patient_insurance(id, user_id, payer, policy_no, status, valid_until)` (read-only from patient; written by provider role).

All with RLS: owner read/write (`auth.uid() = user_id`), provider-with-active-trip read (defer to phase 2 — for now provider role only via has_role check). GRANTs to authenticated + service_role per project rules.

Add `profile_completeness(user_id)` SQL function returning 0–9 score based on filled fields.

### APIs (`createServerFn`, `src/lib/patient-profile.functions.ts`)

CRUD wrappers using `requireSupabaseAuth`:

- `getMyProfile` → profile + completeness + identities summary.
- `updateMyProfile(patch)`
- `listConditions`, `addCondition`, `removeCondition`
- `listAllergies`, `addAllergy`, `removeAllergy`
- `listEmergencyContacts`, `upsertEmergencyContact`, `removeEmergencyContact`
- `getInsuranceStatus`
- `listConnections`
- `listSignInMethods` (wraps `listIdentities`)

Also expose minimal read-only mirror under `/api/admin/v1/patients.*` for superadmin (existing pattern).

### UI

Refactor `src/routes/_authenticated/patient.tsx` into a "My care" tabbed shell, add new route `src/routes/_authenticated/patient.profile.tsx` ("Your profile") mirroring the RufayQ layout:

- Header: avatar, name, "Verified · VeloMed member", member code with copy/share.
- Completeness ring (X/9 · %).
- Sections: Personal details, My network, Demographics, Medical (blood type / conditions / allergies), Provider access (insurance + RCM), Emergency contacts.
- **Connected sign-in methods** card with Google / Apple / Email / Phone rows, status pill, Connect/Disconnect buttons wired to the linking server fns above. Disabled unlink for last remaining method.
- Disclaimer block (VeloMed-specific copy).

Add side-nav entry "Profile" in the patient shell.

## 6. Verification

- `tsgo` typecheck.
- Manual smoke via Playwright: open `/auth`, pick Patient, click Continue with Google (stop at consent — verify redirect URI and `attempt_id` persisted), then simulate post-callback by visiting `/auth?as=patient` with a mock session to confirm role routing.
- Confirm `oauth_events` rows appear in superadmin diagnostics pane.

## Technical notes

- No changes to `client.ts`, `auth-middleware.ts`, `auth-attacher.ts`.
- Identity linking uses the client SDK (`supabase.auth.linkIdentity` / `unlinkIdentity`) — server fns wrap only the read/audit path; the actual link redirect must originate in the browser.
- All new tables get explicit `GRANT` + RLS per project standard.
- Apple sign-in row in profile shows "Coming soon" (not enabled in this project).
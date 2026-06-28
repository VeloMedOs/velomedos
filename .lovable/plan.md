# Superadmin Access Hardening

## Why /superadmin shows 404 today

The route exists at `src/routes/_authenticated/superadmin.tsx` and works on the latest preview build. `www.velomedos.com/superadmin` returns 404 because the **published** deployment is older than the route. After this change lands we re‑publish and the URL resolves.

## Goals

1. `/superadmin` is reachable, but never publicly self‑service.
2. Exactly one superadmin identity exists: `Superadmin@velomedOs.com`, credentials sourced from a project secret named `SUPERADMIN_SECRET` (label shown to user as “Superadmin Secret”). and the secret wil lbe used as the Password [Later on OTP linked to One Mobile number or 2FA for extra security layer]
3. Superadmin password can be reset only via a numeric verification code emailed to that exact mailbox. or infuture through Superadmin Mobile Number OTP
4. All other portal users (developers, call‑center agents, future roles) are provisioned by the superadmin and sign in with the credentials the superadmin gives them in the respected Role & Rospensibility Table — no public sign‑up for any portal role.

## Plan

### 1. Secret + bootstrap

- Add a project secret `**SUPERADMIN_SECRET**` (the value is the initial superadmin password). Stored server‑side only, never sent to the browser.
- Add server function `bootstrapSuperadmin()` that runs on first hit to `/superadmin/login`:
  - If no `auth.users` row exists for `superadmin@velomedos.com`, create one via `supabaseAdmin.auth.admin.createUser` with `email_confirm: true` and password = `SUPERADMIN_SECRET`.
  - Insert `user_roles(role='superadmin')` for that user.
  - Idempotent — safe on every cold start.

### 2. Sign‑up lockdown

- Call `supabase--configure_auth` with `disable_signup: true` so no one can create accounts from the client SDK.
- Strip the “Create account” tab from `src/routes/auth.tsx`; keep sign‑in + Google for the operational portals only.
- Add a guard on `/auth` that refuses sign‑in attempts for `superadmin@velomedos.com` and redirects them to `/superadmin/login`.

### 3. Dedicated superadmin login surface

- New public route `src/routes/superadmin.login.tsx`:
  - Email is locked to `superadmin@velomedos.com` (read‑only).
  - Password field + “Forgot password”.
  - On submit calls `supabase.auth.signInWithPassword`. Server‑side `requireSuperadmin` middleware confirms the `superadmin` role before allowing the session to land on `/superadmin`.
- `_authenticated/superadmin.tsx` keeps the existing `AUTH_MISSING / ROLE_INSUFFICIENT` denial screen as defense in depth.

### 4. Email‑code password reset (no magic links)

- New table `superadmin_reset_codes(id, code_hash, expires_at, consumed_at, attempts)`.
- Server functions:
  - `requestSuperadminReset()` → generates a 6‑digit code, stores SHA‑256 hash with 10‑min TTL, sends the code to `superadmin@velomedos.com` via the Lovable email infra (auth template scaffolded with `email_domain--scaffold_auth_email_templates`).
  - `confirmSuperadminReset({ code, newPassword })` → verifies hash, marks consumed, calls `supabaseAdmin.auth.admin.updateUserById` to set the new password, then rotates `SUPERADMIN_SECRET` value in memory only (the secret remains the *initial* bootstrap; live password lives in auth).
- UI: `/superadmin/reset` two‑step form (request code → enter code + new password).
- Rate‑limited (max 5 attempts / 15 min per IP) and only ever targets the single hard‑coded mailbox.

### 5. Operator‑managed credentials for other roles

- Superadmin → **Roles & access** pane gains an “Invite operator” action:
  - Inputs: email, display name, role (developer, call‑center, dispatcher, …).
  - Calls new admin endpoint `POST /api/admin/v1/operators` which uses `supabaseAdmin.auth.admin.createUser` with a generated strong password, inserts the matching `user_roles` row, and returns the one‑time credentials for the superadmin to hand off.
  - Optional “force password change on first login” flag stored on `profiles`; enforced by a middleware redirect to `/account/change-password` until cleared.
- Existing operators list shows status, last sign‑in, and a “Reset password” action that regenerates a one‑time password (same handoff flow). No self‑service signup anywhere.

### 6. Verification

- After build: visit `/superadmin/login`, sign in with `SUPERADMIN_SECRET`, confirm `/superadmin` loads and identity panel shows `superadmin` role from `user_roles`.
- Trigger password reset, receive the 6‑digit code at the mailbox, set a new password, sign in again.
- Create a test call‑center operator from the Roles pane, confirm they can sign in at `/auth` with the granted password and cannot reach `/superadmin`.
- Re‑publish so `www.velomedos.com/superadmin` stops 404’ing.

## Technical notes (for reference)

- Files added/changed: `src/routes/superadmin.login.tsx`, `src/routes/superadmin.reset.tsx`, `src/lib/superadmin.functions.ts`, `src/lib/superadmin.server.ts`, `src/routes/api/admin/v1/operators.ts`, edits to `src/routes/auth.tsx`, `src/routes/_authenticated/superadmin.tsx` (Roles pane), new migration for `superadmin_reset_codes` + GRANTs.
- Secret to add: `SUPERADMIN_SECRET` (initial password only — the live password lives in `auth.users`).
- Email templates: scaffolded via auth email infra; requires the project email domain to be set up (will trigger that dialog if missing).
- `supabase--configure_auth` flags: `disable_signup: true`, leave others unchanged.
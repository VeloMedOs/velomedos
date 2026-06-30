## Goal

One-click demo entry. Two URLs, two purposes:

- **`/demo-login`** — minimal **3-field form** (Role · Username · Password) auto-filled the moment you pick a role. One **Sign in** button. Nothing else on screen.
- **`/demo-credentials`** — full **roster page** with every account, copy buttons, "Copy all as markdown", and per-row Sign-in. For ops/demos to share credentials at a glance.

Superadmin owns all passwords through a generator panel.

## 1. Republish (fixes the 404)

`/demo-login` exists in code but `velomedos.com` is serving the pre-deploy build. After republish:
- Live: `https://velomedos.com/demo-login` and `https://velomedos.com/demo-credentials`
- Preview (today): `https://id-preview--69ccb204-2bf6-4daa-b725-472aa2a136cf.lovable.app/demo-login`

## 2. Backend — per-role passwords

New table (migration):

```text
demo_credentials
  email          text primary key   -- doctor@demo.velomedos.com
  role_label     text               -- "Physician"
  clinical_role  text               -- "physician" (nullable for patient/superadmin)
  lands_on       text               -- "/clinical?tab=encounters"
  password       text               -- per-role, rotatable
  updated_at     timestamptz
```

RLS: **service_role only**. No anon/authenticated read. Access via two server functions:

- `listDemoCredentials()` — Superadmin-only (verifies `has_role(uid,'superadmin')`).
- `getDemoCredentialsPublic()` — public, but returns rows **only when** the resolved tenant has `is_demo = true` **and** the project flag `DEMO_PUBLIC_REVEAL=true`. Otherwise returns `{ reveal: false, accounts: [{email, role_label, lands_on}] }` (no passwords) so the page can degrade to the legacy "paste shared password" flow.

Seed function (`demo-seed.functions.ts`) updated to use `demo_credentials.password` when present, falling back to `DEMO_USER_PASSWORD`. New `applyCredentialsToAuth()` syncs `demo_credentials.password` → Supabase Auth via Admin API (admin client loaded inside the handler).

## 3. Superadmin → Demo Environment panel

Extend `src/components/superadmin/DemoControlPane.tsx`:

- **Credentials table**: email · role · password (masked, click-to-reveal) · last rotated · row actions.
- **Per-row**: `Generate` (new 20-char password, alphanumeric + 2 symbols), `Copy email`, `Copy password`, `Sign in as` (opens `/demo-login?role=<key>&autosignin=1` in a new tab).
- **Bulk**: `Generate all`, `Apply to auth users` (existing progress + success/failure UI).
- **Reveal toggle**: global show/hide passwords in the table.
- **Public reveal switch**: flips `DEMO_PUBLIC_REVEAL`. When OFF, `/demo-login` shows the legacy shared-password input; when ON, the role selector auto-fills the password from the public server fn.

## 4. `/demo-login` — minimal 3-field form (the daily-driver URL)

Rewrite `src/routes/demo-login.tsx` to a single card:

```text
┌─────────────────────────────────────────┐
│  VeloMed sandbox — sign in              │
│                                         │
│  Role      [ Physician        ▾ ]      │
│  Username  doctor@demo.velomedos.com   │
│  Password  ••••••••••••••••   [Show]   │
│                                         │
│            [   Sign in   ]              │
│                                         │
│  See all accounts → /demo-credentials   │
└─────────────────────────────────────────┘
```

Behavior:
- Role `<select>` is populated from `getDemoCredentialsPublic()` on mount.
- Selecting a role **instantly fills** username + password (both editable, in case operator overrides).
- `Sign in` → `supabase.auth.signInWithPassword` → redirect via `clinicalDestinationFor(clinical_role)` (or `lands_on`).
- URL params: `?role=physician` preselects; `?role=physician&autosignin=1` signs in immediately (used by the Superadmin "Sign in as" buttons).
- If public reveal is OFF: password field stays empty, helper text appears: *"Ask your operator for the shared demo password, or open `/demo-credentials` from inside Superadmin."* — sign-in still works manually.

Page stays `noindex,nofollow`.

## 5. `/demo-credentials` — full roster page (new route)

New file `src/routes/demo-credentials.tsx`:

- Grouped account list (Platform · Clinical · Coding & RCM · Cash & Finance · Audit & Patient) — same grouping as today's `/demo-login`.
- Each row: role, blurb, target landing URL, email + copy, password + show/copy (only when public reveal is on), `Sign in` button (delegates to `/demo-login?role=...&autosignin=1`).
- Top of page: **"Copy all as markdown"** button — produces a sharable credentials block.
- Empty/locked state when public reveal is off.
- `noindex,nofollow`, excluded from sitemap audit.

## 6. Surface the entry everywhere (`src/components/SiteChrome.tsx`)

- **Header (desktop):** add a subtle outline pill **"Try the sandbox"** between *Staff login* and *Sign in* → `/demo-login`.
- **Header (mobile):** include the same link in any mobile menu we render.
- **Footer → Company column:** add `["Demo sandbox", "/demo-login"]` right under *Book a demo*; add `["All demo credentials", "/demo-credentials"]` under it.
- **Contextual links** (one small line each):
  - `/demo` → "Or jump straight into the live sandbox →" → `/demo-login`
  - `/his` → "No credentials? Use the sandbox accounts →" → `/demo-login`
  - `/auth` → "Just exploring? Open the demo sandbox →" → `/demo-login`

## 7. Docs

- Update `docs/demo-access-sheet.md` and `docs/demo-script.md`:
  - Daily-driver URL: **`/demo-login`** (3-field form).
  - Reference URL: **`/demo-credentials`** (full roster).
  - Operator workflow: Superadmin → Demo Environment → Generate all → Apply to auth users → toggle Public reveal.

## What you'll do after I ship this

1. Open `/superadmin` → **Demo Environment** → **Generate all** → **Apply to auth users**.
2. Toggle **Public reveal** ON (one-time).
3. Send anyone to `https://velomedos.com/demo-login` → pick **Physician** → click **Sign in**. Done.
4. For internal sharing or screen-shares, send `/demo-credentials` instead.

Approve and I'll switch to build mode to implement steps 2–7, then trigger Publish to ship step 1.
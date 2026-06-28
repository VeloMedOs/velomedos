## Problem

Google sign-in fails because Supabase-wide sign-up is currently **disabled** (`disable_signup: true` was set when we locked down the superadmin flow). That switch blocks **all** new identities, OAuth included — so a first-time Google user gets rejected before your custom Google OAuth client is even consulted. Existing Google users may also hit "Database error saving new user" if their `auth.users` row doesn't exist yet.

Your custom Google Client ID + Secret are already saved in Lovable Cloud → Auth Settings → Google, so no credential work is needed.

## Fix

1. **Re-enable sign-ups at the auth layer** via `supabase--configure_auth` (`disable_signup: false`, keep `auto_confirm_email: false`, keep HIBP on). The existing `handle_new_user` trigger auto-creates a `profiles` row and grants the `patient` role to any new auth user — exactly what we want for Google sign-ups.
2. **Keep password sign-up closed at the UI layer.** `src/routes/auth.tsx` already hides the sign-up form and routes `superadmin@velomedos.com` to `/superadmin/login`. No change needed there — operators are still invite-only because there is no password sign-up surface, and the superadmin identity is still secret-gated.
3. **Verify the OAuth call site is correct.** Confirm `auth.tsx` uses `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` (public same-origin URL, not a protected route). It already does — no change.
4. **Add a post-OAuth role-aware redirect.** After Google returns and the session hydrates, route the user by role: superadmin → `/superadmin`, operator roles → `/dispatch`, patient → `/patient`. Today everyone lands on `/dispatch`, which 403s a patient and feels broken. Small change in `auth.tsx`'s `getUser().then(...)` and the `onAuthStateChange` path.
5. **Smoke-test in headless Chromium**: hit `/auth`, click Continue with Google (use the Lovable broker which works in the preview iframe), assert the broker reaches `accounts.google.com` (proves your client ID is live), and capture the screenshot.

## Out of scope

- No changes to your Google Cloud Console config — credentials are already saved.
- No changes to superadmin flow, password reset, or operator provisioning.
- No new tables, no RLS changes (the existing `handle_new_user` trigger covers patient provisioning).

## Technical notes

- `supabase--configure_auth` is the only way to flip `disable_signup` — re-running it is idempotent.
- `handle_new_user` already inserts into `profiles` + grants either Provider under specific role or `patient` in `user_roles` on every new `auth.users` row, so Google sign-ups inherit patient access automatically with no extra code.
- The Lovable-managed Google broker (`@/integrations/lovable`) transparently uses your custom Client ID/Secret once they're saved in Auth Settings — same code path, your credentials.
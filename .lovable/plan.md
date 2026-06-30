## Goal
Make the demo entry work reliably from the live URL and from Superadmin: role selector loads, credentials copy/sign-in works, and Superadmin can generate/apply passwords with clear status.

## Findings
- The live public credentials API is responding and has 13 accounts.
- Public reveal is currently OFF, so `/demo-login` can list accounts but should not auto-fill passwords unless Superadmin enables it.
- The screenshot’s `Failed to fetch` is happening in preview/browser fetch, not from the live endpoint; the page needs a more resilient fallback and clearer instructions.
- Direct Superadmin login uses a separate real Superadmin account (`superadmin@velomedos.com`) and project secret, while demo Superadmin is `superadmin@demo.velomedos.com`. The UX currently makes this easy to confuse.

## Implementation plan
1. **Harden `/demo-login`**
   - Add a built-in static fallback roster so the role dropdown never stays stuck at “Loading sandbox accounts…” if the credentials API fetch fails.
   - Keep the 3 fields: role selector, username, password.
   - Show an operator-friendly message when passwords are hidden: “Enable Public reveal or copy password from Superadmin.”
   - Prevent autosignin unless a password is actually available.

2. **Clarify Superadmin vs Sandbox sign-in**
   - Update copy on `/demo-login` so demo Superadmin is clearly labeled as “Demo Superadmin”.
   - Add a clear “Real Superadmin portal” link to `/superadmin/login` for the actual control-plane login.
   - Add a note that `superadmin@velomedos.com` is not a sandbox account and must be used only on `/superadmin/login`.

3. **Make Superadmin Demo Environment one-click reliable**
   - In `DemoControlPane`, improve the flow order:
     1. Generate or edit passwords.
     2. Apply to auth users.
     3. Enable Public reveal.
     4. Open `/demo-login`.
   - Add clearer success/failure messaging for “Apply to auth users”, including missing users and sync count.
   - Keep existing seed/reset controls, but make the credential section the obvious path for login repair.

4. **Add a server-side fallback for credentials API failures**
   - Ensure the public credentials response can still return safe account metadata even if the `demo_credentials` table read fails temporarily.
   - Only include passwords when the reveal flag is ON and rows are available.

5. **Verify after implementation**
   - Test `/api/public/v1/demo/credentials` returns JSON.
   - Test `/demo-login` loads roles without being stuck.
   - Test form behavior when reveal is OFF and when credentials are typed manually.
   - Confirm `/superadmin/login` remains separate for the real Superadmin portal.

## Immediate guidance after fix
- Live demo entry URL: `https://velomedos.com/demo-login`
- Full credential roster URL: `https://velomedos.com/demo-credentials`
- Real Superadmin portal: `https://velomedos.com/superadmin/login`
- If passwords should auto-fill publicly, enable **Public reveal** from Superadmin → Demo Environment, then click **Apply to auth users**.
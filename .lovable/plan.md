## WW1 + WW2 — Batch 1 final closures

Two small hardening edits to finish Round 1 Batch 1 before Batch 2 unlocks.

### WW1 — Physician-only filter on the public credentials path

`src/lib/demo-credentials.functions.ts`

Both public entry points today (`getDemoPublicState` server-fn and `getDemoPublicStateRest` REST helper) return the entire 13-account roster, exposing `superadmin@…`, `admin@…`, and every support-role email to any anonymous caller. Apply Option A hardening as a public-only filter — the shared code stays, the filter is scoped to the two public entry points.

Change:

1. Add a single-line pure helper (module-scope) that keeps the filter definition in one place:
  ```ts
   // Round 1 hardening: anonymous callers only see the physician row —
   // superadmin/tenant-admin/support emails must not leak to the public
   // /demo-login and /api/public/v1/demo/credentials surfaces.
   const isPublicVisible = (r: { clinical_role: string | null }) =>
     r.clinical_role === "physician";
  ```
2. In `getDemoPublicState` (line 241) and `getDemoPublicStateRest` (line 285):
  - Filter `data` rows through `isPublicVisible` before the `.map(...)` that produces `accounts`.
  - Apply the same filter to `FALLBACK_PUBLIC_ACCOUNTS` in the two early-return branches (error path + empty-table path).
3. Superadmin paths (`listDemoCredentials`, `listDemoCredentialsFromHeader`, `rotate*`, `applyCredentialsToAuth`, `setDemoPublicReveal`) are unchanged — they gate on `requireSuperadmin*` and correctly need the full roster.

The password-reveal branch stays as-is: even with `demo_public_reveal=true`, only the physician row's password can leak, matching the DoD ("physician role only regardless of demo_public_reveal").

### WW2 — Stale header comment on demo.reset.ts

`src/routes/api/admin/v1/demo.reset.ts` (line 10)

Replace:

```
 * run unless `corporate_accounts.is_demo = true` for the resolved tenant.
```

with:

```
 * run unless `corporate_accounts.tenant_type = 'sandbox'` for the resolved
 * tenant (`resolveDemoTenant()` returns `not_sandbox_tenant` otherwise).
```

Code path is already correct — comment only.

### Also: acknowledge simplified enums

Update `.lovable/plan.md` (Batch 2 deferred section) to record the ratified state machine so Batch 2 builds against the right shape:

- `tenant_type` = `sandbox | partner | production` (3 values — `partner` replaces the earlier draft `paid` slot).
- `tenant_lifecycle` = `intake | provisioning | active | suspended | archived` (5 values). Promotion path: `intake → provisioning → active`; terminal states `suspended`, `archived`.
- `platform_settings.demo_videos_enabled.value` shape is `{ enabled: boolean }` — Batch 2 `/demo-tour` reader must access `.value.enabled`, not `.value`.

No code beyond the comment and register note; no migrations.

### Verification

- `bun test` — expect 221 pass unchanged (5 pre-existing Playwright specs still noisy; not touched).
- Manual: `curl` the public route and confirm `accounts.length === 1` with `clinical_role === "physician"`.
- Grep gate: `rg "is_demo" src/routes/api/admin/v1/demo` returns nothing.

### Confirmed: **line 255 maps** `data` **directly without any filter.** No `isPublicVisible` helper, no filter application. The public credentials endpoint still returns the full 13-account roster including superadmin.

**Reply to Lovable:**

> The WW1+WW2 closure plan reads clean but zero code changes have landed at `15d9dd1`. Verification:
>
> - **WW1 filter helper absent.** Grep for `isPublicVisible` in `src/lib/demo-credentials.functions.ts` = 0 hits. Reading line 255 directly: `const accounts = (data ?? []).map((r: any) => ({ ... }))` — the `.map` is unfiltered. Same at line 292 (getDemoPublicStateRest). Public credentials endpoint still returns all 13 accounts including superadmin, tenant_admin, and 11 support roles.
> - **WW2 header comment not updated.** `src/routes/api/admin/v1/demo.reset.ts` line 10 still reads: `run unless corporate_accounts.is_demo = true for the resolved tenant.` — verbatim the pre-fix text. Only `is_demo` reference in the demo routes is at this line.
> - **Register enum shapes not updated.** `.lovable/plan.md` still lists the original `tenant_type (production|sandbox|staging|archive)` and 8-value `tenant_lifecycle`. Batch 2's Business Management pane will build against the wrong state machine if this isn't corrected before Batch 2 planning.
>
> Same commit hash as previous validation (`15d9dd1 Fixed plan & applied fix`). Your Batch 1 closure message describes intent but doesn't reflect a push to main. Please:
>
> 1. Actually apply the `isPublicVisible` filter at line 255 and line 296 (getDemoPublicStateRest) plus the two fallback branches (lines 248, 249, 292, 293) so `FALLBACK_PUBLIC_ACCOUNTS` also filters through it
> 2. Update `demo.reset.ts` line 10 comment to the new wording
> 3. Update `.lovable/plan.md` enum notes to the ratified 3-value tenant_type and 5-value tenant_lifecycle, plus the `{enabled: boolean}` jsonb shape note
> 4. Push to main and share the new commit hash for verification
>
> Also worth adding a fixture that guards against this class of regression: `demo-credentials-public-filter.test.ts` — imports `getDemoPublicStateRest`, calls with mocked full-roster response, asserts `accounts.length === 1` and `accounts[0].clinical_role === 'physician'`. Prevents the filter from being accidentally removed in a future refactor.

**On the meta-pattern:** this is the first time in the thread Lovable has reported closure without the code actually landing. Every prior turn, code was pushed and I could verify. Two possibilities:

1. **Push failed silently** — Lovable applied changes locally but the commit didn't reach main. Common with tool-based agents when the commit or push step errors out and the error message doesn't surface.
2. **Lovable is describing the plan, not the result** — the message reads like an execution plan ("Change: ...", "Update: ...") rather than a closure report ("Filter applied at line X; register updated"). Ambiguous phrasing.

Either way, the verification catches it. No harm done — Batch 1 stays open until the code lands.

**Batch 1 remains open. Batch 2 (**`/demo-tour` **+ BusinessIntakeModal + BusinessManagementPane + 15 superadmin routes + landing CTAs + ≥237 tests) stays queued until WW1+WW2+register enum update actually push to main.**

Waiting for the actual commit.  
  
Out of scope (Batch 2)

`/demo-tour` route, `BusinessIntakeModal`, `BusinessManagementPane` with three tabs, ~15 superadmin routes for business_requests / tenant_provisioning_request advancement, DemoBanner CTA wiring, landing-page CTAs, and the ≥237-test target all defer to Batch 2 as approved.
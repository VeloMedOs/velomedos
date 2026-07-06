import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * End-to-end demo flow — reset → seed → Tenant Admin → Orders tab.
 *
 * Verifies the three-state Billed-Gate fixture surfaces the expected
 * green / amber / red `.clin-pill` markers on `OrdersPane`.
 *
 * Requires the `DEMO_USER_PASSWORD` env var; skips cleanly when unset.
 *
 * Run:
 *   DEMO_USER_PASSWORD=... bunx playwright test tests/e2e/demo-flow.spec.ts
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://nyieldwdhdzsglxovvuj.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aWVsZHdkaGR6c2dseG92dnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTAyMTUsImV4cCI6MjA5Nzk4NjIxNX0.ldtWFeOm4uFAc5bTFXOXrYDbl_LCA48g1_z1OyLD_so";

const SUPERADMIN = "superadmin@demo.velomedos.com";
const TENANT_ADMIN = "admin@demo.velomedos.com";

async function signInPassword(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`sign-in failed for ${email}: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

test.describe("@demo-flow demo reset → seed → Tenant Admin → Orders", () => {
  const password = process.env.DEMO_USER_PASSWORD;

  test.skip(!password, "DEMO_USER_PASSWORD not set — skipping demo end-to-end flow.");

  test("green / amber / red gate badges render on Orders tab", async ({ page, request, baseURL }) => {
    test.setTimeout(90_000);

    // 1. Superadmin token → reset + seed.
    const superToken = await signInPassword(request, SUPERADMIN, password!);
    const authHeaders = { Authorization: `Bearer ${superToken}`, "Content-Type": "application/json" };

    const reset = await request.post(`${baseURL}/api/admin/v1/demo/reset`, {
      headers: authHeaders, data: { reseed: true },
    });
    expect(reset.status(), `reset: ${await reset.text()}`).toBe(200);

    const seed = await request.post(`${baseURL}/api/admin/v1/demo/seed`, {
      headers: authHeaders, data: { step: "all" },
    });
    expect(seed.status(), `seed: ${await seed.text()}`).toBe(200);

    // 2. Sign in as Tenant Admin via the demo-login UI.
    await page.goto("/demo-login");
    // Roster loads async; wait for the select to be enabled.
    const roleSelect = page.locator('select').first();
    await expect(roleSelect).toBeEnabled({ timeout: 10_000 });
    await roleSelect.selectOption({ label: "Tenant Admin" });
    await page.locator('input[type="email"]').fill(TENANT_ADMIN);
    // Password field may already be filled if public reveal is on; overwrite either way.
    await page.locator('input[name="velomed-demo-password"]').fill(password!);
    await page.getByRole("button", { name: /Sign in/i }).click();

    await page.waitForURL(/\/clinical(\?|$)/, { timeout: 15_000 });

    // 3. Navigate to the Orders tab.
    await page.goto("/clinical?tab=orders");
    // OrdersPane surfaces this card; wait for it to render.
    await expect(page.getByText(/Encounter\s*·/)).toBeVisible({ timeout: 15_000 });

    // 4. Assert all three gate states are represented.
    const okPill = page.locator(".clin-pill.ok").filter({ hasText: /Billed/i });
    const warnPill = page.locator(".clin-pill.warn").filter({ hasText: /Released/i });
    const critPill = page.locator(".clin-pill.crit").filter({ hasText: /Locked/i });

    await expect(okPill.first()).toBeVisible({ timeout: 15_000 });
    await expect(warnPill.first()).toBeVisible();
    await expect(critPill.first()).toBeVisible();

    // Locked rows must render their Perform/Dispense wrapper with aria-disabled.
    const lockedWrapper = critPill.first().locator('xpath=following-sibling::div[@aria-disabled="true"]');
    await expect(lockedWrapper).toHaveCount(1);
  });
});
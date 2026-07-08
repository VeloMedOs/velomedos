import { test, expect } from "@playwright/test";

/**
 * Step 3 · Turn 3 — Clinic Day Board smoke test.
 *
 * Requires the demo seed to include OPD scheduling fixtures. Skips cleanly
 * when DEMO_USER_PASSWORD is unset. Full pixel-diff acceptance baseline is
 * committed on first run via `bun run test:e2e:update`.
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://nyieldwdhdzsglxovvuj.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aWVsZHdkaGR6c2dseG92dnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTAyMTUsImV4cCI6MjA5Nzk4NjIxNX0.ldtWFeOm4uFAc5bTFXOXrYDbl_LCA48g1_z1OyLD_so";
const TENANT_ADMIN = "admin@demo.velomedos.com";

test.describe("@day-board OPD Clinic Day Board", () => {
  const password = process.env.DEMO_USER_PASSWORD;
  test.skip(!password, "DEMO_USER_PASSWORD not set — skipping day-board smoke.");

  test("renders board + booking-request rail for Tenant Admin", async ({ page, request, baseURL }) => {
    test.setTimeout(60_000);
    const tokRes = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      data: { email: TENANT_ADMIN, password: password! },
    });
    expect(tokRes.ok(), `sign-in: ${await tokRes.text()}`).toBeTruthy();
    const { access_token } = (await tokRes.json()) as { access_token: string };

    await page.goto(`${baseURL}/clinical?tab=opd-day-board`);
    await page.evaluate(([url, key, token]) => {
      const ref = new URL(url).host.split(".")[0];
      window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: token, token_type: "bearer" }));
    }, [SUPABASE_URL, SUPABASE_KEY, access_token] as const);
    await page.reload();

    await expect(page.getByRole("heading", { name: /Clinic Day Board/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("grid", { name: /opd_clinic day board/i })).toBeVisible();
    // Booking-request rail present.
    await expect(page.getByText(/Booking requests/i)).toBeVisible();
  });
});
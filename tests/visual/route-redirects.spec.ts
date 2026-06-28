import { test, expect } from "@playwright/test";

// Smoke checks that the role-aware redirect surfaces stay wired.
// Run against a local dev server: `bun run dev` then `bunx playwright test tests/visual/route-redirects.spec.ts`.

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";

test.describe("auth redirects", () => {
  test("/superadmin sends signed-out visitors to /superadmin/login", async ({ page }) => {
    await page.goto(`${BASE}/superadmin`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/superadmin\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/superadmin/login");
  });

  test("/dispatch sends signed-out visitors to /auth (not /superadmin/login)", async ({ page }) => {
    await page.goto(`${BASE}/dispatch`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth(\?|$)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/auth/);
    expect(page.url()).not.toContain("/superadmin/login");
  });

  test("/patient sends signed-out visitors to /auth", async ({ page }) => {
    await page.goto(`${BASE}/patient`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth(\?|$)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/auth/);
  });

  test("/provider sends signed-out visitors to /auth", async ({ page }) => {
    await page.goto(`${BASE}/provider`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth(\?|$)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/auth/);
  });

  test("/auth/error renders the dedicated OAuth error page", async ({ page }) => {
    await page.goto(`${BASE}/auth/error?code=access_denied&attempt=test-attempt&as=patient`);
    await expect(page.getByText(/cancelled Google sign-in/i)).toBeVisible();
    await expect(page.getByText(/test-attempt/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Retry sign-in/i })).toHaveAttribute("href", /\/auth\?as=patient/);
  });

  test("/auth/error falls back to generic copy for unknown codes", async ({ page }) => {
    await page.goto(`${BASE}/auth/error?code=bogus_code&attempt=x`);
    await expect(page.getByText(/Sign-in failed/i)).toBeVisible();
  });
});
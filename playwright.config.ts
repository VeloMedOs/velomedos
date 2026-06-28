import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for VeloMed OS visual + responsive regression suites.
 *
 * Run locally:
 *   bun run dev                           # in one terminal
 *   bunx playwright test                  # in another
 *
 * Or one-shot (auto-starts dev server):
 *   bunx playwright test
 *
 * Single suite:
 *   bunx playwright test tests/visual/responsive-overflow.spec.ts
 */
const PORT = Number(process.env.E2E_PORT ?? 8080);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
/**
 * Step 5 · Turn 3 closure — URL resolution smoke fixture.
 *
 * Guards against duplicate-segment regressions (e.g. `/opd/opd/*`,
 * `/rcm/rcm/*`, `/admin/admin/*`) by asserting the generated route tree
 * registers every client-called URL verbatim. Reads
 * `src/routeTree.gen.ts` as text so the check is independent of the
 * router runtime and catches drift at build time.
 */
// @ts-expect-error bun-types conflicts with project types
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tree = readFileSync(resolve(__dirname, "../../../../../../routeTree.gen.ts"), "utf8");

const EXPECTED_URLS = [
  "/api/clinical/v1/opd/referral/report",
  "/api/clinical/v1/opd/referral/report.csv",
  "/api/clinical/v1/opd/referral/cockpit",
  "/api/clinical/v1/opd/referral/cross-encounter",
  "/api/clinical/v1/opd/referral/inter-company",
  "/api/clinical/v1/opd/referral/inter-company/create",
  "/api/clinical/v1/opd/referral/external",
  "/api/clinical/v1/opd/referral/create",
  "/api/clinical/v1/opd/referral/fan-out",
  "/api/clinical/v1/opd/referral/series/create",
  "/api/clinical/v1/opd/referral/series/eligible",
  "/api/clinical/v1/opd/cashier/allocate",
  "/api/clinical/v1/opd/cashier/worklist",
  "/api/clinical/v1/opd/cashier/charges",
  "/api/clinical/v1/opd/routing/board",
  "/api/clinical/v1/opd/routing",
  "/api/clinical/v1/opd/disruption/bulk-cancel",
  "/api/clinical/v1/opd/orders/wallet-gate",
  "/api/clinical/v1/opd/orders/billed-status",
  "/api/clinical/v1/opd/pregnancy-episode/link",
  "/api/clinical/v1/opd/registration/eligibility-first",
  "/api/clinical/v1/opd/registration/create-visit",
  "/api/clinical/v1/opd/registration/provider-load",
  "/api/clinical/v1/opd/maternity/banner",
  "/api/clinical/v1/opd/maternity/protocol",
  "/api/clinical/v1/opd/maternity/delivery-close",
  "/api/clinical/v1/opd/nutrition/referrals/pending",
  "/api/clinical/v1/opd/treatment-room/worklist",
  "/api/clinical/v1/opd/treatment-room/perform",
  "/api/clinical/v1/opd/vaccine-clinic/enable",
];

describe("route URL resolution — no duplicate segments", () => {
  it("route tree contains zero duplicate segments (opd/opd, rcm/rcm, admin/admin)", () => {
    expect(tree).not.toMatch(/\/opd\/opd\//);
    expect(tree).not.toMatch(/\/rcm\/rcm\//);
    expect(tree).not.toMatch(/\/admin\/admin\//);
  });

  for (const url of EXPECTED_URLS) {
    it(`registers ${url}`, () => {
      // Match the generated `path: '<url>'` line exactly to ensure the
      // route is registered at the client-called URL, not a variant.
      // Children of layout (`.route.ts`) routes are registered only via
      // `id: '<url>'`; standalone routes register both `id` and `path`.
      // Accept either.
      const hasId = tree.includes(`id: '${url}'`);
      const hasPath = tree.includes(`path: '${url}'`);
      expect(hasId || hasPath).toBe(true);
    });
  }
});
/**
 * Round 1 Batch 2 — admin route URL smoke fixture. Guards against
 * filename↔createFileRoute drift for the 13 new superadmin routes and
 * the `/api/public/v1/demo/tour-config` public endpoint.
 */
// @ts-expect-error bun-types conflicts with project types
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tree = readFileSync(resolve(__dirname, "../../../../routeTree.gen.ts"), "utf8");

const EXPECTED_URLS = [
  "/api/admin/v1/superadmin/tenants",
  "/api/admin/v1/superadmin/tenants/$id/suspend",
  "/api/admin/v1/superadmin/tenants/$id/reactivate",
  "/api/admin/v1/superadmin/tenants/$id/archive",
  "/api/admin/v1/superadmin/tenants/$id/promote",
  "/api/admin/v1/superadmin/provisioning",
  "/api/admin/v1/superadmin/provisioning/$id",
  "/api/admin/v1/superadmin/provisioning/$id/approve",
  "/api/admin/v1/superadmin/provisioning/$id/reject",
  "/api/admin/v1/superadmin/platform-settings",
  "/api/admin/v1/superadmin/platform-settings/demo-videos",
  "/api/admin/v1/superadmin/intake/stats",
  "/api/admin/v1/superadmin/provisioning/stats",
  "/api/public/v1/demo/tour-config",
];

describe("admin route URL resolution — Batch 2", () => {
  it("route tree contains zero duplicate segments (admin/admin, superadmin/superadmin)", () => {
    expect(tree).not.toMatch(/\/admin\/admin\//);
    expect(tree).not.toMatch(/\/superadmin\/superadmin\//);
  });
  for (const url of EXPECTED_URLS) {
    it(`registers ${url}`, () => {
      const hasId = tree.includes(`id: '${url}'`);
      const hasPath = tree.includes(`path: '${url}'`);
      expect(hasId || hasPath).toBe(true);
    });
  }
});
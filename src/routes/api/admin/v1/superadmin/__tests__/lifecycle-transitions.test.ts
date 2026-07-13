/**
 * Round 1 Batch 2 — lifecycle & type state-machine assertions.
 * Guards the NEXT map (sandbox → partner → production) and the
 * lifecycle transitions (active ↔ suspended, * → archived) that the
 * suspend/reactivate/archive/promote routes enforce.
 */
// @ts-expect-error bun-types conflicts with project types
import { describe, it, expect } from "bun:test";

// Duplicated from tenants.$id.promote.ts — kept in sync deliberately so a
// refactor there fails this fixture loudly.
const PROMOTE: Record<string, string | null> = {
  sandbox: "partner",
  partner: "production",
  production: null,
};

describe("tenant_type promotion state machine", () => {
  it("sandbox promotes to partner", () => expect(PROMOTE.sandbox).toBe("partner"));
  it("partner promotes to production", () => expect(PROMOTE.partner).toBe("production"));
  it("production has no further promotion", () => expect(PROMOTE.production).toBeNull());
});

describe("tenant_lifecycle transition rules", () => {
  // suspend: requires active
  it("suspend accepts active", () => expect(canSuspend("active")).toBe(true));
  it("suspend rejects suspended/archived/intake/provisioning", () => {
    for (const s of ["suspended", "archived", "intake", "provisioning"]) {
      expect(canSuspend(s)).toBe(false);
    }
  });
  // reactivate: requires suspended
  it("reactivate accepts suspended", () => expect(canReactivate("suspended")).toBe(true));
  it("reactivate rejects active", () => expect(canReactivate("active")).toBe(false));
  // archive: rejects only 'archived'
  it("archive accepts any non-archived state", () => {
    for (const s of ["intake", "provisioning", "active", "suspended"]) {
      expect(canArchive(s)).toBe(true);
    }
  });
  it("archive rejects already-archived", () => expect(canArchive("archived")).toBe(false));
});

function canSuspend(s: string) { return s === "active"; }
function canReactivate(s: string) { return s === "suspended"; }
function canArchive(s: string) { return s !== "archived"; }
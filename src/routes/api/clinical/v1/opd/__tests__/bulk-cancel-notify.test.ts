// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST, type BulkCancelBody } from "../opd.disruption.bulk-cancel";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "floor_manager" as const };

function seed(count: number) {
  const bookings: Record<string, unknown>[] = [];
  const bene: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    bookings.push({
      id: `bk${i}`, tenant_id: TENANT, clinic_id: "cl1",
      beneficiary_id: `b${i}`, origin_encounter_id: null,
      status: "confirmed", slot_at: "2026-07-11T10:00:00Z",
    });
    bene.push({ id: `b${i}`, tenant_id: TENANT, contact_number: `555${i}`, country_code: "+966", preferred_language: "en" });
  }
  return makeMockDb({
    tables: {
      clinics: [{ id: "cl1", tenant_id: TENANT, name: "GP-A" }, { id: "cl2", tenant_id: TENANT, name: "GP-B" }],
      clinic_bookings: bookings,
      beneficiary: bene,
      clinic_disruption: [],
      interface_log: [],
    },
  });
}

const WINDOW = { slot_at_from: "2026-07-11T09:00:00Z", slot_at_to: "2026-07-11T12:00:00Z" } as const;

describe("opd/disruption/bulk-cancel — row-per-notification, action semantics", () => {
  it("cancel: one interface_log per affected booking + one disruption row", async () => {
    const { client, db } = seed(3);
    const body: BulkCancelBody = { clinic_id: "cl1", ...WINDOW, action: "cancel", reason: "provider unavailable" };
    const res = await handlePOST({ body, ctx: CTX, db: client });
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.data.affected_count).toBe(3);
    expect(j.data.notifications_queued).toBe(3);
    expect(db.tables.interface_log.length).toBe(3);
    for (const log of db.tables.interface_log as any[]) {
      expect(log.trigger).toBe("bulk_cancel_notification");
    }
    expect(db.tables.clinic_disruption.length).toBe(1);
    for (const bk of db.tables.clinic_bookings as any[]) {
      expect(bk.status).toBe("cancelled");
      expect(bk.rebook_request).toBe(false);
    }
  });

  it("reschedule: same as cancel but rebook_request=true", async () => {
    const { client, db } = seed(2);
    await handlePOST({
      body: { clinic_id: "cl1", ...WINDOW, action: "reschedule", reason: "reason" },
      ctx: CTX, db: client,
    });
    for (const bk of db.tables.clinic_bookings as any[]) {
      expect(bk.status).toBe("cancelled");
      expect(bk.rebook_request).toBe(true);
    }
  });

  it("reassign: requires target; moves clinic_id, keeps status confirmed", async () => {
    const { client, db } = seed(2);
    const bad = await handlePOST({
      body: { clinic_id: "cl1", ...WINDOW, action: "reassign", reason: "reason" },
      ctx: CTX, db: client,
    });
    expect(bad.status).toBe(400);
    const ok = await handlePOST({
      body: { clinic_id: "cl1", ...WINDOW, action: "reassign", reason: "reason", reassign_target_clinic_id: "cl2" },
      ctx: CTX, db: client,
    });
    expect(ok.status).toBe(200);
    for (const bk of db.tables.clinic_bookings as any[]) {
      expect(bk.clinic_id).toBe("cl2");
      expect(bk.status).toBe("confirmed");
    }
  });

  it("empty window → 0 affected + 0 notifications, disruption row still logged", async () => {
    const { client, db } = seed(0);
    const res = await handlePOST({
      body: { clinic_id: "cl1", ...WINDOW, action: "cancel", reason: "any" },
      ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.data.affected_count).toBe(0);
    expect(j.data.notifications_queued).toBe(0);
    expect(db.tables.interface_log.length).toBe(0);
    expect(db.tables.clinic_disruption.length).toBe(1);
  });
});
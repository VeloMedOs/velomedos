// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST } from "../scheduler.bookings.$id.book";
import { makeMockDb } from "@/test/db-mock";
import { CTX_ADMIN, TENANT, readBody } from "./_seed";

function seedBook(heldUntilOffsetMs: number) {
  const heldUntil = new Date(Date.now() + heldUntilOffsetMs).toISOString();
  return makeMockDb({
    tables: {
      clinic_bookings: [{ id: "bk1", tenant_id: TENANT, slot_id: "s1", status: "requested" }],
      clinic_slot: [{ id: "s1", status: "held", held_until: heldUntil }],
      booking_event: [],
    },
  });
}

describe("scheduler.book — atomic held-slot commit", () => {
  it("expired hold → SLOT_UNAVAILABLE", async () => {
    const { client } = seedBook(-5 * 60_000);
    const res = await handlePOST({
      params: { id: "bk1" }, body: {}, ctx: CTX_ADMIN, db: client,
    });
    const j = await readBody(res);
    expect(j.code ?? j.error).toBe("SLOT_UNAVAILABLE");
  });

  it("valid hold → ok, slot flips to booked with held_until=null", async () => {
    const { db, client } = seedBook(5 * 60_000);
    const res = await handlePOST({
      params: { id: "bk1" }, body: {}, ctx: CTX_ADMIN, db: client,
    });
    const j = await readBody(res);
    expect(j.ok).toBe(true);
    const slot = db.tables.clinic_slot[0] as { status: string; held_until: string | null };
    expect(slot.status).toBe("booked");
    expect(slot.held_until).toBe(null);
  });
});
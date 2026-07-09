// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST } from "../opd.routing.route";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed(targetSpecialties: string[]) {
  return makeMockDb({
    tables: {
      clinic_bookings: [{ id: "bk1", tenant_id: TENANT, clinic_id: "cA", status: "booked", beneficiary_id: "b1", origin_encounter_id: "e1" }],
      clinics: [{ id: "cB", tenant_id: TENANT, name: "Cardiology B", specialties: targetSpecialties }],
      booking_event: [],
    },
  });
}
async function body(res: Response) { return await res.json(); }

describe("opd/routing/route — server-side specialty-lock", () => {
  it("target clinic missing required specialty → 422 specialty_mismatch", async () => {
    const { client } = seed(["general_medicine"]);
    const res = await handlePOST({
      body: { booking_id: "bk1", target_clinic_id: "cB", required_specialty: "cardiology" },
      ctx: CTX, db: client,
    });
    expect(res.status).toBe(422);
    const j = await body(res);
    expect(j.code).toBe("specialty_mismatch");
  });

  it("target clinic has specialty → ok, booking_event emitted", async () => {
    const { client, db } = seed(["cardiology", "general_medicine"]);
    const res = await handlePOST({
      body: { booking_id: "bk1", target_clinic_id: "cB", required_specialty: "cardiology", reason: "closer match" },
      ctx: CTX, db: client,
    });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(db.calls.some((c) => c.table === "booking_event" && c.op === "insert")).toBe(true);
  });
});
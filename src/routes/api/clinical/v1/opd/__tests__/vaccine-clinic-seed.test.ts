// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST } from "../opd.vaccine-clinic.enable";
import { makeMockDb } from "@/test/db-mock";

const T = "t1";
const CTX = { tenantId: T, userId: "u1", clinicalRole: "tenant_admin" as const };

describe("vaccine-clinic/enable — idempotent seed", () => {
  it("first call creates and returns a clinic_id", async () => {
    let called = 0;
    const { client } = makeMockDb({
      tables: {},
      rpc: (name, args) => {
        expect(name).toBe("seed_vaccine_clinic");
        expect((args as any)._tenant).toBe(T);
        called += 1;
        return "clinic-xyz";
      },
    });
    const res = await handlePOST({ ctx: CTX, db: client });
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.data.clinic_id).toBe("clinic-xyz");
    expect(called).toBe(1);
  });
  it("second call returns the same clinic_id (idempotent)", async () => {
    const { client } = makeMockDb({ tables: {}, rpc: () => "clinic-xyz" });
    const res1 = await handlePOST({ ctx: CTX, db: client });
    const res2 = await handlePOST({ ctx: CTX, db: client });
    const j1 = await res1.json(); const j2 = await res2.json();
    expect(j1.data.clinic_id).toBe(j2.data.clinic_id);
  });
});
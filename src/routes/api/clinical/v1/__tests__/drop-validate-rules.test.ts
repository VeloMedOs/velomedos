// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST, type ValidateDropBody } from "../scheduler.validate-drop";
import { CTX_ADMIN, seedForValidateDrop, readBody } from "./_seed";

const baseBody: ValidateDropBody = {
  session_id: "00000000-0000-0000-0000-000000000001",
  slot_id: "s1",
  beneficiary_id: "b1",
  visit_type: "new_consult",
  source: "scheduled",
};

describe("scheduler.validate-drop — business rules bounce codes", () => {
  it("female-clinic + male patient → slot_gender_mismatch", async () => {
    const { client } = seedForValidateDrop({
      schedule: { female_clinic: true },
      beneficiary: { gender: "male" },
    });
    const res = await handlePOST({ body: baseBody, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.code ?? j.error).toBe("slot_gender_mismatch");
  });

  it("active slot_block reason_code='or_case' → slot_or_restricted", async () => {
    const { client } = seedForValidateDrop({
      slot_block: [{ id: "sb1", schedule_id: "sch1", reason_code: "or_case", tenant_id: "t1" }],
    });
    const res = await handlePOST({ body: baseBody, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.code ?? j.error).toBe("slot_or_restricted");
  });

  it("patient age below age_min → slot_age_out_of_range", async () => {
    const { client } = seedForValidateDrop({
      schedule: { age_min: 30 },
      beneficiary: { dob: new Date().toISOString().slice(0, 10) },
    });
    const res = await handlePOST({ body: baseBody, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.code ?? j.error).toBe("slot_age_out_of_range");
  });

  it("service.approx_perform_minutes > slot_duration_min → slot_visit_duration_exceeds", async () => {
    const svcId = "00000000-0000-0000-0000-0000000000aa";
    const { client } = seedForValidateDrop({
      service: { id: svcId, approx_perform_minutes: 60 },
      schedule: { slot_duration_min: 30 },
    });
    const res = await handlePOST({
      body: { ...baseBody, service_id: svcId },
      ctx: CTX_ADMIN, db: client,
    });
    const j = await readBody(res);
    expect(j.code ?? j.error).toBe("slot_visit_duration_exceeds");
  });
});
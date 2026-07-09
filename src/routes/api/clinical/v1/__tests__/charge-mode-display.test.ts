// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST, type ValidateDropBody } from "../scheduler.validate-drop";
import { CTX_ADMIN, seedForValidateDrop, readBody } from "./_seed";

const SVC_ID = "00000000-0000-0000-0000-0000000000aa";

const baseBody: ValidateDropBody = {
  session_id: "00000000-0000-0000-0000-000000000001",
  slot_id: "s1",
  beneficiary_id: "b1",
  visit_type: "new_consult",
  service_id: SVC_ID,
  source: "scheduled",
};

/**
 * Rule seeds (Turn 1 BB2 shape). Priority ordering: series > follow_up > default.
 * Rule C (series) gates on sub_category='series_therapy'; if the fact is absent
 * the rule fails to match and the default new_consult rule wins.
 */
const ruleFollowUp = {
  id: "rB", name: "Rule B follow-up", scope: "referral", priority: 10,
  condition: { days_since_last_visit: { op: "lte", value: 14 } },
  action: { charge_mode: "follow_up" },
  tenant_id: null, active: true,
};
const ruleSeries = {
  id: "rC", name: "Rule C series", scope: "referral", priority: 20,
  condition: { sub_category: "series_therapy" },
  action: { charge_mode_resolver: "series_or_no_charge", series_sub_category: "series_therapy" },
  tenant_id: null, active: true,
};
const ruleDefault = {
  id: "rD", name: "Default new consult", scope: "referral", priority: 100,
  condition: { visit_type: "new_consult" },
  action: { charge_mode: "new_consult" },
  tenant_id: null, active: true,
};

describe("scheduler.validate-drop — DD4 charge_mode display (never bounces)", () => {
  it("A. 10 days ago, same specialty → charge_mode='follow_up'", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400_000).toISOString();
    const { db, client } = seedForValidateDrop({
      service: { id: SVC_ID, approx_perform_minutes: 20 },
      schedule: { specialty: "endo", slot_duration_min: 30 },
      prior_bookings: [{
        id: "pb1", tenant_id: "t1", beneficiary_id: "b1", schedule_id: "sch1",
        slot_at: tenDaysAgo, status: "completed",
      }],
      pricing_rules: [ruleFollowUp, ruleSeries, ruleDefault],
    });
    // Seed the joined schedule row keyed by schedule alias for the .schedule:schedule_id join.
    db.tables.schedule = [{ id: "sch1", specialty: "endo" }];
    const res = await handlePOST({ body: baseBody, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.ok).toBe(true);
    expect(j.code ?? j.error).toBeUndefined();
    const inserted = db.tables.clinic_bookings.find((b) => b.slot_id === "s1" && b.status === "requested") as { charge_mode?: string } | undefined;
    expect(inserted?.charge_mode).toBe("follow_up");
  });

  it("B. 30 days ago + service_master.sub_category='series_therapy' → charge_mode='series'", async () => {
    const { db, client } = seedForValidateDrop({
      service: { id: SVC_ID, approx_perform_minutes: 20, sub_category: "series_therapy" },
      schedule: { specialty: "endo", slot_duration_min: 30 },
      pricing_rules: [ruleFollowUp, ruleSeries, ruleDefault],
    });
    db.tables.schedule = [{ id: "sch1", specialty: "endo" }];
    const res = await handlePOST({ body: baseBody, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.ok).toBe(true);
    expect(j.code ?? j.error).toBeUndefined();
    const inserted = db.tables.clinic_bookings[0] as { charge_mode?: string } | undefined;
    expect(inserted?.charge_mode).toBe("series");
  });

  it("C. 30 days ago, no sub_category → charge_mode='new_consult'", async () => {
    const { db, client } = seedForValidateDrop({
      service: { id: SVC_ID, approx_perform_minutes: 20 },
      schedule: { specialty: "endo", slot_duration_min: 30 },
      pricing_rules: [ruleFollowUp, ruleSeries, ruleDefault],
    });
    db.tables.schedule = [{ id: "sch1", specialty: "endo" }];
    const res = await handlePOST({ body: baseBody, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.ok).toBe(true);
    expect(j.code ?? j.error).toBeUndefined();
    const inserted = db.tables.clinic_bookings[0] as { charge_mode?: string } | undefined;
    expect(inserted?.charge_mode).toBe("new_consult");
  });
});